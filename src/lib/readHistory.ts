/** Read history stays in this browser, just like ai-lab's read log. */
export const READ_HISTORY_KEY = 'paldyn:tech-blog:read:v1';

type ReadStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function postReadKey(value: string, origin: string, base = ''): string | null {
  try {
    const url = new URL(value, origin);
    const prefix = `${base.replace(/\/$/, '')}/posts/`;
    if (url.origin !== new URL(origin).origin || !url.pathname.startsWith(prefix)) return null;
    const id = url.pathname.slice(prefix.length).replace(/\/+$/, '');
    return id ? id : null;
  } catch {
    return null;
  }
}

export function createReadLog(storage: () => ReadStorage = () => localStorage) {
  let entries = new Set<string>();
  const unsaved = new Set<string>();

  function reload(): void {
    try {
      const raw = storage().getItem(READ_HISTORY_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      entries = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
      for (const id of unsaved) entries.add(id);
    } catch {
      // Storage can be unavailable; preserve the current session's history.
    }
  }

  reload();
  return {
    has: (id: string) => entries.has(id),
    reload,
    mark(id: string): void {
      // Merge another tab's recent reads before writing our own.
      reload();
      if (entries.has(id)) return;
      entries.add(id);
      try {
        storage().setItem(READ_HISTORY_KEY, JSON.stringify([...entries]));
        unsaved.clear();
      } catch {
        unsaved.add(id);
        // The current page still reflects the read if persistent storage is blocked.
      }
    },
  };
}

export function installReadHistory(base: string): () => void {
  const log = createReadLog();
  const items = new Map<HTMLElement, string>();
  const keyFor = (url: string) => postReadKey(url, location.origin, base);

  function render(item: HTMLElement, key: string): void {
    const read = log.has(key);
    item.classList.toggle('is-read', read);
    let mark = item.querySelector<HTMLElement>('[data-read-mark]');
    if (!read) {
      mark?.remove();
      return;
    }
    if (mark) return;
    mark = document.createElement('span');
    mark.className = 'read-mark';
    mark.dataset.readMark = '';
    mark.textContent = '읽음';
    const meta = item.querySelector('.card-meta, .post-meta, .hero-meta, .date, .search-hit-meta');
    (meta ?? item).appendChild(mark);
  }

  function register(root: ParentNode): void {
    const anchors = root instanceof HTMLAnchorElement ? [root] : [];
    anchors.push(...root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    for (const anchor of anchors) {
      if (anchor.closest('[data-article-body]')) continue;
      const key = keyFor(anchor.href);
      if (!key) continue;
      const item = anchor.closest<HTMLElement>('.card, .post-row, .hero-feature, .side-item, .search-hit, li');
      if (!item || items.get(item) === key) continue;
      item.dataset.readItem = '';
      items.set(item, key);
      render(item, key);
    }
  }

  function refresh(): void {
    log.reload();
    const article = document.querySelector<HTMLElement>('[data-read-article-url]');
    const current = article?.dataset.readArticleUrl;
    const key = current ? keyFor(current) : null;
    // ai-lab marks a post when its detail page opens, not on a list click/prefetch.
    if (key) log.mark(key);
    register(document);
    for (const [item, id] of items) {
      if (item.isConnected) render(item, id);
      else items.delete(item);
    }
  }

  refresh();
  // Search results are appended in chunks after the initial page load.
  const observer = new MutationObserver((records) => {
    let removed = false;
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof HTMLElement) register(node);
      if (record.removedNodes.length) removed = true;
    }
    if (removed) for (const item of items.keys()) if (!item.isConnected) items.delete(item);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const onStorage = (event: StorageEvent) => {
    if (event.key === READ_HISTORY_KEY || event.key === null) refresh();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('astro:page-load', refresh);
  return () => {
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pageshow', refresh);
    document.removeEventListener('astro:page-load', refresh);
  };
}
