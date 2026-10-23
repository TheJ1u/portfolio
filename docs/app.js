(() => {
  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  /* Theme: follows the visitor's system setting until they pick one. */
  const toggle = $('#theme-toggle');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    $('.label', toggle).textContent = theme === 'dark' ? 'Light' : 'Dark';
  }
  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
  });
  applyTheme(root.dataset.theme || 'light');

  /* Panels: turn the four facets into tabs. Without JavaScript they all stay visible. */
  function enhance(panel) {
    const facets = $$('.facet', panel);
    if (facets.length < 2) return;
    const list = document.createElement('div');
    list.className = 'tabs';
    list.setAttribute('role', 'tablist');
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
    const thumb = event.target.closest('.thumb');
    if (thumb) {
      const panel = thumb.closest('.panel');
      const index = Number(thumb.dataset.i);
      $$('.thumb', panel).forEach(item => item.setAttribute('aria-pressed', String(item === thumb)));
      $$('.shot', panel).forEach((shot, i) => { shot.hidden = i !== index; });
    }
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

  /* Project index with a live preview stage (wide screens) or inline panels (narrow screens). */
  const grid = $('.work-grid');
  const stage = $('.stage');
  const items = $$('.item');
  const search = $('#search');
  const chips = $$('.chip');
  const count = $('#result-count');
  const empty = $('.empty');
  const wide = matchMedia('(min-width: 900px)');
  let category = 'All';
  let current = null;
  let hoverTimer = 0;

  grid.classList.add('has-stage');
  $('.controls').hidden = false;
  count.hidden = false;

  function renderStage(item) {
    const copy = $('.panel', item).cloneNode(true);
    copy.removeAttribute('id');
    stage.replaceChildren(copy);
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
    }
  }

  function syncMode() {
    items.forEach(item => {
      const row = $('.row', item);
      row.removeAttribute('aria-current');
      row.setAttribute('aria-expanded', String(item.classList.contains('open')));
    });
    if (wide.matches) {
      const first = items.find(item => !item.hidden);
      if (!current || current.hidden) current = first || null;
      if (current) select(current); else stage.replaceChildren();
    }
  }

  function filter() {
    const term = search.value.trim().toLowerCase();
    let visible = 0;
    items.forEach(item => {
      const show = (category === 'All' || item.dataset.category === category) && item.dataset.search.includes(term);
      item.hidden = !show;
      if (show) visible++;
    });
    count.textContent = `Showing ${visible} of ${items.length}`;
    empty.hidden = visible !== 0;
    if (wide.matches) {
      if (!current || current.hidden) {
        const first = items.find(item => !item.hidden);
        if (first) select(first); else { current = null; stage.replaceChildren(); }
      }
    }
  }

  chips.forEach(chip => chip.addEventListener('click', () => {
    category = chip.dataset.filter;
    chips.forEach(other => other.setAttribute('aria-pressed', String(other === chip)));
    filter();
  }));
  search.addEventListener('input', filter);

  items.forEach(item => {
    const row = $('.row', item);
    row.addEventListener('click', () => {
      select(item, { toggleOpen: true });
      try { history.replaceState(null, '', `#${item.id}`); } catch (e) { /* ignore */ }
    });
    row.addEventListener('mouseenter', () => {
      if (!wide.matches || !matchMedia('(hover: hover)').matches || item === current) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => select(item), 110);
    });
    row.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
    row.addEventListener('keydown', event => {
      if (!wide.matches || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      const visible = items.filter(other => !other.hidden);
      const next = visible[visible.indexOf(item) + (event.key === 'ArrowDown' ? 1 : -1)];
      if (!next) return;
      select(next);
      $('.row', next).focus();
      event.preventDefault();
    });
  });

  function openFromHash() {
    const item = items.find(other => other.id === location.hash.slice(1));
    if (!item) return false;
    category = 'All';
    search.value = '';
    chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.filter === 'All')));
    items.forEach(other => { other.hidden = false; });
    count.textContent = `Showing ${items.length} of ${items.length}`;
    empty.hidden = true;
    select(item);
    item.scrollIntoView({ block: wide.matches ? 'center' : 'start' });
    return true;
  }

  wide.addEventListener('change', syncMode);
  window.addEventListener('hashchange', openFromHash);
  filter();
  syncMode();
  openFromHash();
})();
