/** Open a category's native disclosures before navigating to its anchor. */
export function installCategoryDisclosures(): () => void {
  let scrollFrame: number | null = null;

  function targetFor(hash: string): HTMLElement | null {
    if (!hash || hash === '#') return null;
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
  }

  function reveal(hash: string): HTMLElement | null {
    const target = targetFor(hash);
    const category = target?.closest<HTMLElement>('[data-category-parent]');
    if (!target || !category) return null;

    // Include the target itself: #cat-sql--mysql points directly at a <details>.
    for (let element: HTMLElement | null = target; element; element = element.parentElement) {
      if (element instanceof HTMLDetailsElement) element.open = true;
    }

    const parent = category.dataset.categoryParent;
    for (const branch of document.querySelectorAll<HTMLDetailsElement>('details[data-category-branch]')) {
      if (branch.dataset.categoryBranch === parent) branch.open = true;
    }
    return target;
  }

  function align(target: HTMLElement, hash: string): void {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      if (target.isConnected && location.hash === hash) {
        // Opening the sidebar can also change the target's position on mobile.
        // Waiting a frame lets both disclosures settle before honoring scroll-margin.
        target.scrollIntoView({ block: 'start', inline: 'nearest' });
      }
    });
  }

  function revealCurrentHash(): void {
    const hash = location.hash;
    const target = reveal(hash);
    if (target) align(target, hash);
  }

  function onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;

    // Capture runs before the browser's anchor navigation, including clicks made
    // with Enter. Native navigation owns the URL/history and its hashchange event.
    const target = reveal(url.hash);
    if (target && url.hash === location.hash) {
      // Clicking the current hash again does not emit hashchange.
      align(target, url.hash);
    }
  }

  function onPageShow(event: PageTransitionEvent): void {
    // Initial navigation is handled below; persisted pages need their saved hash
    // revealed again after browser Back/Forward restores the document.
    if (event.persisted) revealCurrentHash();
  }

  document.addEventListener('click', onClick, true);
  window.addEventListener('hashchange', revealCurrentHash);
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('astro:page-load', revealCurrentHash);
  revealCurrentHash();

  return () => {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('hashchange', revealCurrentHash);
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('astro:page-load', revealCurrentHash);
  };
}
