const root = new URL(document.body.dataset.root, location.href);
const siteURL = path => new URL(path, root).href;

async function include(host) {
  try {
    const response = await fetch(siteURL(host.dataset.include), {cache: 'no-cache', signal: AbortSignal.timeout(6000)});
    if (!response.ok) throw new Error('Could not load ' + host.dataset.include);
    const template = document.createElement('template');
    template.innerHTML = await response.text();
    // Shared-file paths are relative to the site root, even on nested pages.
    template.content.querySelectorAll('[href], [src]').forEach(node => {
      for (const attribute of ['href', 'src']) {
        const value = node.getAttribute(attribute);
        if (value && !value.startsWith('#')) node.setAttribute(attribute, siteURL(value));
      }
    });
    host.replaceChildren(template.content);
  } catch (error) {
    console.error(error);
    if (host.dataset.include === 'navbar.html') {
      const fallback = document.createElement('a');
      fallback.href = siteURL('mods/');
      fallback.textContent = 'Mods list';
      host.replaceChildren(fallback);
    }
  }
}

await Promise.all([...document.querySelectorAll('[data-include]')].map(include));

const page = document.body.dataset.page;
const mobile = matchMedia('(max-width: 700px)');
const menuButton = document.querySelector('.menu-toggle');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeURL(value, base = root) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function link(label, url, className) {
  const href = safeURL(url);
  if (!href) return null;
  const node = element('a', className, label);
  node.href = href;
  if (new URL(href).origin !== location.origin) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  return node;
}

function setMenu(open, restoreFocus = false) {
  if (!menuButton) return;
  open = open && mobile.matches;
  document.body.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.textContent = open ? '✕ CLOSE' : '☰ MENU';
  document.querySelector('.scroll-pane').inert = open;
  if (restoreFocus) menuButton.focus();
}

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  setMenu(open);
  if (open) document.querySelector('.sidebar nav a').focus();
});
document.querySelector('.menu-backdrop')?.addEventListener('click', () => setMenu(false, true));
mobile.addEventListener('change', () => setMenu(false));
document.addEventListener('keydown', event => {
  if (!document.body.classList.contains('menu-open')) return;
  if (event.key === 'Escape') setMenu(false, true);
  if (event.key !== 'Tab') return;
  const stops = [menuButton, ...document.querySelectorAll('.sidebar nav a')];
  const index = stops.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) {
    event.preventDefault();
    stops.at(-1).focus();
  } else if (!event.shiftKey && index === stops.length - 1) {
    event.preventDefault();
    stops[0].focus();
  }
});

document.querySelector(`[data-nav="${page === 'mod' ? 'mods' : page}"]`)?.setAttribute('aria-current', 'page');

async function fetchJSON(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(6000)});
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return response.json();
}

