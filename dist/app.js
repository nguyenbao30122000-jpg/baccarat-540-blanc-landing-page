(() => {
  'use strict';
  const config = window.TFL_CONFIG;
  if (!config) return;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const money = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  const form = $('#order-form');
  const dialog = $('#order-dialog');
  const bar = $('.mobile-buybar');
  const menuToggle = $('.menu-toggle');
  const menu = $('#mobile-menu');
  let currentBundle = '1';
  let currentOrder = null;
  let lastFocused = null;
  let sending = false;
  const live = config.mode === 'live' && typeof config.orderEndpoint === 'string' && /^https:\/\//.test(config.orderEndpoint);

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

  function detailRow(label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    return row;
  }
  function closeDialog() {
    if (sending) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.body.classList.remove('dialog-open');
    if (lastFocused) lastFocused.focus({preventScroll: true});
  }
  function displayReview(order) {
    const details = $('#dialog-details');
    details.replaceChildren();
    [
      ['Sản phẩm', config.productName],
      ['Số lượng', order.quantity + ' chai × ' + config.volumeMl + 'ml'],
      ['Họ và tên', order.customerName],
      ['Điện thoại', order.phone],
      ['Địa chỉ', order.address],
      ...(order.note ? [['Ghi chú', order.note]] : []),
      ['Tiền sản phẩm', money(order.subtotal)],
      ['Vận chuyển', order.shipping ? money(order.shipping) : 'Miễn phí'],
      ['Tổng thanh toán', money(order.total)]
    ].forEach(([label, value]) => details.append(detailRow(label, value)));
    $('#dialog-title').innerHTML = 'Lựa chọn<br><em>của bạn.</em>';
    $('#dialog-intro').textContent = 'Kiểm tra thông tin cho trải nghiệm của bạn.';
    $('#dialog-status').textContent = '';
    $('#dialog-primary').textContent = live ? 'Xác nhận đặt hàng' : 'Tiếp tục khám phá';
    $('#dialog-primary').disabled = false;
    $('#dialog-edit').hidden = false;
    $('.dialog-demo-note').hidden = live;
    lastFocused = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('dialog-open');
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
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
    // Keep the request ID when reviewing an unchanged order after a timeout.
    const previous = currentOrder && Object.fromEntries(
      Object.entries(currentOrder).filter(([key]) => key !== 'requestId')
    );
    const unchanged = previous && JSON.stringify(previous) === JSON.stringify(nextOrder);
    nextOrder.requestId = unchanged ? currentOrder.requestId : window.TFLOrders.randomId();
    currentOrder = nextOrder;
    checkoutStarted();
    displayReview(currentOrder);
  });
  $('.dialog-close').addEventListener('click', closeDialog);
  $('#dialog-edit').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', (event) => {
    if (sending) event.preventDefault();
    else document.body.classList.remove('dialog-open');
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  }});
  $('#dialog-primary').addEventListener('click', async () => {
    if (!live || !currentOrder) { closeDialog(); return; }
    if (sending) return;
    sending = true;
    const button = $('#dialog-primary');
    const status = $('#dialog-status');
    button.disabled = true;
    button.textContent = 'Đang gửi thông tin…';
    status.textContent = '';
    try {
      const query = new URLSearchParams(window.location.search);
      const attribution = {};
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach((key) => { if (query.has(key)) attribution[key] = query.get(key).slice(0,200); });
      const submittedOrder = currentOrder;
      const result = await window.TFLOrders.submit({
        ...submittedOrder,
        attribution,
        idempotencyKey: submittedOrder.requestId
      }, {
        endpoint: config.orderEndpoint,
        transport: config.orderTransport,
        timeoutMs: config.orderTimeoutMs
      });
      $('#dialog-title').innerHTML = 'Đã nhận<br><em>yêu cầu của bạn.</em>';
      $('#dialog-intro').textContent = 'Mã đơn: ' + String(result.orderId);
      status.textContent = 'Thông tin đã được gửi đến cửa hàng.';
      $('#dialog-edit').hidden = true;
      currentOrder = null;
      button.textContent = 'Đóng';
      document.dispatchEvent(new CustomEvent('tfl:order_received', {
        detail: {orderId: String(result.orderId), quantity: submittedOrder.quantity, acknowledged: true}
      }));
      form.reset();
      selectBundle('1');
    } catch (error) {
      status.textContent = ['AbortError', 'TimeoutError'].includes(error.name) ? 'Chưa xác nhận được trạng thái gửi đơn. Bạn có thể thử lại; mã yêu cầu được giữ nguyên.' : 'Chưa gửi được đơn hàng. Thông tin vẫn còn trên trang để bạn thử lại.';
      button.textContent = 'Thử gửi lại';
    } finally {
      sending = false;
      button.disabled = false;
    }
  });

  if (live) {
    $('#submit-label').textContent = 'Xem lại và đặt hàng';
    $('#form-mode-notice').textContent = 'Thông tin bạn cung cấp được dùng để xử lý yêu cầu đặt hàng.';
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      bar.classList.toggle('is-hidden', visible);
      bar.inert = visible;
    }, {threshold: 0.12});
    observer.observe($('.checkout-card'));
  }
})();
