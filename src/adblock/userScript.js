// Keep normal links usable in the tab while refusing script-created windows.
(() => {
  'use strict';
  try { window.open = () => null; } catch {}
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link || link.target !== '_blank' || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = link.href;
    if (!/^https?:\/\//i.test(url)) return;
    event.preventDefault();
    window.location.assign(url);
  }, true);
})();
