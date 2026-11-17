(() => {
  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* Theme: follows the visitor's system setting until they pick one. */
  const toggle = $('#theme-toggle');
  const themeColor = $('meta[name="theme-color"]');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    if (toggle) $('.sr-only', toggle).textContent = `Switch to ${next} theme`;
    if (themeColor) themeColor.content = theme === 'dark' ? '#090b10' : '#f5f6f8';
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    });
  }
  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');

  /* Header: a hairline appears once the page scrolls. */
  const bar = $('.bar');
  if (bar) {
    const onScroll = () => bar.classList.toggle('scrolled', scrollY > 8);
    // No initial call: reading scrollY during load forces an early layout, and a restored scroll position fires this anyway.
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* Mark the section being read in the navigation (home page) and the table of contents (case studies). */
  function spy(links) {
    const targets = links.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const visible = new Set();
    const watch = new IntersectionObserver(entries => {
      for (const entry of entries) { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); }
      const current = targets.find(t => visible.has(t));
      links.forEach(a => { if (current && a.hash === `#${current.id}`) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    targets.forEach(t => watch.observe(t));
  }
  spy($$('.bar nav a').filter(a => a.pathname === location.pathname && a.hash));
  spy($$('.toc a'));

  /* Copy the email address. The button only appears when the browser can do it. */
  const copy = $('.copy');
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      const note = $('.copy-status');
      try { await navigator.clipboard.writeText(copy.dataset.copy); note.textContent = 'Copied'; }
      catch (e) { note.textContent = 'Copy failed. Select the address instead.'; }
      setTimeout(() => { note.textContent = ''; }, 2500);
    });
  }

  /* Screenshot deck (home hero): a 3D stack of real project screenshots.
     Without JavaScript the stack is static and the front card is a link. */
  const deck = $('[data-deck]');
  if (deck) {
    const cards = $$('.deck-card', deck);
    const buttons = $$('.deck-nav button', deck);
    const stack = $('.deck-cards', deck);
    const bringToFront = index => {
      cards.forEach((card, i) => {
        const position = (i - index + cards.length) % cards.length;
        card.style.setProperty('--p', position);
        // Cards behind the front one stay out of the tab order; the buttons below reach them.
        $('a', card).tabIndex = position === 0 ? 0 : -1;
      });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    };
    $('.deck-nav', deck).hidden = false;
    buttons.forEach((button, i) => button.addEventListener('click', () => bringToFront(i)));
    cards.forEach((card, i) => $('a', card).addEventListener('click', event => {
      // Clicking a card that is behind the front one brings it forward instead of leaving the page.
      if (card.style.getPropertyValue('--p').trim() !== '0') { event.preventDefault(); bringToFront(i); }
    }));
    bringToFront(0);

    // Pointer tilt: mouse only, never under reduced motion, one update per frame.
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    deck.addEventListener('pointermove', event => {
      if (!fine.matches || reduceMotion.matches || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = deck.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        deck.classList.add('tilting');
        stack.style.setProperty('--ry', `${(-9 + x * 14).toFixed(2)}deg`);
        stack.style.setProperty('--rx', `${(4 - y * 10).toFixed(2)}deg`);
      });
    });
    deck.addEventListener('pointerleave', () => {
      deck.classList.remove('tilting');
      stack.style.removeProperty('--ry');
      stack.style.removeProperty('--rx');
    });
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
  // Scroll events don't bubble, so listen in the capture phase for every strip.
  document.addEventListener('scroll', event => {
    if (event.target instanceof Element && event.target.classList.contains('slides')) updateCount(event.target);
  }, true);
  $$('.slides').forEach(updateCount);
  if (!$('a.zoom')) return;

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

  document.addEventListener('click', event => {
    const zoom = event.target.closest('a.zoom');
    if (zoom && typeof viewer.showModal === 'function') { event.preventDefault(); lbOpen(zoom); return; }
    const arrow = event.target.closest('.slide-prev, .slide-next');
    if (arrow) go($('.slides', arrow.closest('.slideshow')), arrow.classList.contains('slide-next') ? 1 : -1);
  });
})();
