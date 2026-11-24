/* TYKHO · сторінка товару: галерея, розміри, AJAX-кошик, «Збери ліжко», липка панель, діалоги. Vanilla JS. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cfg = window.tykhoProduct || {};
  const t = cfg.i18n || {};
  const ui = () => window.TykhoUI || { open() {}, toast() {} };
  const money = n => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n) + ' ' + (cfg.currency || 'грн');
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── Галерея ─────────────────────────────────────────── */
  const gallery = $('[data-gallery]');
  if (gallery) {
    const main = $('[data-main]', gallery);
    const thumbs = $$('[data-i]', gallery);
    let cur = 0;
    const show = i => {
      if (!thumbs.length || !main) return;
      cur = (i + thumbs.length) % thumbs.length;
      const b = thumbs[cur];
      main.removeAttribute('srcset');
      main.src = b.dataset.src;
      if (b.dataset.srcset) main.srcset = b.dataset.srcset;
      main.alt = b.dataset.alt;
      thumbs.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    };
    gallery.addEventListener('click', e => {
      const th = e.target.closest('[data-i]');
      if (th) show(+th.dataset.i);
      const nav = e.target.closest('[data-g]');
      if (nav) show(cur + +nav.dataset.g);
    });
    // Свайп на сенсорних екранах.
    let x0 = null;
    gallery.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    gallery.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  /* ── Покупка ─────────────────────────────────────────── */
  const form = $('[data-buy-form]');
  const variations = form ? JSON.parse(form.dataset.variations || '{}') : {};
  let current = null;
  const bundle = $('[data-bundle]');

  function selectSize(slug) {
    const v = variations[slug];
    if (!v) return;
    current = { slug, ...v };
    const vid = $('[data-variation-id]', form);
    if (vid) vid.value = v.id;
    $('[data-size-name]') && ($('[data-size-name]').textContent = v.name);
    $('[data-price]').innerHTML = v.html;
    const sp = $('[data-s-price]');
    if (sp) sp.innerHTML = v.html;
    const dims = $('[data-dims]');
    if (dims) {
      dims.innerHTML = v.dims.map(([k, val]) => `<div><span>${esc(k)}</span><b>${esc(val)}</b></div>`).join('');
      dims.hidden = !v.dims.length;
    }
    const stock = $('[data-stock]');
    stock.textContent = v.stock ? t.inStock : t.outStock;
    stock.classList.toggle('out', !v.stock);
    $('[data-add]', form).disabled = !v.stock;
    updateShipping();
    updateBundle();
  }

  function updateShipping() {
    if (!current) return;
    const qty = Math.max(1, +$('input[name="quantity"]', form).value || 1);
    const sum = current.price * qty;
    $$('[data-free]').forEach(b => {
      const min = (cfg.free || {})[b.dataset.free];
      b.textContent = min && sum >= min ? t.free : t.tariff;
    });
  }

  function applyFragments(fragments) {
    Object.entries(fragments || {}).forEach(([sel, html]) => $$(sel).forEach(el => { el.outerHTML = html; }));
  }

  function added(data, button) {
    applyFragments(data.fragments);
    if (window.jQuery) {
      window.jQuery(document.body).trigger('added_to_cart', [data.fragments, data.cart_hash]);
    } else {
      ui().open('cart');
      ui().toast(t.added);
    }
  }

  async function post(url, body, button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || data.success === false) throw new Error((data.data && data.data.message) || t.error);
      added(data, button);
    } catch (err) {
      ui().toast(err.message || t.error);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  if (form) {
    const checked = $('input[name="attribute_pa_rozmir"]:checked', form);
    const first = Object.keys(variations)[0];
    if (checked) selectSize(checked.value);
    else if (first && Object.keys(variations).length === 1) selectSize(first);

    form.addEventListener('change', e => {
      if (e.target.name === 'attribute_pa_rozmir') selectSize(e.target.value);
      if (e.target.name === 'quantity') updateShipping();
    });
    form.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (!q) return;
      const input = $('input[name="quantity"]', form);
      const max = +input.max || 99;
      input.value = Math.min(max, Math.max(1, (+input.value || 1) + +q.dataset.q));
      updateShipping();
    });
    form.addEventListener('submit', e => {
      if (!window.fetch || !cfg.addUrl || !current) return; // Без JS-даних — звичайна відправка форми.
      e.preventDefault();
      const body = new FormData();
      body.append('product_id', current.id);
      body.append('quantity', $('input[name="quantity"]', form).value || 1);
      post(cfg.addUrl, body, $('[data-add]', form));
    });
  }

  /* ── Збери ліжко ─────────────────────────────────────── */
  function updateBundle() {
    if (!bundle || !current) return;
    let total = current.price, count = 1;
    $('[data-bundle-main]', bundle).textContent = money(current.price);
    $$('[data-bundle-item]', bundle).forEach(item => {
      const opt = JSON.parse(item.dataset.options || '{}')[current.slug];
      const box = $('input', item);
      item.hidden = !opt;
      box.disabled = !opt;
      if (!opt) return;
      $('[data-qty-label]', item).textContent = opt.qty > 1 ? ' × ' + opt.qty : '';
      $('[data-size-label]', item).textContent = opt.size || '';
      $('[data-price-label]', item).textContent = money(opt.price * opt.qty);
      if (box.checked) { total += opt.price * opt.qty; count += 1; }
    });
    $('[data-bundle-total]', bundle).innerHTML = `${money(total)} <small>за ${count} ${plural(count, t.items1, t.items2, t.items5)}</small>`;
  }

  if (bundle) {
    bundle.addEventListener('change', updateBundle);
    $('[data-bundle-add]', bundle).addEventListener('click', e => {
      if (!current) return;
      const body = new FormData();
      body.append('action', 'tykho_add_bundle');
      body.append('nonce', cfg.bundleNonce);
      const lines = [{ id: current.id, qty: 1 }];
      $$('[data-bundle-item]', bundle).forEach(item => {
        const opt = JSON.parse(item.dataset.options || '{}')[current.slug];
        if (opt && $('input', item).checked) lines.push({ id: opt.id, qty: opt.qty });
      });
      lines.forEach((l, i) => { body.append(`items[${i}][id]`, l.id); body.append(`items[${i}][qty]`, l.qty); });
      post(cfg.bundleUrl, body, e.currentTarget);
    });
    updateBundle();
  }

  /* ── Липка панель ────────────────────────────────────── */
  const sticky = $('[data-sticky]');
  const addBtn = form && $('[data-add]', form);
  if (sticky && addBtn && 'IntersectionObserver' in window) {
    const sAdd = $('[data-s-add]', sticky);
    new IntersectionObserver(([en]) => {
      const vis = !en.isIntersecting && en.boundingClientRect.top < 0;
      sticky.classList.toggle('show', vis);
      sticky.setAttribute('aria-hidden', String(!vis));
      sAdd.tabIndex = vis ? 0 : -1;
    }).observe(addBtn);
    sAdd.addEventListener('click', () => {
      if (addBtn.disabled) return form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      form.requestSubmit ? form.requestSubmit(addBtn) : addBtn.click();
    });
  }

  /* ── Діалоги (<dialog>) ──────────────────────────────── */
  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-dialog]');
    if (opener) {
      const dlg = document.getElementById(opener.dataset.dialog);
      if (!dlg || !dlg.showModal) return;
      $$('iframe[data-src]', dlg).forEach(f => { f.src = f.dataset.src; });
      dlg.showModal();
      return;
    }
    const dlg = e.target.closest('dialog.modal');
    // Клік по фону (поза карткою) або по хрестику закриває.
    if (dlg && (e.target === dlg || e.target.closest('[data-dialog-close]'))) dlg.close();
  });
  $$('dialog.modal').forEach(dlg => dlg.addEventListener('close', () => {
    $$('iframe[data-src]', dlg).forEach(f => f.removeAttribute('src'));
  }));
})();
