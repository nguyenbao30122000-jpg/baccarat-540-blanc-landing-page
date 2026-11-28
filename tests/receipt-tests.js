'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../dist/app.js');
require('../dist/receipt.js');

const app = globalThis.TFLApp;
const api = globalThis.TFLReceipt;
const clone = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(label, fn) {
  try { fn(); checks += 1; }
  catch (error) { error.message = label + ': ' + error.message; throw error; }
}
const customer = {
  customerName: 'Nguyễn Minh An',
  phone: '0912345678',
  address: '12 Đường Hoa, Phường Bến Thành, Thành phố Hồ Chí Minh',
  note: 'Gọi trước khi giao.\nGửi lời chúc Tết cùng món quà.'
};
function payloadFor(offerId) {
  return app.buildPayload(offerId, customer, '304e130a-5a09-4f93-8ce0-019ea054f9f0');
}
function ackFor(payload) {
  return {success: true, schemaVersion: 2, receiverVersion: 2, orderId: 'TFL-OFFLINE-TEST',
    offerId: payload.offerId, quantity: payload.quantity, subtotal: payload.subtotal,
    shipping: payload.shipping, total: payload.total, currency: 'VND'};
}
function memoryStorage() {
  const values = new Map();
  return {getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key), values};
}

for (const offerId of ['white', 'red', 'duo']) {
  const payload = payloadFor(offerId);
  const receipt = api.create(payload, ackFor(payload));
  check(offerId + ' has complete customer, product and money details', () => {
    assert.equal(api.valid(receipt), true);
    for (const key of ['customerName', 'phone', 'address', 'note', 'offerId',
      'quantity', 'subtotal', 'shipping', 'total', 'currency']) {
      assert.equal(receipt[key], payload[key], key);
    }
    assert.deepEqual(receipt.items, payload.items);
    assert.equal(receipt.quantity, receipt.items.reduce((sum, item) => sum + item.quantity, 0));
    assert.equal(receipt.total, receipt.subtotal + receipt.shipping);
    assert.equal(receipt.orderId, 'TFL-OFFLINE-TEST');
    assert.equal(receipt.receiptVersion, 1);
    assert.equal(receipt.schemaVersion, 2);
    assert.equal(receipt.receiverVersion, 2);
    assert.equal(Object.hasOwn(receipt, 'attribution'), false);
    assert.equal(Object.hasOwn(receipt, 'idempotencyKey'), false);
  });
  check(offerId + ' stores and restores the exact confirmed receipt', () => {
    const storage = memoryStorage();
    assert.equal(api.save(storage, receipt), true);
    const restored = api.read(storage);
    assert.equal(restored.state, 'confirmed');
    assert.deepEqual(restored.receipt, receipt);
    assert.deepEqual(Array.from(storage.values.keys()), [api.storageKey]);
  });
}

const payload = payloadFor('duo');
const ack = ackFor(payload);
const good = api.create(payload, ack);
check('combo names and individual quantities remain distinguishable', () => {
  assert.deepEqual(good.items.map((item) => item.sku), ['TFL-540-BLANC-50', 'TFL-540-ROUGE-50']);
  assert.deepEqual(good.items.map((item) => item.quantity), [1, 1]);
  assert.equal(api.productNames['TFL-540-BLANC-50'], 'Baccarat 540 Pearl (Trắng)');
  assert.equal(api.productNames['TFL-540-ROUGE-50'], 'Baccarat 540 Ruby (Đỏ)');
});
check('customer request data cannot acquire a confirmation without server acknowledgement', () => {
  for (const result of [null, {}, {...ack, success: false}, {...ack, receiverVersion: 1},
    {...ack, schemaVersion: 1}, {...ack, orderId: ''}, {...ack, offerId: 'red'},
    {...ack, quantity: 1}, {...ack, total: 1}, {...ack, subtotal: 1}, {...ack, shipping: 1},
    {...ack, currency: 'USD'}]) {
    assert.throws(() => api.create(payload, result));
  }
});
check('an acknowledgement cannot validate a forged item list', () => {
  for (const items of [[], [{sku: 'UNKNOWN', quantity: 2, volumeMl: 50}],
    [payload.items[0], payload.items[0]],
    [{...payload.items[0], quantity: 2}, payload.items[1]],
    [{...payload.items[0], volumeMl: 70}, payload.items[1]]]) {
    assert.throws(() => api.create({...payload, items}, ack));
  }
});
check('create detaches the receipt from later form mutations', () => {
  const request = payloadFor('duo');
  const receipt = api.create(request, ackFor(request));
  request.items[0].sku = 'CHANGED';
  request.customerName = 'Changed after submission';
  assert.equal(receipt.items[0].sku, 'TFL-540-BLANC-50');
  assert.equal(receipt.customerName, customer.customerName);
});
check('corrupt, incomplete and mismatched receipts cannot render as confirmed', () => {
  const invalid = [null, [], {}, {...good, receiptVersion: 99}, {...good, offerId: 'red'},
    {...good, quantity: 1}, {...good, subtotal: 0}, {...good, shipping: 30000},
    {...good, total: 0}, {...good, currency: 'USD'}, {...good, customerName: ''},
    {...good, phone: '123'}, {...good, address: ''}, {...good, note: 'x'.repeat(251)},
    {...good, orderId: ''}, {...good, orderId: 'x'.repeat(121)},
    {...good, confirmedAt: 'not-a-date'}, {...good, confirmedAt: new Date(Date.now() + 3600000).toISOString()},
    {...good, items: []}, {...good, items: [{...good.items[0], quantity: 2}, good.items[1]]}];
  for (const value of invalid) assert.equal(api.valid(value), false, JSON.stringify(value));
});
check('missing and malformed browser storage never invents success', () => {
  const storage = memoryStorage();
  assert.deepEqual(api.read(storage), {state: 'missing', receipt: null});
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({...good, total: 1})]) {
    storage.setItem(api.storageKey, raw);
    const result = api.read(storage);
    assert.equal(result.state, 'invalid');
    assert.equal(result.receipt, null);
  }
});
check('storage blocked, full or silently rejected is reported to the caller', () => {
  const blocked = {getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }};
  assert.deepEqual(api.read(blocked), {state: 'unavailable', receipt: null});
  assert.equal(api.save(blocked, good), false);
  assert.equal(api.save({getItem() { return null; }, setItem() {}}, good), false);
  assert.equal(api.save({getItem() { return null; }, setItem() { throw new Error('QuotaExceededError'); }}, good), false);
});
check('invalid receipt is not written into the confirmation slot', () => {
  const storage = memoryStorage();
  assert.equal(api.save(storage, {...good, total: 1}), false);
  assert.equal(storage.getItem(api.storageKey), null);
});

