async function renderMarkdown(container, url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(10000)});
  if (!response.ok) return false;
  const text = await response.text();
  if (!text.trim()) return false;
  container.innerHTML = DOMPurify.sanitize(marked.parse(text));
  for (const node of container.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      const value = node.getAttribute(attribute);
      if (!value || value.startsWith('#')) continue;
      try {
        const resolved = new URL(value, response.url);
        if (attribute === 'href' && resolved.hostname === 'yuexr.github.io' && resolved.pathname === '/astro/mods/installation/') {
          const root = new URL(document.body.dataset.root, location.href);
          node.setAttribute(attribute, new URL('mods/installation.html' + resolved.hash, root).href);
        }
        else if (['http:', 'https:'].includes(resolved.protocol)) node.setAttribute(attribute, resolved.href);
        else node.removeAttribute(attribute);
      } catch {
        node.removeAttribute(attribute);
      }
    }
  }
  for (const anchor of container.querySelectorAll('a[href]:not([href^="#"])')) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return Boolean(container.textContent.trim() || container.querySelector('img, video, iframe'));
}

async function loadDiary(id) {
  const section = document.querySelector('[data-diary]');
  const root = new URL(document.body.dataset.root, location.href);
  const url = new URL(`mods/author-notes/${id}.md`, root);
  section.hidden = !await renderMarkdown(section.querySelector('.mod-diary'), url);
}

async function loadReadme(repository) {
  const section = document.querySelector('[data-readme-section]');
  const url = `https://raw.githubusercontent.com/${repository}/HEAD/README.md`;
  section.hidden = !await renderMarkdown(section.querySelector('[data-readme]'), url);
}

async function loadGallery(repository) {
  const section = document.querySelector('[data-gallery]');
  const gallery = section.querySelector('.media-gallery');
  const popup = document.querySelector('.media-popup');
  const preview = popup.querySelector('img');
  popup.querySelector('button').addEventListener('click', () => popup.close());
  popup.addEventListener('click', event => {
    if (event.target === popup) popup.close();
  });
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/img`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return;
  const files = await response.json();
  if (!Array.isArray(files)) return;
  for (const file of files) {
    if (file.type !== 'file' || !/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file.name)) continue;
    const url = new URL(file.download_url);
    if (url.protocol !== 'https:') continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Enlarge ${file.name}`);
    const image = document.createElement('img');
    image.src = url.href;
    image.alt = file.name;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      button.remove();
      section.hidden = !gallery.childElementCount;
    });
    button.append(image);
    button.addEventListener('click', () => {
      preview.src = url.href;
      preview.alt = file.name;
      popup.showModal();
    });
    gallery.append(button);
  }
  section.hidden = !gallery.childElementCount;
}

export async function loadModContent(mod) {
  const tasks = [loadDiary(mod.id)];
  const repository = /^https:\/\/github\.com\/([^/]+\/[^/#?]+)\/?$/.exec(mod.repository || '')?.[1];
  if (repository) tasks.push(loadReadme(repository), loadGallery(repository));
  await Promise.allSettled(tasks);
}
