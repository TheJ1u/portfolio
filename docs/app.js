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

  /* Screenshot viewer: a full-screen dialog. The Close button, Esc, a click outside the picture and the
     browser's Back button all close it, so a visitor is never stuck on a bare image file. */
  const viewer = document.createElement('dialog');
  viewer.className = 'lightbox';
  viewer.setAttribute('aria-label', 'Screenshot viewer');
  viewer.innerHTML = '<div class="lb-top"><span class="lb-count"></span><button type="button" class="lb-close">Close <span aria-hidden="true">✕</span></button></div>'
    + '<div class="lb-stage"><img class="lb-img" alt=""></div>'
    + '<div class="lb-bottom"><button type="button" class="lb-prev" aria-label="Previous screenshot">←</button><p class="lb-cap" aria-live="polite"></p><button type="button" class="lb-next" aria-label="Next screenshot">→</button></div>';
  document.body.append(viewer);
  const lbImg = $('.lb-img', viewer);
  let lbItems = [], lbIndex = 0, lbOpener = null, lbPushed = false, lbIgnorePop = false;

  function lbShow(i) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    const item = lbItems[lbIndex];
    lbImg.srcset = `${item.big} 1600w, ${item.full} 2560w`;
    lbImg.sizes = '100vw';
    lbImg.src = item.big;
    lbImg.alt = item.alt;
    $('.lb-cap', viewer).textContent = item.caption;
    $('.lb-count', viewer).textContent = lbItems.length > 1 ? `${lbIndex + 1} / ${lbItems.length}` : '';
    $('.lb-prev', viewer).hidden = $('.lb-next', viewer).hidden = lbItems.length < 2;
  }
  function lbOpen(link) {
    const slides = $$('.slide', link.closest('.slides'));
    lbItems = slides.map(slide => {
      const a = $('a.zoom', slide);
      return { full: a.getAttribute('href'), big: a.dataset.big, alt: $('img', slide).alt, caption: $('figcaption', slide)?.textContent || '' };
    });
    lbOpener = link;
    lbShow(slides.indexOf(link.closest('.slide')));
    viewer.showModal();
    root.classList.add('lb-open');
    // An extra history entry lets the phone's Back button close the viewer instead of leaving the page.
    try { history.pushState({ viewer: true }, ''); lbPushed = true; } catch (e) { lbPushed = false; }
  }
  // Browsers drop focus after a history step, so put it back on the screenshot once the step is done.
  const refocus = () => setTimeout(() => lbOpener?.focus({ preventScroll: true }), 0);
  viewer.addEventListener('close', () => {
    root.classList.remove('lb-open');
    if (lbPushed) { lbPushed = false; lbIgnorePop = true; history.back(); } else refocus();
  });
  window.addEventListener('popstate', () => {
    if (lbIgnorePop) { lbIgnorePop = false; refocus(); return; }
    if (viewer.open) { lbPushed = false; viewer.close(); }
  });
  viewer.addEventListener('click', event => {
    if (event.target.closest('.lb-close')) viewer.close();
    else if (event.target.closest('.lb-prev')) lbShow(lbIndex - 1);
    else if (event.target.closest('.lb-next')) lbShow(lbIndex + 1);
    else if (!event.target.closest('.lb-img, .lb-cap, .lb-count')) viewer.close();
  });
  viewer.addEventListener('keydown', event => {
    if (lbItems.length < 2 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    lbShow(lbIndex + (event.key === 'ArrowRight' ? 1 : -1));
    event.preventDefault();
  });
  let touchX = null, touchY = 0;
  viewer.addEventListener('touchstart', event => { touchX = event.touches[0].clientX; touchY = event.touches[0].clientY; }, { passive: true });
  viewer.addEventListener('touchend', event => {
    if (touchX === null || lbItems.length < 2) return;
    const dx = event.changedTouches[0].clientX - touchX, dy = event.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  });

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
    const zoom = event.target.closest('a.zoom');
    if (zoom && typeof viewer.showModal === 'function') { event.preventDefault(); lbOpen(zoom); return; }
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
