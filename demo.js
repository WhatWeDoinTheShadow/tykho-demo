/* TYKHO · static demo: the cart, checkout, search and login need the real site. */
(() => {
  const MSG = 'Це демо-версія для перегляду. Кошик і оформлення замовлення працюватимуть на робочому сайті.';
  const say = msg => (window.TykhoUI?.toast ? window.TykhoUI.toast(msg) : alert(msg));

  const blocked = [
    '.add_to_cart_button', '.single_add_to_cart_button', '.checkout-button', '[data-card-checkout]',
    '[data-size-id]', '[name="add-to-cart"]', '.woocommerce-mini-cart__buttons a', '.drawer .btn-primary',
  ].join(',');
  const cartLink = /add-to-cart=|\/checkout\/|\/cart\/?(\?|$)/;

  document.addEventListener('click', e => {
    const el = e.target.closest('a, button');
    if (!el) return;
    if (el.matches(blocked) || cartLink.test(el.getAttribute('href') || '')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      say(MSG);
    }
  }, true);

  document.addEventListener('submit', e => {
    const form = e.target;
    if (form.matches('form.cart, form.woocommerce-cart-form, form.checkout, form.login, form.register, form.woocommerce-product-search, form[role="search"], form.search-form, form.form-inline')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      say(form.matches('[role="search"], .woocommerce-product-search, .search-form') ? 'У демо-версії пошук не працює.' : MSG);
    }
  }, true);
})();