// This DOM has no HTML parser or network. Any attempt to inject HTML fails the test.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.hidden = false;
    this.textContent = '';
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.classList = {add() {}, toggle() {}, contains() { return false; }};
  }
  set innerHTML(_) { throw new Error('Receipt must never interpolate customer HTML'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  focus() {}
}
const thankSource = fs.readFileSync(path.join(__dirname, '../dist/thank-you.js'), 'utf8');
function renderReceipt(storage) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  get('confirmed-receipt').hidden = true;
  get('empty-receipt').hidden = false;
  const document = {body: {dataset: {page: 'thank-you'}}, getElementById: get,
    createElement: (tag) => new Element(tag)};
  const window = {TFLApp: app, TFLReceipt: api, TFL_ASSET_BASE: 'dist/', sessionStorage: storage};
  vm.runInNewContext(thankSource, {window, document, Intl, Date});
  return {get, state: document.body.dataset.receiptState};
}
for (const offerId of ['white', 'red', 'duo']) {
  check(offerId + ' thank-you renders every requested field and item', () => {
    const payload = payloadFor(offerId);
    const receipt = api.create(payload, ackFor(payload));
    const storage = memoryStorage();
    api.save(storage, receipt);
    const page = renderReceipt(storage);
    assert.equal(page.state, 'confirmed');
    assert.equal(page.get('confirmed-receipt').hidden, false);
    assert.equal(page.get('empty-receipt').hidden, true);
    assert.equal(page.get('receipt-customer-name').textContent, customer.customerName);
    assert.equal(page.get('receipt-phone').textContent, customer.phone);
    assert.equal(page.get('receipt-address').textContent, customer.address);
    assert.equal(page.get('receipt-note').textContent, customer.note);
    assert.equal(page.get('receipt-quantity').textContent, receipt.quantity + ' chai · 50ml/chai');
    assert.equal(page.get('receipt-product-name').textContent, app.offers[offerId].name);
    assert.equal(page.get('receipt-subtotal').textContent, app.money(receipt.subtotal));
    assert.equal(page.get('receipt-shipping').textContent, receipt.shipping ? app.money(receipt.shipping) : 'Miễn phí');
    assert.equal(page.get('receipt-total').textContent, app.money(receipt.total));
    assert.equal(page.get('receipt-product-image').src, 'dist/' + app.offers[offerId].image);
    assert.equal(page.get('receipt-items').children.length, receipt.items.length);
    for (const [index, item] of receipt.items.entries()) {
      const row = page.get('receipt-items').children[index];
      assert.equal(row.children[0].children[0].textContent, api.productNames[item.sku]);
      assert.equal(row.children[0].children[1].textContent, 'Số lượng: ' + item.quantity + ' chai · 50ml');
      assert.equal(row.children[1].textContent, app.money(receipt.subtotal / receipt.quantity * item.quantity));
    }
  });
}
check('customer HTML-like values are displayed as text, never interpreted', () => {
  const payload = app.buildPayload('red', {...customer,
    customerName: '<b>Nguyễn An</b>', address: '12 Phố Hoa <script>alert(1)</script>',
    note: '<img src=x onerror=alert(1)>\nGiữ nguyên lời nhắn'}, 'offline-only');
  const storage = memoryStorage();
  assert.equal(api.save(storage, api.create(payload, ackFor(payload))), true);
  const page = renderReceipt(storage);
  assert.equal(page.get('receipt-customer-name').textContent, payload.customerName);
  assert.equal(page.get('receipt-address').textContent, payload.address);
  assert.equal(page.get('receipt-note').textContent, payload.note);
});
check('no note has an explicit readable placeholder', () => {
  const payload = app.buildPayload('white', {...customer, note: ''}, 'offline-only');
  const storage = memoryStorage();
  api.save(storage, api.create(payload, ackFor(payload)));
  assert.equal(renderReceipt(storage).get('receipt-note').textContent, 'Không có lời nhắn thêm.');
});
check('direct thank-you visits and invalid storage cannot show confirmation', () => {
  for (const raw of [null, '{', JSON.stringify({...good, offerId: 'unknown'})]) {
    const storage = memoryStorage();
    if (raw !== null) storage.setItem(api.storageKey, raw);
    const page = renderReceipt(storage);
    assert.notEqual(page.state, 'confirmed');
    assert.equal(page.get('confirmed-receipt').hidden, true);
    assert.equal(page.get('empty-receipt').hidden, false);
  }
  const blocked = renderReceipt({getItem() { throw new Error('SecurityError'); }});
  assert.equal(blocked.state, 'unavailable');
  assert.equal(blocked.get('confirmed-receipt').hidden, true);
});