async function metadata(source) {
  const url = safeURL(source.url);
  if (!url) throw new Error('Invalid metadata URL');
  const key = `astro-metadata:${url}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key));
    if (cached && Date.now() - cached.saved < 300000) return cached.data;
  } catch { /* Storage may be disabled. */ }

  const data = await fetchJSON(url);
  try {
    sessionStorage.setItem(key, JSON.stringify({saved: Date.now(), data}));
  } catch { /* The page works without a cache. */ }
  return data;
}

function normalizeMetadata(data, source) {
  if (source.key) data = source.key.split('.').reduce((value, key) => value?.[key], data);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid metadata');
  if (source.format === 'github-release') {
    if (typeof data.tag_name !== 'string') throw new Error('Invalid GitHub release');
    return {
      version: data.tag_name.replace(/^v(?=\d)/, ''),
      publishedAt: data.published_at
    };
  }
  if (source.format !== 'mod-metadata') throw new Error('Unknown metadata format');
  const result = {};
  for (const [field, remote] of Object.entries({name: 'name', version: 'version', author: 'author', gameBuild: 'game_build', nexusUrl: 'nexus_url'})) {
    if (typeof data[remote] === 'string' && data[remote].trim()) result[field] = data[remote];
  }
  if (typeof data.enable_ue4ss === 'boolean') result.ue4ssRequired = data.enable_ue4ss;
  if (!Object.keys(result).length) throw new Error('No supported metadata fields');
  return result;
}

async function hydrateMod(mod) {
  const results = await Promise.allSettled((mod.sources || []).map(async source => normalizeMetadata(await metadata(source), source)));
  return Object.assign({}, mod, ...results.filter(result => result.status === 'fulfilled').map(result => result.value));
}

async function catalog() {
  const data = await fetchJSON(siteURL('mods/mods.json'));
  if (!Array.isArray(data.mods) || !Array.isArray(data.sections)) throw new Error('Invalid mod catalog');
  const ids = new Set();
  for (const mod of data.mods) {
    if (!/^[a-z0-9-]+$/.test(mod.id) || !mod.name || ids.has(mod.id)) throw new Error('Invalid or duplicate mod ID');
    ids.add(mod.id);
  }
  return data;
}

function pageHeader(title, description, id) {
  const header = element('header', 'page-header');
  const heading = element('h1', '', title);
  if (id) heading.id = id;
  header.append(heading);
  if (description) header.append(element('p', '', description));
  return header;
}

const descriptions = new Map();

function fitDescriptions() {
  for (const [node, text] of descriptions) {
    if (!node.isConnected || !node.getBoundingClientRect().width) continue;
    node.textContent = text;
    node.removeAttribute('title');
    const maxHeight = parseFloat(getComputedStyle(node).lineHeight) * 2;
    if (node.scrollHeight <= maxHeight + 1) continue;
    node.title = text;
    const words = text.split(/\s+/);
    let low = 0;
    let high = words.length;
    const clipped = count => words.slice(0, count).join(' ').replace(/[\s,.;:!?…-]+$/u, '') + '… (read more)';
    while (low < high) {
      const count = Math.ceil((low + high) / 2);
      node.textContent = clipped(count);
      if (node.scrollHeight <= maxHeight + 1) low = count;
      else high = count - 1;
    }
    node.textContent = clipped(low);
  }
}

function card(mod) {
  const node = link('', siteURL(`mods/mod.html?id=${encodeURIComponent(mod.id)}`), 'mod-card');
  const artwork = element('span', 'mod-image-wrap');
  const imageURL = safeURL(mod.image);
  if (imageURL) {
    const image = element('img', 'mod-image');
    image.src = imageURL;
    image.alt = mod.name;
    image.width = 360;
    image.height = 203;
    image.loading = 'lazy';
    artwork.append(image);
    image.addEventListener('error', () => {
      artwork.replaceChildren(element('span', 'mod-placeholder', '✦'));
    }, {once: true});
  } else {
    artwork.append(element('span', 'mod-placeholder', '✦'));
  }
  const title = element('h2', 'modcardname');
  const star = element('span', 'modcardstar', '✦');
  star.setAttribute('aria-hidden', 'true');
  title.append(star, document.createTextNode(mod.name));
  const description = element('p', 'modcarddesc', mod.description || '');
  descriptions.set(description, description.textContent);
  node.append(artwork, title, description);
  return node;
}

async function showMods() {
  const data = await catalog();
  const container = document.querySelector('#mod-sections');
  container.replaceChildren();
  const cards = new Map();
  for (const group of data.sections) {
    const mods = data.mods.filter(mod => mod.section === group.id && mod.visible !== false);
    if (!mods.length) continue;
    const section = element('section', 'mod-section');
    const titleId = `section-${group.id}`;
    section.setAttribute('aria-labelledby', titleId);
    const header = pageHeader(group.title, group.description, titleId);
    if (group.link) {
      const more = link(group.link.label, group.link.url);
      if (more) header.querySelector('p')?.append(' ', more, '.');
    }
    const grid = element('div', 'mod-grid');
    for (const mod of mods) {
      const node = card(mod);
      grid.append(node);
      cards.set(mod.id, node);
    }
    section.append(header, grid);
    container.append(section);
  }
  if (!cards.size) container.append(element('p', 'paper', 'No mods have been added yet.'));
  container.removeAttribute('aria-busy');
  const observer = new ResizeObserver(fitDescriptions);
  container.querySelectorAll('.mod-grid').forEach(grid => observer.observe(grid));
  await document.fonts.ready;
  fitDescriptions();

  for (const mod of data.mods.filter(mod => cards.has(mod.id) && mod.sources?.length)) {
    hydrateMod(mod).then(updated => {
      const old = cards.get(mod.id);
      descriptions.delete(old.querySelector('.modcarddesc'));
      old.replaceWith(card(updated));
      fitDescriptions();
    });
  }
}

function details(mod) {
  document.title = `${mod.name} | Y.U.E.`;
  document.querySelector('meta[name="description"]').content = mod.description || mod.name;
  const header = document.querySelector('#mod-header');
  header.replaceChildren(...pageHeader(mod.name, mod.description).childNodes);
  const notice = document.querySelector('#mod-notice');
  notice.hidden = mod.section !== 'personal';
  const links = document.querySelector('#mod-links');
  links.replaceChildren();
  for (const [label, url] of [['Nexus Mod Page', mod.nexusUrl], ['GitHub Repo', mod.repository]]) {
    const anchor = link(label, url, 'mod-button');
    if (!anchor) continue;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    links.append(anchor);
  }
  links.hidden = !links.childElementCount;
  const facts = document.querySelector('#mod-facts');
  facts.replaceChildren();
  const date = new Date(mod.publishedAt);
  const updated = mod.publishedAt && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-CA', {timeZone: 'UTC'}) : null;
  const ue4ss = typeof mod.ue4ssRequired === 'boolean' ? (mod.ue4ssRequired ? 'Yes' : 'No') : null;
  const status = {released: 'Released', personal: 'Personal (not released)'}[mod.section];
  for (const [label, value] of [['Last updated', updated], ['Version', mod.version], ['Game build', mod.gameBuild], ['UE4SS required', ue4ss], ['Status', status]]) {
    if (value === undefined || value === null || value === '') continue;
    const row = element('div');
    row.append(element('strong', '', `${label}: `), String(value));
    facts.append(row);
  }
  facts.hidden = !facts.childElementCount;
  document.querySelector('#mod-paper').hidden = notice.hidden && links.hidden && !facts.childElementCount
    && !document.querySelector('[data-diary]:not([hidden]), [data-gallery]:not([hidden])');
}

async function showMod() {
  const data = await catalog();
  const id = new URLSearchParams(location.search).get('id');
  const mod = data.mods.find(item => item.id === id && item.visible !== false);
  if (!mod) {
    document.title = 'Mod not found | Y.U.E.';
    const content = document.querySelector('.view');
    content.replaceChildren(pageHeader('Mod not found', 'This mod is not in the catalog.'));
    const paper = element('article', 'paper');
    paper.append(link('Back to all mods', siteURL('mods/')));
    content.append(paper);
    return;
  }
  details(mod);
  hydrateMod(mod).then(details);
  const {loadModContent} = await import('./mods/mod-content.js');
  await loadModContent(mod);
  const paper = document.querySelector('#mod-paper');
  if (paper.querySelector('[data-diary]:not([hidden]), [data-gallery]:not([hidden])')) paper.hidden = false;
  document.querySelector('#mod-paper').removeAttribute('aria-busy');
}

if (page === 'mods' || page === 'mod') {
  (page === 'mods' ? showMods() : showMod()).catch(error => {
    console.error(error);
    const container = document.querySelector('.view');
    container.replaceChildren(pageHeader('Could not load this page', 'Please try again in a moment.'));
    const paper = element('article', 'paper');
    const retry = link('Reload this page', location.href);
    paper.append(retry, element('p', '', 'You can also browse the mod repositories on GitHub.'), link('Astroneer projects', 'https://github.com/yuexr?tab=repositories'));
    container.append(paper);
  });
}
