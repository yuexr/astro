export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export async function fetchJSON(file) {
  const response = await fetch(file, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Couldn't load ${file}: ${response.status}`);
  return response.json();
}

export function createPagination(perPage, render) {
  const count = document.querySelector('#count');
  const empty = document.querySelector('#empty');
  const results = document.querySelector('.list-results');
  const form = perPage.closest('form');
  const scrollPane = document.querySelector('.scroll-pane');
  const controls = [...document.querySelectorAll('.list-pagination')].map(node => ({
    node,
    label: node.querySelector('[data-page-label]'),
    previous: node.querySelector('[data-step="-1"]'),
    next: node.querySelector('[data-step="1"]')
  }));
  let page = 0;

  for (const { previous, next } of controls) {
    for (const button of [previous, next]) {
      button.addEventListener('click', () => {
        page += Number(button.dataset.step);
        render();
        results.scrollIntoView({ block: 'start' });
        scrollPane.scrollBy(0, -form.offsetHeight - 10);
      });
    }
  }

  return {
    reset() {
      page = 0;
    },
    render(items) {
      const size = perPage.value === 'all' ? Math.max(items.length, 1) : Number(perPage.value);
      const pages = Math.ceil(items.length / size);
      page = Math.max(0, Math.min(page, pages - 1));
      const start = page * size;
      const first = items.length ? start + 1 : 0;
      const last = Math.min(start + size, items.length);
      count.textContent = `${items.length.toLocaleString()} ${items.length === 1 ? 'result' : 'results'} · ${first}–${last}`;
      empty.hidden = items.length !== 0;
      for (const { node, label, previous, next } of controls) {
        node.hidden = pages === 0;
        label.textContent = `Page ${pages ? page + 1 : 0} of ${pages}`;
        previous.disabled = page === 0;
        next.disabled = page + 1 >= pages;
      }
      return items.slice(start, last);
    }
  };
}