async function submitInertForm(options = {}) {
  const storage = options.storage || memoryStorage();
  const events = [];
  const navigations = [];
  const timers = new Map();
  let timerId = 0;
  let submitted = 0;
  let submittedPayload;
  const fields = Object.fromEntries(Object.entries({...customer, website: ''}).map(([name, value]) => {
    const field = new Element('input');
    Object.assign(field, {name, value});
    return [name, field];
  }));
  const radios = ['white', 'red', 'duo'].map((value) => ({value, checked: value === (options.offerId || 'duo'), addEventListener() {}}));
  const form = new Element('form');
  form.elements = {namedItem: (name) => fields[name] || null};
  form.querySelectorAll = (selector) => selector === 'input[name="offer"]' ? radios : [];
  const ids = new Map(['submit-order', 'submit-text', 'form-status', 'checkout-note',
    'order-dialog', 'dialog-title', 'dialog-body', 'dialog-summary'].map((id) => [id, new Element()]));
  ids.set('order-form', form);
  ids.get('order-dialog').showModal = function () { this.open = true; };
  const document = {
    readyState: 'complete', body: {dataset: {}}, activeElement: null,
    getElementById: (id) => ids.get(id) || null,
    querySelectorAll: () => [], addEventListener() {},
    createElement: (tag) => new Element(tag),
    dispatchEvent: (event) => { events.push(event); }
  };
  const location = new URL('http://localhost:4173/');
  location.assign = (url) => { navigations.push(url); };
  const window = {
    TFL_CONFIG: {mode: options.live ? 'live' : 'preview', receiverVersion: 2,
      orderTransport: 'apps-script', orderEndpoint: 'https://script.google.com/macros/s/OFFLINE_ONLY/exec'},
    TFLReceipt: api, sessionStorage: storage,
    TFLOrders: {
      randomId: () => '304e130a-5a09-4f93-8ce0-019ea054f9f0',
      async submit(payload) {
        submitted += 1;
        if (!options.live) throw new Error('Preview cannot submit');
        submittedPayload = clone(payload);
        if (options.timeout) {
          const error = new Error('confirmation_timeout');
          error.name = 'TimeoutError';
          throw error;
        }
        return {...ackFor(payload), ...options.badAck};
      }
    },
    matchMedia: () => ({matches: true}), location
  };
  const source = fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8');
  vm.runInNewContext(source, {window, document, Intl, URL, URLSearchParams, AbortController,
    setTimeout(callback, delay) { timers.set(++timerId, {callback, delay}); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    async fetch(url, init) {
      if (!options.live) throw new Error('Preview cannot call the receiver');
      assert.equal(init.method, 'GET');
      assert.equal(new URL(url).searchParams.get('action'), 'health');
      return {ok: true, async json() {
        return {success: true, schemaVersion: options.healthVersion || 2, receiverVersion: options.healthVersion || 2, currency: 'VND', offers: app.offers};
      }};
    }});
  // Model a user submitting only after health enables the button. Cross-realm
  // promise assimilation takes several microtasks; no real clock or request runs.
  for (let index = 0; index < 30 && ids.get('submit-order').disabled; index += 1) await Promise.resolve();
  assert.equal(ids.get('submit-order').disabled, !options.live || options.healthVersion === 1, 'Only the valid live receiver enables checkout');
  await form.listeners.submit({preventDefault() {}});
  const runRedirects = () => {
    for (const [id, timer] of timers) {
      if (timer.delay <= 1000) { timers.delete(id); timer.callback(); }
    }
  };
  runRedirects();
  return {storage, events, navigations, ids, submittedPayload, get submitted() { return submitted; },
    async again() { await form.listeners.submit({preventDefault() {}}); runRedirects(); }};
}

async function checkApplicationFlow() {
  const preview = await submitInertForm();
  check('disabled mode cannot submit, confirm or redirect', () => {
    assert.equal(preview.submitted, 0);
    assert.equal(preview.storage.getItem(api.storageKey), null);
    assert.deepEqual(preview.navigations, []);
    assert.equal(preview.events.some((event) => event.type === 'tfl:order_received'), false);
    assert.equal(preview.ids.get('form-status').dataset.state, 'error');
    assert.equal(Boolean(preview.ids.get('order-dialog').open), false);
  });
  const legacy = await submitInertForm({live: true, healthVersion: 1});
  check('receiver v1 remains blocked in live configuration', () => {
    assert.equal(legacy.submitted, 0);
    assert.equal(legacy.ids.get('submit-order').disabled, true);
    assert.equal(legacy.storage.getItem(api.storageKey), null);
    assert.deepEqual(legacy.navigations, []);
    assert.equal(legacy.events.some(event => event.type === 'tfl:order_received'), false);
  });
  for (const offerId of ['white', 'red', 'duo']) {
    const live = await submitInertForm({live: true, offerId});
    check(offerId + ' real application stores full confirmed details before redirect', () => {
      assert.equal(live.submitted, 1, live.ids.get('form-status').textContent);
      const receipt = api.read(live.storage);
      assert.equal(receipt.state, 'confirmed');
      assert.equal(receipt.receipt.offerId, offerId);
      assert.equal(receipt.receipt.customerName, customer.customerName);
      assert.equal(receipt.receipt.phone, customer.phone);
      assert.equal(receipt.receipt.address, customer.address);
      assert.equal(receipt.receipt.note, customer.note);
      assert.deepEqual(live.navigations, ['http://localhost:4173/cam-on.html']);
      const received = live.events.filter((event) => event.type === 'tfl:order_received');
      assert.equal(received.length, 1);
      assert.equal(received[0].detail.acknowledged, true);
      for (const privateValue of Object.values(customer)) {
        assert.equal(JSON.stringify(received).includes(privateValue), false);
      }
    });
  }
  const rejected = await submitInertForm({live: true, badAck: {offerId: 'red'}});
  check('application refuses a mismatched acknowledgement without redirect or success event', () => {
    assert.equal(rejected.storage.getItem(api.storageKey), null);
    assert.deepEqual(rejected.navigations, []);
    assert.equal(rejected.events.some((event) => event.type === 'tfl:order_received'), false);
    assert.equal(rejected.ids.get('form-status').dataset.state, 'error');
  });
  const timedOut = await submitInertForm({live: true, timeout: true});
  check('timeout keeps the request unconfirmed and retains the form for retry', () => {
    assert.equal(timedOut.storage.getItem(api.storageKey), null);
    assert.deepEqual(timedOut.navigations, []);
    assert.equal(timedOut.events.some((event) => event.type === 'tfl:order_received'), false);
    assert.equal(timedOut.ids.get('form-status').dataset.state, 'error');
    assert.equal(timedOut.ids.get('submit-order').disabled, false);
  });
  const blocked = await submitInertForm({live: true,
    storage: {getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }}});
  await blocked.again();
  check('saved server order remains visible without resubmission when browser storage is blocked', () => {
    assert.equal(blocked.submitted, 1);
    assert.deepEqual(blocked.navigations, []);
    assert.equal(blocked.ids.get('form-status').dataset.state, 'success');
    const lines = blocked.ids.get('dialog-summary').children.map((line) => line.textContent).join('\n');
    for (const value of Object.values(customer)) assert.equal(lines.includes(value), true);
    assert.equal(lines.includes('998.000đ'), true);
    assert.equal(lines.includes('Bộ đôi Pearl + Ruby'), true);
  });
}

checkApplicationFlow().then(() => {
  console.log('Receipt: ' + checks + ' scenarios passed (complete details, exact ACK, correct totals, safe rendering, blocked storage and preview isolation). No network calls.');
}).catch((error) => { console.error(error); process.exitCode = 1; });
