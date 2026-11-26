(() => {
  'use strict';
  const config = window.TFL_CONFIG;
  if (!config) return;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const money = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  const form = $('#order-form');
  const bar = $('.mobile-buybar');
  const menuToggle = $('.menu-toggle');
  const menu = $('#mobile-menu');
  let currentBundle = '1';
  let currentOrder = null;
  let sending = false;
  const closedMessage = 'Cửa hàng hiện chưa nhận đơn trực tuyến.';
  function orderApiReady() {
    return !!window.TFLOrders && typeof window.TFLOrders.submit === 'function' &&
      typeof window.TFLOrders.randomId === 'function';
  }
  function endpointReady() {
    try {
      const endpoint = new URL(config.orderEndpoint);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) return false;
      if (config.orderTransport === 'apps-script') {
        return endpoint.origin === 'https://script.google.com' &&
          /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint.pathname) &&
          !endpoint.search && !endpoint.hash;
      }
      return config.orderTransport === 'json';
    } catch (_) {
      return false;
    }
  }
  const stagingTest = config.mode === 'preview' &&
    new URLSearchParams(window.location.search).get('tfl_test') === '1';
  const live = (config.mode === 'live' || stagingTest) && endpointReady() && orderApiReady();
  function setCheckoutAvailable(available) {
    $$('input, textarea, button[type="submit"]', form).forEach((control) => { control.disabled = !available; });
    $('.submit-order').style.cursor = available ? '' : 'not-allowed';
    $('#submit-label').textContent = available ? 'Đặt hàng ngay' : 'Đặt hàng tạm đóng';
    $('#form-mode-notice').textContent = available
      ? (stagingTest ? 'Đơn kiểm thử — không nhập thông tin khách hàng.' : 'Thông tin được sử dụng để xử lý đơn hàng.')
      : closedMessage;
  }
  function blockUnavailableCheckout() {
    setCheckoutAvailable(false);
    $('.form-status').textContent = config.mode === 'live'
      ? 'Chức năng đặt hàng chưa sẵn sàng. Vui lòng tải lại trang hoặc quay lại sau.'
      : '';
  }

  function closeMenu() {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Mở menu');
  }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    menu.hidden = !open;
  });
  $$('a[href^="#"]').forEach((link) => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuToggle.focus(); }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 1000) closeMenu(); });

  let framePending = false;
  const progress = $('.reading-progress');
  function updateProgress() {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (range > 0 ? Math.min(100, Math.max(0, window.scrollY / range * 100)) : 0) + '%';
    framePending = false;
  }
  window.addEventListener('scroll', () => { if (!framePending) { framePending = true; requestAnimationFrame(updateProgress); } }, {passive: true});
  window.addEventListener('load', updateProgress, {once: true});

  const tabs = $$('.scent-tab');
  function activateTab(tab) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      $('#' + item.getAttribute('aria-controls')).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });

  function selectBundle(value, userInitiated = false) {
    if (!Object.prototype.hasOwnProperty.call(config.offers, value)) return;
    currentBundle = String(value);
    $$('input[name="bundle"]').forEach((input) => { input.checked = input.value === currentBundle; });
    const offer = config.offers[currentBundle];
    $('#summary-subtotal').textContent = money(offer.subtotal);
    $('#summary-shipping').textContent = offer.shipping === 0 ? 'Miễn phí' : money(offer.shipping);
    $('#summary-total').textContent = money(offer.subtotal + offer.shipping);
    $('#bar-title').textContent = offer.quantity === 1 ? '540 Blanc · 50ml' : 'Bộ đôi · 2 × 50ml';
    $('#bar-price').textContent = money(offer.subtotal);
    document.dispatchEvent(new CustomEvent('tfl:offer_selected', {detail: {quantity: offer.quantity, userInitiated}}));
  }
  $$('input[name="bundle"]').forEach((input) => input.addEventListener('change', () => selectBundle(input.value, true)));
  $$('[data-select-bundle]').forEach((link) => link.addEventListener('click', () => selectBundle(link.dataset.selectBundle, true)));
  selectBundle('1');

  function checkoutStarted() {
    if (!live || !orderApiReady()) return;
    document.dispatchEvent(new CustomEvent('tfl:checkout_started', {
      detail: {quantity: config.offers[currentBundle].quantity}
    }));
  }
  form.addEventListener('input', checkoutStarted, {once: true});

  const fields = [
    {id: 'customer-name', error: 'name-error', validate: (value) => value.length >= 2 && /\p{L}/u.test(value), message: 'Bạn vui lòng nhập họ và tên.'},
    {id: 'customer-phone', error: 'phone-error', validate: (value) => /^(?:0|\+?84)[35789]\d{8}$/.test(value.replace(/[\s.()\-]/g, '')), message: 'Vui lòng nhập số di động Việt Nam hợp lệ, ví dụ 0912 345 678.'},
    {id: 'customer-address', error: 'address-error', validate: (value) => value.length >= 10, message: 'Bạn vui lòng nhập đủ địa chỉ nhận hàng.'}
  ];
  function validateField(field) {
    const element = $('#' + field.id);
    const value = element.value.normalize('NFC').trim();
    const valid = field.validate(value);
    $('#' + field.error).textContent = valid ? '' : field.message;
    element.setAttribute('aria-invalid', String(!valid));
    return valid;
  }
  fields.forEach((field) => $('#' + field.id).addEventListener('input', () => {
    if ($('#' + field.id).getAttribute('aria-invalid') === 'true') validateField(field);
  }));

  async function sendOrder() {
    if (!live || !orderApiReady() || !currentOrder || sending) return;
    sending = true;
    const button = $('.submit-order');
    const label = $('#submit-label');
    const status = $('.form-status');
    button.disabled = true;
    label.textContent = 'Đang gửi đơn hàng…';
    status.textContent = 'Đang gửi đơn hàng, vui lòng không đóng trang.';
    try {
      const query = new URLSearchParams(window.location.search);
      const attribution = {};
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach((key) => {
        if (query.has(key)) attribution[key] = query.get(key).slice(0, 200);
      });
      const submittedOrder = currentOrder;
      const result = await window.TFLOrders.submit({
        ...submittedOrder, attribution, idempotencyKey: submittedOrder.requestId
      }, {
        endpoint: config.orderEndpoint,
        transport: config.orderTransport,
        timeoutMs: config.orderTimeoutMs
      });
      let receiptSaved = false;
      try {
        window.sessionStorage.setItem('tfl:last-confirmed-order', JSON.stringify({
          orderId: String(result.orderId),
          quantity: submittedOrder.quantity,
          subtotal: submittedOrder.subtotal,
          shipping: submittedOrder.shipping,
          total: submittedOrder.total,
          currency: 'VND',
          confirmedAt: new Date().toISOString()
        }));
        receiptSaved = true;
      } catch (_) {}
      currentOrder = null;
      form.reset();
      selectBundle('1');
      status.textContent = 'Đơn hàng đã được ghi nhận. Đang chuyển đến trang Cảm ơn…';
      label.textContent = 'Đã nhận đơn hàng';
      let redirected = false;
      function showThankYou() {
        if (redirected || !receiptSaved) return;
        redirected = true;
        window.location.assign(new URL('cam-on.html', window.location.href).href);
      }
      document.dispatchEvent(new CustomEvent('tfl:order_received', {
        detail: {
          orderId: String(result.orderId),
          quantity: submittedOrder.quantity,
          acknowledged: true,
          ...(receiptSaved ? {onTracked: showThankYou} : {})
        }
      }));
      if (receiptSaved) setTimeout(showThankYou, 1200);
      else status.textContent = 'Cửa hàng đã nhận đơn hàng của bạn. Bạn không cần gửi lại.';
    } catch (error) {
      status.textContent = ['AbortError', 'TimeoutError'].includes(error.name)
        ? 'Chưa xác nhận được đơn hàng. Bạn có thể thử gửi lại.'
        : 'Chưa gửi được đơn hàng. Thông tin vẫn được giữ để bạn thử lại.';
      label.textContent = 'Thử gửi đơn hàng';
      button.disabled = false;
    } finally {
      sending = false;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!live || !orderApiReady()) { blockUnavailableCheckout(); return; }
    if (sending) return;
    const validity = fields.map((field) => validateField(field));
    if (validity.some((valid) => !valid)) {
      $('#' + fields[validity.indexOf(false)].id).focus();
      return;
    }
    const offer = config.offers[currentBundle];
    const nextOrder = {
      product: config.productName,
      sku: 'TFL-540-BLANC-50',
      customerName: $('#customer-name').value.normalize('NFC').trim(),
      phone: $('#customer-phone').value.replace(/[\s.()\-]/g, ''),
      address: $('#customer-address').value.normalize('NFC').trim(),
      note: $('#customer-note').value.normalize('NFC').trim(),
      quantity: offer.quantity,
      volumeMl: config.volumeMl,
      subtotal: offer.subtotal,
      shipping: offer.shipping,
      total: offer.subtotal + offer.shipping,
      currency: 'VND'
    };
    const previous = currentOrder && Object.fromEntries(
      Object.entries(currentOrder).filter(([key]) => key !== 'requestId')
    );
    const unchanged = previous && JSON.stringify(previous) === JSON.stringify(nextOrder);
    nextOrder.requestId = unchanged ? currentOrder.requestId : window.TFLOrders.randomId();
    currentOrder = nextOrder;
    checkoutStarted();
    sendOrder();
  });

  if (live) setCheckoutAvailable(true);
  else blockUnavailableCheckout();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      bar.classList.toggle('is-hidden', visible);
      bar.inert = visible;
    }, {threshold: 0.12});
    observer.observe($('.checkout-card'));
  }
})();
