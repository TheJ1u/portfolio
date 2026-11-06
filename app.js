(() => {
  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* Theme: follows the visitor's system setting until they pick one. */
  const toggle = $('#theme-toggle');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    $('.label', toggle).textContent = theme === 'dark' ? 'Light' : 'Dark';
  }
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    });
    applyTheme(root.dataset.theme || 'light');
  }

  /* Slideshows: the strip scroll-snaps on its own (and swipes on phones); these add buttons and a counter. */
  $$('.slide-controls').forEach(controls => { controls.hidden = false; });
  const slideIndex = strip => Math.round(strip.scrollLeft / Math.max(strip.clientWidth, 1));
  function updateCount(strip) {
    const show = strip.closest('.slideshow');
    const count = $('.slide-count', show);
    if (!count) return;
    const total = strip.children.length;
    const i = Math.min(total - 1, Math.max(0, slideIndex(strip)));
    count.textContent = `${i + 1} / ${total}`;
    $('.slide-prev', show).disabled = i === 0;
    $('.slide-next', show).disabled = i === total - 1;
  }
  function go(strip, step) {
    const target = Math.min(strip.children.length - 1, Math.max(0, slideIndex(strip) + step));
    strip.scrollTo({ left: target * strip.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  // Scroll events don't bubble, so listen in the capture phase for every strip, including cloned ones.
  document.addEventListener('scroll', event => {
    if (event.target instanceof Element && event.target.classList.contains('slides')) updateCount(event.target);
  }, true);
  $$('.slides').forEach(updateCount);

  /* Panels: turn the three facets into tabs. Without JavaScript they all stay visible. */
  function enhance(panel) {
    const facets = $$('.facet', panel);
    if (facets.length < 2) return;
    const list = document.createElement('div');
    list.className = 'tabs';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Project details');
    facets.forEach((facet, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === 0));
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.dataset.facet = facet.dataset.facet;
      tab.textContent = facet.dataset.facet;
      list.append(tab);
      facet.setAttribute('role', 'tabpanel');
      facet.hidden = i !== 0;
    });
    facets[0].before(list);
  }
  $$('.panel').forEach(enhance);

  function selectTab(tab) {
    const panel = tab.closest('.panel');
    $$('.tab', panel).forEach(item => { const on = item === tab; item.setAttribute('aria-selected', String(on)); item.tabIndex = on ? 0 : -1; });
    $$('.facet', panel).forEach(facet => { facet.hidden = facet.dataset.facet !== tab.dataset.facet; });
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('.tab');
    if (tab) { selectTab(tab); return; }
    const arrow = event.target.closest('.slide-prev, .slide-next');
    if (arrow) go($('.slides', arrow.closest('.slideshow')), arrow.classList.contains('slide-next') ? 1 : -1);
  });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest?.('.tab');
    if (!tab || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = $$('.tab', tab.closest('.panel'));
    const next = tabs[(tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
    event.preventDefault();
  });

  /* Project index: a list beside a preview stage on wide screens, expandable rows on narrow ones. */
  const grid = $('.work-grid');
  if (!grid) return;
  const stage = $('.stage');
  const items = $$('.item');
  const wide = matchMedia('(min-width: 900px)');
  let current = null;
  grid.classList.add('has-stage');

  function renderStage(item) {
    const copy = $('.panel', item).cloneNode(true);
    copy.removeAttribute('id');
    stage.replaceChildren(copy);
    $$('.slides', copy).forEach(updateCount);
  }

  function select(item, { toggleOpen = false } = {}) {
    if (wide.matches) {
      current = item;
      items.forEach(other => {
        const on = other === item;
        other.classList.toggle('is-current', on);
        const row = $('.row', other);
        row.removeAttribute('aria-expanded');
        if (on) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
      });
      renderStage(item);
    } else {
      const open = toggleOpen ? !item.classList.contains('open') : true;
      item.classList.toggle('open', open);
      const row = $('.row', item);
      row.removeAttribute('aria-current');
      row.setAttribute('aria-expanded', String(open));
      if (open) $$('.slides', item).forEach(updateCount);
    }
  }

  function syncMode() {
    items.forEach(item => {
      const row = $('.row', item);
      row.removeAttribute('aria-current');
      row.setAttribute('aria-expanded', String(item.classList.contains('open')));
    });
    if (wide.matches) select(current || items[0]);
  }

  items.forEach(item => {
    const row = $('.row', item);
    row.addEventListener('click', () => {
      select(item, { toggleOpen: true });
      try { history.replaceState(null, '', `#${item.id}`); } catch (e) { /* ignore */ }
    });
    row.addEventListener('keydown', event => {
      if (!wide.matches || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      const next = items[items.indexOf(item) + (event.key === 'ArrowDown' ? 1 : -1)];
      if (!next) return;
      select(next);
      $('.row', next).focus();
      event.preventDefault();
    });
  });

  function openFromHash() {
    const item = items.find(other => other.id === location.hash.slice(1));
    if (!item) return;
    select(item);
    item.scrollIntoView({ block: 'start' });
  }

  wide.addEventListener('change', syncMode);
  window.addEventListener('hashchange', openFromHash);
  syncMode();
  openFromHash();
})();
