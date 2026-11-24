/* TYKHO · тема · дровери, пошук, мега-меню, тост. Vanilla JS. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const overlay = $('.overlay');
  const mega = $('#mega');
  let lastFocus = null;

  const hoverable = matchMedia('(hover: hover) and (min-width: 901px)');
  const setExpanded = (id, on) => $$(`[aria-controls="${id}"]`).forEach(b => b.setAttribute('aria-expanded', String(on)));

  function closeMega() {
    if (!mega) return;
    mega.classList.remove('open');
    setExpanded('mega', false);
  }

  function closeAll({ restoreFocus = false } = {}) {
    $$('.drawer.open, .search-panel.open, .filters.open').forEach(el => {
      el.classList.remove('open');
      // Filters are a permanent column on desktop: never hide them from assistive tech.
      if (!el.matches('.filters')) el.setAttribute('aria-hidden', 'true');
      setExpanded(el.id, false);
    });
    overlay?.classList.remove('open');
    document.documentElement.style.overflow = '';
    closeMega();
    if (restoreFocus) lastFocus?.focus?.();
  }

  function open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    closeAll();
    lastFocus = document.activeElement;
    el.classList.add('open');
    if (!el.matches('.filters')) el.setAttribute('aria-hidden', 'false');
    setExpanded(id, true);
    if (el.matches('.drawer, .filters')) {
      overlay?.classList.add('open');
      document.documentElement.style.overflow = 'hidden';
    }
    setTimeout(() => (el.querySelector('input[type="search"], input, button, a') || el).focus(), 60);
  }

  function toggleMega(force) {
    if (!mega) return;
    const on = typeof force === 'boolean' ? force : !mega.classList.contains('open');
    if (on) closeAll();
    mega.classList.toggle('open', on);
    setExpanded('mega', on);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('.toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open], [data-close], [data-mega]');
    if (!t) {
      if (mega?.classList.contains('open') && !e.target.closest('.header')) closeMega();
      return;
    }
    if (t.matches('[data-open]')) { e.preventDefault(); open(t.dataset.open); }
    else if (t.matches('[data-close]')) closeAll({ restoreFocus: true });
    else if (t.matches('[data-mega]')) {
      if (t.matches('.header [data-mega]') && hoverable.matches) { closeMega(); return; } // follow the link to «Каталог»
      e.preventDefault();
      // Section-head "all categories" button scrolls up to the header first.
      if (!t.closest('.header')) window.scrollTo({ top: 0, behavior: 'smooth' });
      toggleMega();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll({ restoreFocus: true });
  });

  // Mega menu on hover (desktop pointer only).
  let hoverTimer;
  $('.header')?.addEventListener('mouseover', e => {
    if (!hoverable.matches) return;
    if (e.target.closest('.header [data-mega], #mega')) {
      clearTimeout(hoverTimer);
      if (!mega.classList.contains('open')) hoverTimer = setTimeout(() => toggleMega(true), 120);
    }
  });
  $('.header')?.addEventListener('mouseleave', () => {
    if (!hoverable.matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(closeMega, 200);
  });

  // Catalog filters: clean URLs (filter_x=a,b), instant apply on desktop.
  const filters = $('[data-filters]');
  if (filters) {
    const go = () => {
      const grouped = {};
      new FormData(filters).forEach((value, name) => {
        const v = String(value).trim();
        if (!v) return;
        const key = name.endsWith('[]') ? name.slice(0, -2) : name;
        (grouped[key] = grouped[key] || []).push(v);
      });
      const params = new URLSearchParams();
      Object.entries(grouped).forEach(([k, v]) => params.set(k, v.join(',')));
      const qs = params.toString();
      location.href = filters.action.split('?')[0] + (qs ? '?' + qs : '');
    };
    const wide = matchMedia('(min-width: 901px)');
    filters.addEventListener('submit', e => { e.preventDefault(); go(); });
    // Price fields fire "change" on Enter or blur, so typing is not interrupted.
    filters.addEventListener('change', () => { if (wide.matches) go(); });
  }

  // Product cards: "Купити" / "У кошик". Variable products first ask for a size in a small picker.
  const closeSizes = except => $$('[data-card-sizes]:not([hidden])').forEach(p => { if (p !== except) p.hidden = true; });
  const backToButton = panel => panel.closest('[data-card-buy]').querySelector('.card-actions .btn')?.focus();

  // Capture phase: runs before WooCommerce's own add-to-cart handler.
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-card-buy][data-needs-size] .card-actions .btn');
    if (!btn) return;
    const buy = btn.closest('[data-card-buy]');
    if (buy.dataset.ready === '1') { buy.dataset.ready = ''; return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    const panel = buy.querySelector('[data-card-sizes]');
    closeSizes(panel);
    buy.dataset.action = btn.matches('[data-card-checkout]') ? 'checkout' : 'cart';
    panel.hidden = false;
    panel.querySelector('.chip')?.focus();
  }, true);

  document.addEventListener('click', e => {
    const close = e.target.closest('[data-card-sizes-close]');
    if (close) {
      const panel = close.closest('[data-card-sizes]');
      panel.hidden = true;
      backToButton(panel);
      return;
    }
    const chip = e.target.closest('[data-card-sizes] [data-size-id]');
    if (!chip) {
      if (!e.target.closest('[data-card-sizes], [data-card-buy] .btn')) closeSizes();
      return;
    }
    const buy = chip.closest('[data-card-buy]');
    const id = chip.dataset.sizeId;
    buy.querySelector('[data-card-sizes]').hidden = true;
    if (buy.dataset.action === 'checkout') {
      const url = new URL(buy.dataset.checkout, location.href);
      url.searchParams.set('add-to-cart', id);
      location.href = url.toString();
      return;
    }
    const cart = buy.querySelector('.ajax_add_to_cart');
    cart.dataset.product_id = id;
    window.jQuery?.(cart).data('product_id', id); // WooCommerce reads jQuery's cached data.
    buy.dataset.ready = '1';
    cart.click();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const panel = $('[data-card-sizes]:not([hidden])');
    if (panel) { panel.hidden = true; backToButton(panel); }
  });

  // WooCommerce fires jQuery events after AJAX add-to-cart.
  if (window.jQuery) {
    window.jQuery(document.body).on('added_to_cart', () => {
      open('cart');
      toast('Додано в кошик');
      const count = $('[data-cart-count]');
      count?.classList.add('bump');
      count?.addEventListener('animationend', () => count.classList.remove('bump'), { once: true });
    });
  }

  // Hero slider: advances one card every few seconds; pauses on hover, focus and touch; no autoplay with reduced motion.
  const slider = $('[data-hero-slider]');
  if (slider) {
    const track = $('[data-hero-track]', slider);
    const wide = matchMedia('(min-width: 901px)');
    const gap = () => parseFloat(getComputedStyle(track).columnGap || '0');
    // Desktop: a page of four cards (two columns); phones: one card.
    const step = () => {
      if (wide.matches) return track.clientWidth + gap();
      const card = track.firstElementChild;
      return card ? card.getBoundingClientRect().width + gap() : 0;
    };
    const go = dir => {
      const max = track.scrollWidth - track.clientWidth;
      let x = track.scrollLeft + dir * step();
      if (x > max + 4) x = 0;
      if (x < -4) x = max;
      track.scrollTo({ left: x, behavior: 'smooth' });
    };
    $('[data-hero-prev]', slider)?.addEventListener('click', () => go(-1));
    $('[data-hero-next]', slider)?.addEventListener('click', () => go(1));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let paused = false;
      let resume;
      const hold = ms => { paused = true; clearTimeout(resume); if (ms) resume = setTimeout(() => { paused = false; }, ms); };
      slider.addEventListener('mouseenter', () => hold());
      slider.addEventListener('mouseleave', () => hold(600));
      slider.addEventListener('focusin', () => hold());
      slider.addEventListener('focusout', () => hold(600));
      slider.addEventListener('touchstart', () => hold(8000), { passive: true });
      setInterval(() => { if (!paused && !document.hidden) go(1); }, 4500);
    }
  }

  // Cart quantity stepper (− / +): updates the cart by itself shortly after the last tap.
  let qtyTimer;
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-qty]');
    if (!btn) return;
    const input = btn.closest('.quantity')?.querySelector('input.qty');
    if (!input) return;
    const min = parseFloat(input.min || '1');
    const max = parseFloat(input.max || '') || Infinity;
    const next = Math.min(max, Math.max(min, (parseFloat(input.value) || min) + parseFloat(btn.dataset.qty)));
    if (next === parseFloat(input.value)) return;
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    clearTimeout(qtyTimer);
    qtyTimer = setTimeout(() => {
      const update = $('[name="update_cart"]');
      if (update) { update.disabled = false; update.removeAttribute('aria-disabled'); update.click(); }
    }, 700);
  });

  // Article table of contents: highlight the section being read.
  const toc = $('[data-toc]');
  if (toc && 'IntersectionObserver' in window) {
    const links = new Map($$('a', toc).map(a => [decodeURIComponent(a.hash.slice(1)), a]));
    const spy = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(a => a.removeAttribute('aria-current'));
      links.get(entry.target.id)?.setAttribute('aria-current', 'true');
    }), { rootMargin: '-20% 0px -70% 0px' });
    links.forEach((_, id) => { const h = document.getElementById(id); if (h) spy.observe(h); });
  }

  // Reveal on scroll: blocks below the first screen fade up once, with a small stagger inside a row.
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const groups = ['.tiles', '.products', '.journal', '.facts', '.contact-ways', '.brands']; // not '.fabrics': a transform inside a horizontal scroller makes it scroll vertically
    const items = [...$$('main .section-head'), ...groups.flatMap(g => $$(`main ${g} > *`))]
      .filter(el => el.getBoundingClientRect().top > innerHeight);
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => {
      const siblings = el.parentElement ? [...el.parentElement.children] : [];
      el.style.setProperty('--i', String(Math.min(siblings.indexOf(el) % 4, 3)));
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  window.TykhoUI = { open, closeAll, toast };
})();
