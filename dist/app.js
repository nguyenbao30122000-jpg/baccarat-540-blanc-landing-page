(() => {
  'use strict';

  const root = typeof window === 'object' ? window : globalThis;
  const freezeOffer = (offer) => Object.freeze({
    ...offer,
    items: Object.freeze(offer.items.map((item) => Object.freeze(item)))
  });
  const OFFERS = Object.freeze({
    white: freezeOffer({id: 'white', name: 'Baccarat 540 Pearl (Trắng)', spec: '01 chai Pearl · Trắng · 50ml',
      image: 'assets/order-white.webp', quantity: 1, listPrice: 3995000, subtotal: 549000, shipping: 30000, total: 579000, savings: 3446000,
      items: [{sku: 'TFL-540-BLANC-50', volumeMl: 50, quantity: 1}]}),
    red: freezeOffer({id: 'red', name: 'Baccarat 540 Ruby (Đỏ)', spec: '01 chai Ruby · Đỏ · 50ml',
      image: 'assets/order-red.webp', quantity: 1, listPrice: 3995000, subtotal: 549000, shipping: 30000, total: 579000, savings: 3446000,
      items: [{sku: 'TFL-540-ROUGE-50', volumeMl: 50, quantity: 1}]}),
    duo: freezeOffer({id: 'duo', name: 'Bộ đôi Pearl + Ruby', spec: '01 Pearl (Trắng) + 01 Ruby (Đỏ) · 2 × 50ml',
      image: 'assets/order-duo.webp', quantity: 2, listPrice: 7990000, subtotal: 998000, shipping: 0, total: 998000, savings: 6992000,
      items: [{sku: 'TFL-540-BLANC-50', volumeMl: 50, quantity: 1},
        {sku: 'TFL-540-ROUGE-50', volumeMl: 50, quantity: 1}]})
  });
  const money = (value) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
  const tidy = (value) => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '';

  function normalizePhone(value) {
    let phone = typeof value === 'string' ? value.trim().replace(/[\s().-]/g, '') : '';
    phone = phone.replace(/^(?:\+84|0084)/, '0');
    return /^0[35789]\d{8}$/.test(phone) ? phone : '';
  }

  function validateCustomer(input) {
    const customerName = tidy(input.customerName);
    const phone = normalizePhone(input.phone);
    const address = tidy(input.address);
    const note = typeof input.note === 'string' ? input.note.normalize('NFC').trim() : '';
    const errors = {};
    if (customerName.length < 2 || customerName.length > 100) {
      errors.customerName = 'Nhập họ tên từ 2 đến 100 ký tự.';
    }
    if (!phone) errors.phone = 'Nhập số di động Việt Nam, ví dụ 0912 345 678.';
    if (address.length < 10 || address.length > 350) {
      errors.address = 'Nhập địa chỉ đầy đủ từ 10 đến 350 ký tự.';
    }
    if (note.length > 250) errors.note = 'Lời nhắn tối đa 250 ký tự.';
    return {valid: Object.keys(errors).length === 0, errors,
      value: {customerName, phone, address, note}};
  }

  function buildPayload(offerId, customer, idempotencyKey, attribution = {}) {
    const offer = OFFERS[offerId];
    if (!offer) throw new Error('invalid_offer');
    const checked = validateCustomer(customer);
    if (!checked.valid) throw new Error('invalid_customer');
    if (typeof idempotencyKey !== 'string' || !idempotencyKey) throw new Error('missing_request_id');
    return {schemaVersion: 2, offerId, currency: 'VND',
      items: offer.items.map((item) => ({...item})), quantity: offer.quantity,
      subtotal: offer.subtotal, shipping: offer.shipping, total: offer.total,
      ...checked.value, idempotencyKey, attribution};
  }

  function validateAck(result, payload) {
    return Boolean(result && result.success === true && result.schemaVersion === 2 &&
      result.receiverVersion === 2 && typeof result.orderId === 'string' &&
      result.orderId.length > 0 && result.orderId.length <= 120 &&
      result.offerId === payload.offerId && result.currency === 'VND' &&
      result.quantity === payload.quantity && result.subtotal === payload.subtotal &&
      result.shipping === payload.shipping && result.total === payload.total);
  }

  function validateHealth(health) {
    if (!health || !(health.success === true || health.ok === true) ||
      health.schemaVersion !== 2 || health.receiverVersion !== 2 || health.currency !== 'VND' ||
      !health.offers) return false;
    return Object.entries(OFFERS).every(([id, offer]) => {
      const remote = health.offers[id];
      return remote && remote.subtotal === offer.subtotal && remote.shipping === offer.shipping &&
        remote.total === offer.total;
    });
  }

  root.TFLApp = Object.freeze({offers: OFFERS, money, normalizePhone, validateCustomer,
    buildPayload, validateAck, validateHealth});
  if (typeof document === 'undefined') return;

  function initialize() {
    const form = document.getElementById('order-form');
    if (!form) return;
    const config = root.TFL_CONFIG || {};
    const isLive = config.mode === 'live';
    const reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const byId = (id) => document.getElementById(id);
    const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
    const submitButton = byId('submit-order');
    const formStatus = byId('form-status');
    const dialog = byId('order-dialog');
    const radios = Array.from(form.querySelectorAll('input[name="offer"]'));
    const inputs = ['customerName', 'phone', 'address', 'note'].map((name) => form.elements.namedItem(name)).filter(Boolean);
    let selected = radios.find((radio) => radio.checked)?.value || 'duo';
    if (!OFFERS[selected]) selected = 'duo';
    let busy = false;
    let healthReady = false;
    let hadValidation = false;
    let attempt = null;
    let confirmation = null;
    let previousFocus = null;
    form.noValidate = true;

    function status(message, state = '') {
      if (!formStatus) return;
      formStatus.textContent = message;
      formStatus.dataset.state = state;
    }

    function emitTracking(name, detail) {
      // Only catalog identifiers and ACK metadata enter analytics events.
      // Customer fields, request payloads and fingerprints stay in this module.
      try { document.dispatchEvent(new CustomEvent(name, {detail})); } catch (_) {}
    }

    function submitLabel() {
      if (busy) return 'Đang gửi yêu cầu…';
      if (!isLive) return 'Kiểm tra đơn hàng';
      return healthReady ? 'Gửi yêu cầu đặt hàng' : 'Chưa thể nhận đơn trực tuyến';
    }

    function updateSubmit() {
      setText('submit-text', submitLabel());
      if (submitButton) {
        submitButton.disabled = busy || (isLive && !healthReady);
        submitButton.setAttribute('aria-busy', busy ? 'true' : 'false');
      }
    }

    function selectOffer(id, announce = false, userInitiated = false) {
      if (!OFFERS[id] || busy || !radios.some((radio) => radio.value === id)) return;
      selected = id;
      const offer = OFFERS[id];
      radios.forEach((radio) => { radio.checked = radio.value === id; });
      document.querySelectorAll('[data-offer-card]').forEach((card) => {
        card.classList.toggle('is-selected', card.dataset.offerCard === id);
      });
      setText('order-name', offer.name);
      setText('order-spec', offer.spec);
      setText('order-price', money(offer.subtotal));
      setText('order-list-price', money(offer.listPrice));
      setText('order-shipping', offer.shipping ? money(offer.shipping) : 'Miễn phí');
      setText('order-total', money(offer.total));
      setText('sticky-name', offer.name);
      setText('sticky-price', money(offer.total));
      const savings = byId('order-savings');
      if (savings) {
        savings.textContent = offer.savings ? 'Ưu đãi Tết: tiết kiệm ' + money(offer.savings) + ' so với giá niêm yết' : '';
        savings.hidden = !offer.savings;
      }
      const image = byId('order-image');
      if (image) { image.src = (root.TFL_ASSET_BASE || '') + offer.image; image.alt = offer.name; }
      if (announce) {
        setText('selection-announcement', 'Đã chọn ' + offer.name + '. Tổng thanh toán ' + money(offer.total) + '.');
      }
      emitTracking('tfl:offer_selected', {offerId: id, userInitiated: userInitiated === true});
      updateSubmit();
    }

    function scrollCheckout() {
      const checkout = byId('dat-hang');
      if (checkout) checkout.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'});
    }

    document.querySelectorAll('[data-choose]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        selectOffer(button.dataset.choose, true, event.isTrusted);
        scrollCheckout();
      });
    });
    document.querySelectorAll('[data-checkout], #sticky-cta').forEach((button) => {
      button.addEventListener('click', (event) => { event.preventDefault(); scrollCheckout(); });
    });
    radios.forEach((radio) => radio.addEventListener('change', (event) => {
      if (radio.checked) selectOffer(radio.value, true, event.isTrusted);
    }));

    const menuButton = byId('menu-toggle');
    const menu = byId('mobile-nav');
    function closeMenu() {
      if (menu) menu.hidden = true;
      if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Mở menu');
      }
    }
    if (menu && menuButton) {
      menuButton.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        menuButton.setAttribute('aria-expanded', opening ? 'true' : 'false');
        menuButton.setAttribute('aria-label', opening ? 'Đóng menu' : 'Mở menu');
      });
      menu.querySelectorAll('a, [data-choose]').forEach((link) => link.addEventListener('click', closeMenu));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); }
      });
      document.addEventListener('click', (event) => {
        if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
      });
    }

    function readCustomer() {
      return Object.fromEntries(inputs.map((input) => [input.name, input.value]));
    }

    function paintErrors(errors) {
      inputs.forEach((input) => {
        const error = errors[input.name] || '';
        const slot = form.querySelector('[data-error-for="' + input.name + '"]') ||
          form.querySelector('[data-error-for="' + input.id + '"]');
        input.setAttribute('aria-invalid', error ? 'true' : 'false');
        if (slot) {
          slot.textContent = error;
          slot.hidden = !error;
          if (!slot.id) slot.id = 'error-' + input.name;
          const described = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
          if (error) described.add(slot.id); else described.delete(slot.id);
          if (described.size) input.setAttribute('aria-describedby', Array.from(described).join(' '));
          else input.removeAttribute('aria-describedby');
        }
      });
    }
    inputs.forEach((input) => input.addEventListener('input', () => {
      if (hadValidation) paintErrors(validateCustomer(readCustomer()).errors);
      if (!busy && (!isLive || healthReady)) status('');
    }));
    form.addEventListener('focusin', (event) => {
      if (event.isTrusted && isLive && healthReady && inputs.includes(event.target)) {
        emitTracking('tfl:checkout_started', {offerId: selected, ready: true});
      }
    });

    function showDialog(title, body, offer, orderId, customer) {
      setText('dialog-title', title);
      setText('dialog-body', body);
      const summary = byId('dialog-summary');
      if (summary) {
        summary.replaceChildren();
        const lines = [offer.name, offer.spec,
          'Tiền sản phẩm: ' + money(offer.subtotal),
          'Vận chuyển: ' + (offer.shipping ? money(offer.shipping) : 'Miễn phí'),
          'Tổng thanh toán: ' + money(offer.total)];
        if (customer) lines.push('Họ và tên: ' + customer.customerName,
          'Số điện thoại: ' + customer.phone, 'Địa chỉ: ' + customer.address,
          'Lời nhắn: ' + (customer.note || 'Không có lời nhắn thêm.'));
        if (orderId) lines.push('Mã yêu cầu: ' + orderId);
        lines.forEach((text) => {
          const line = document.createElement('p');
          line.textContent = text;
          summary.append(line);
        });
      }
      if (dialog && typeof dialog.showModal === 'function') {
        previousFocus = document.activeElement;
        if (!dialog.open) dialog.showModal();
      } else {
        status(title + '. ' + body, isLive ? 'success' : 'preview');
      }
    }

    function showConfirmation(offer, receipt) {
      status('Đã ghi nhận yêu cầu. Đang mở thông tin đơn hàng của bạn…', 'success');
      let saved = false;
      try { saved = root.TFLReceipt.save(root.sessionStorage, receipt); } catch (_) {}
      if (saved) {
        // Keep customer details in this tab's session, never in the URL or analytics.
        const receiptPath = form.dataset.receiptUrl === '../ruby-pearl/cam-on.html' ? form.dataset.receiptUrl : 'cam-on.html';
        setTimeout(() => root.location.assign(new URL(receiptPath, root.location.href).href), 600);
      } else {
        status('Cửa hàng đã ghi nhận yêu cầu. Bạn không cần gửi lại.', 'success');
        showDialog('Đã nhận yêu cầu của bạn',
          'Thông tin đơn hàng của bạn ở bên dưới. Cửa hàng sẽ liên hệ để xác nhận giao hàng.',
          offer, receipt.orderId, receipt);
      }
    }
    document.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => { if (dialog && dialog.open) dialog.close(); });
    });
    if (dialog) {
      dialog.addEventListener('close', () => { if (previousFocus?.isConnected) previousFocus.focus(); });
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
    }

    function attribution() {
      const query = new URLSearchParams(root.location.search);
      const values = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((key) => {
        const value = query.get(key);
        if (value) values[key] = value.slice(0, 200);
      });
      return values;
    }

    function uuid() {
      if (root.TFLOrders?.randomId) return root.TFLOrders.randomId();
      if (root.crypto?.randomUUID) return root.crypto.randomUUID();
      throw new Error('secure_random_unavailable');
    }

    async function healthCheck() {
      healthReady = false;
      updateSubmit();
      if (!isLive) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(config.orderTimeoutMs || 30000, 15000));
      try {
        if (config.receiverVersion !== 2 || config.orderTransport !== 'apps-script') throw new Error('receiver_not_ready');
        const url = new URL(config.orderEndpoint);
        if (url.origin !== 'https://script.google.com' ||
          !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) || url.search || url.hash) {
          throw new Error('invalid_endpoint');
        }
        url.searchParams.set('action', 'health');
        const response = await fetch(url.href, {method: 'GET', credentials: 'omit',
          cache: 'no-store', signal: controller.signal});
        if (!response.ok || !validateHealth(await response.json())) throw new Error('receiver_not_ready');
        healthReady = true;
        status('');
      } catch (_) {
        status('Hệ thống nhận đơn đang được cập nhật. Bạn vui lòng quay lại sau.', 'error');
      } finally {
        clearTimeout(timeout);
        updateSubmit();
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      const trap = form.elements.namedItem('website');
      if (trap && trap.value) { status('Không thể gửi yêu cầu. Vui lòng thử lại.', 'error'); return; }
      hadValidation = true;
      const checked = validateCustomer(readCustomer());
      paintErrors(checked.errors);
      if (!checked.valid) {
        status('Bạn kiểm tra lại các thông tin được đánh dấu nhé.', 'error');
        inputs.find((input) => checked.errors[input.name])?.focus();
        return;
      }
      const offer = OFFERS[selected];
      if (!isLive) {
        status('Đã kiểm tra thông tin trên bản xem trước. Chưa gửi đơn hàng.', 'preview');
        showDialog('Kiểm tra đơn hàng',
          'Đây là bản xem trước. Thông tin chỉ được kiểm tra trên trình duyệt; chưa gửi đến cửa hàng và chưa tạo đơn hàng.', offer, null, checked.value);
        return;
      }
      if (!healthReady || !root.TFLOrders?.submit) {
        status('Hệ thống nhận đơn chưa sẵn sàng. Vui lòng liên hệ cửa hàng.', 'error');
        return;
      }
      emitTracking('tfl:checkout_started', {offerId: selected, ready: true});
      const fingerprint = JSON.stringify({offerId: selected, ...checked.value});
      if (confirmation && confirmation.fingerprint === fingerprint) {
        showConfirmation(offer, confirmation.receipt);
        return;
      }
      busy = true;
      updateSubmit();
      radios.forEach((radio) => { radio.disabled = true; });
      inputs.forEach((input) => { input.readOnly = true; });
      status('Đang gửi yêu cầu. Bạn vui lòng giữ trang này mở.', 'pending');
      try {
        if (!attempt || attempt.fingerprint !== fingerprint) attempt = {fingerprint, key: uuid()};
        const payload = buildPayload(selected, checked.value, attempt.key, attribution());
        const result = await root.TFLOrders.submit(payload, {
          endpoint: config.orderEndpoint, transport: config.orderTransport,
          timeoutMs: config.orderTimeoutMs || 30000
        });
        if (!validateAck(result, payload)) throw new Error('unconfirmed');
        const receipt = root.TFLReceipt.create(payload, result);
        confirmation = {fingerprint, orderId: result.orderId, receipt};
        emitTracking('tfl:order_received', {offerId: payload.offerId, orderId: result.orderId,
          acknowledged: true, schemaVersion: 2, receiverVersion: 2});
        showConfirmation(offer, receipt);
      } catch (error) {
        const uncertain = error?.name === 'TimeoutError' || error?.name === 'AbortError' ||
          error?.message === 'confirmation_timeout' || error?.message === 'unconfirmed';
        status(uncertain
          ? 'Chưa nhận được xác nhận từ cửa hàng. Bạn có thể gửi lại với thông tin giữ nguyên; hệ thống dùng cùng mã yêu cầu để tránh tạo đơn trùng.'
          : 'Chưa thể xác nhận yêu cầu. Vui lòng thử lại hoặc liên hệ cửa hàng.', 'error');
      } finally {
        busy = false;
        radios.forEach((radio) => { radio.disabled = false; });
        inputs.forEach((input) => { input.readOnly = false; });
        updateSubmit();
      }
    });

    const sticky = byId('sticky-buy');
    const checkout = byId('dat-hang');
    if (sticky && checkout && 'IntersectionObserver' in root) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          // Tall checkout sections rarely reach a high ratio. Actual visible height
          // is a more useful measure of whether the order panel is on screen.
          const visibleEnough = entry.isIntersecting && entry.intersectionRect.height >= Math.min(260, root.innerHeight * 0.4);
          sticky.classList.toggle('is-hidden', visibleEnough);
          sticky.setAttribute('aria-hidden', visibleEnough ? 'true' : 'false');
          sticky.inert = visibleEnough;
        }
      }, {threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1]});
      observer.observe(checkout);
    }

    const reveals = document.querySelectorAll('[data-reveal]');
    if (!reducedMotion && 'IntersectionObserver' in root) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, {threshold: 0.08});
      reveals.forEach((element) => observer.observe(element));
    } else reveals.forEach((element) => element.classList.add('is-visible'));

    selectOffer(selected);
    const checkoutNote = byId('checkout-note');
    const noteText = checkoutNote && (checkoutNote.querySelector('span') || checkoutNote);
    if (!isLive) {
      if (noteText) noteText.textContent = 'Bản xem trước: bạn có thể kiểm tra lựa chọn và thông tin. Đơn hàng chưa được gửi đến cửa hàng.';
      updateSubmit();
    } else {
      if (noteText) noteText.textContent = 'Gửi yêu cầu để cửa hàng liên hệ xác nhận sản phẩm, tổng tiền và địa chỉ giao hàng. Chỉ điền thông tin cần thiết cho đơn hàng.';
      healthCheck();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
