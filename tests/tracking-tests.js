'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../dist/app.js');
const app = globalThis.TFLApp;
const trackingSource = fs.readFileSync(path.join(__dirname, '../dist/tracking.js'), 'utf8');
const configSource = fs.readFileSync(path.join(__dirname, '../dist/config.js'), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;
const check = (test) => { test(); checks += 1; };

// Scripts are inert mock objects. This harness cannot load tags or send requests.
function setup(options = {}) {
  const scripts = [];
  const attributes = {};
  const handlers = {};
  class Element {
    constructor() { this.dataset = {}; this.listeners = {}; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    closest() { return null; }
  }
  const document = {
    documentElement: {setAttribute: (name, value) => { attributes[name] = value; }},
    body: {dataset: options.thankYou ? {page: 'thank-you'} : {}},
    referrer: options.referrer || 'https://example.com/ad?private=ignored',
    head: {appendChild: (script) => { scripts.push(script); }},
    createElement: () => new Element(),
    getElementById: () => ({classList: {contains: (name) => name === 'rr-block' && options.blockedForm !== false}}),
    addEventListener: (name, handler) => { (handlers[name] ||= []).push(handler); }
  };
  const window = {location: new URL(options.url || 'https://thefragrancelabperfume.shop/'), TFLApp: app};
  window.self = window;
  window.top = options.iframe ? {} : window;
  const context = vm.createContext({window, document, URL, URLSearchParams, Element});
  vm.runInContext(configSource, context);
  window.TFL_CONFIG = {...window.TFL_CONFIG, ...options.config};
  vm.runInContext(trackingSource, context);
  return {window, document, scripts, attributes, Element,
    repeat: () => vm.runInContext(trackingSource, context),
    emit: (name, detail) => (handlers[name] || []).forEach((handler) => handler({detail})),
    click: (event) => (handlers.click || []).forEach((handler) => handler(event)),
    ga: (name) => plain((window.dataLayer || []).filter((args) => args[0] === 'event' && args[1] === name).map((args) => args[2])),
    meta: (name) => plain((window.fbq?.queue || []).filter((args) => ['track', 'trackCustom'].includes(args[0]) && args[1] === name).map((args) => args[2])),
    telemetry: () => JSON.stringify({ga: window.dataLayer || [], meta: window.fbq?.queue || []})
  };
}

check(() => {
  for (const options of [{url: 'http://localhost:3000/'}, {url: 'https://localhost/'},
    {url: 'https://private-preview.chatgpt.site/'}, {url: 'http://thefragrancelabperfume.shop/'},
    {iframe: true}, {config: {trackingEnabled: false}}]) {
    const page = setup(options);
    assert.equal(page.scripts.length, 0);
    assert.equal(page.ga('page_view').length, 0);
    assert.equal(page.meta('PageView').length, 0);
    assert.equal(page.attributes['data-tfl-replay'], 'disabled');
  }
});

check(() => {
  const page = setup({url: 'https://www.thefragrancelabperfume.shop/?utm_source=facebook&utm_campaign=duo#dat-hang'});
  page.repeat();
  assert.equal(page.window.TFL_CONFIG.mode, 'preview');
  assert.equal(page.window.TFL_CONFIG.analyticsId, 'G-YNKR6EDF5D');
  assert.equal(page.window.TFL_CONFIG.metaPixelId, '4503743036565644');
  assert.equal(page.scripts.length, 3);
  assert.equal(page.ga('page_view').length, 1);
  assert.equal(page.meta('PageView').length, 1);
  assert.equal(page.ga('page_view')[0].page_location, 'https://www.thefragrancelabperfume.shop/');
  assert.equal(page.ga('page_view')[0].page_referrer, 'https://example.com/');
  const pixelInit = Array.from(page.window.fbq.queue.find((args) => args[0] === 'init'));
  assert.deepEqual(pixelInit, ['init', '4503743036565644']);
  const autoConfig = Array.from(page.window.fbq.queue.find((args) => args[0] === 'set'));
  assert.deepEqual(autoConfig, ['set', 'autoConfig', false, '4503743036565644']);
});

const privateFields = {customerName: 'Private Customer Test', phone: '0912345678',
  email: 'customer@example.invalid', address: '123 Private Address Test', note: 'Private Note Test'};
function assertNoCustomerData(page) {
  const telemetry = page.telemetry();
  for (const value of Object.values(privateFields)) assert.equal(telemetry.includes(value), false);
  for (const key of Object.keys(privateFields)) assert.equal(telemetry.includes('"' + key + '"'), false);
}

check(() => {
  const page = setup();
  page.emit('tfl:offer_selected', {offerId: 'duo', userInitiated: false});
  for (const offerId of ['white', 'red', 'duo']) {
    page.emit('tfl:offer_selected', {offerId, userInitiated: true, ...privateFields});
  }
  assert.equal(page.ga('view_item').length, 1);
  assert.equal(page.meta('ViewContent').length, 1);
  const events = page.ga('select_offer');
  assert.deepEqual(events.map((event) => event.offer_id), ['white', 'red', 'duo']);
  assert.deepEqual(events.map((event) => event.items.map((item) => item.item_id)),
    [['TFL-540-BLANC-50'], ['TFL-540-ROUGE-50'], ['TFL-540-BLANC-50', 'TFL-540-ROUGE-50']]);
  for (const event of events) {
    assert.equal(event.value, event.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    assert.equal(event.quantity, event.items.reduce((sum, item) => sum + item.quantity, 0));
  }
  assert.deepEqual(events[2].items.map((item) => [item.price, item.discount, item.quantity]),
    [[499000, 50000, 1], [499000, 50000, 1]]);
  assert.equal(page.meta('SelectOffer')[2].num_items, 2);
  assertNoCustomerData(page);
});

const accepted = {offerId: 'duo', orderId: 'TFL-TEST-ACK-ONLY', acknowledged: true,
  schemaVersion: 2, receiverVersion: 2};
check(() => {
  const page = setup();
  page.emit('tfl:checkout_started', {offerId: 'duo', ready: true});
  page.emit('tfl:order_received', accepted);
  assert.equal(page.ga('begin_checkout').length, 0);
  assert.equal(page.meta('InitiateCheckout').length, 0);
  assert.equal(page.ga('generate_lead').length, 0);
  assert.equal(page.meta('Lead').length, 0);
});

check(() => {
  const page = setup({config: {mode: 'live'}});
  for (const invalid of [{acknowledged: false}, {schemaVersion: 1}, {receiverVersion: 1},
    {orderId: ''}, {offerId: 'legacy'}, {orderId: 'x'.repeat(121)}]) {
    page.emit('tfl:order_received', {...accepted, ...invalid});
  }
  assert.equal(page.ga('generate_lead').length, 0);
  assert.equal(page.meta('Lead').length, 0);
  page.emit('tfl:checkout_started', {offerId: 'red', ready: false});
  page.emit('tfl:checkout_started', {offerId: 'red', ready: true});
  page.emit('tfl:checkout_started', {offerId: 'red', ready: true});
  assert.equal(page.ga('begin_checkout').length, 1);
  assert.equal(page.meta('InitiateCheckout')[0].content_ids[0], 'TFL-540-ROUGE-50');
  page.emit('tfl:order_received', {...accepted, ...privateFields});
  page.emit('tfl:order_received', accepted);
  assert.equal(page.ga('generate_lead').length, 1);
  assert.equal(page.meta('Lead').length, 1);
  assert.equal(page.ga('generate_lead')[0].value, 998000);
  assert.deepEqual(page.meta('Lead')[0].content_ids, ['TFL-540-BLANC-50', 'TFL-540-ROUGE-50']);
  assert.equal(page.telemetry().includes(accepted.orderId), false);
  assert.equal(page.ga('purchase').length, 0);
  assertNoCustomerData(page);
  const oldReceipt = setup({config: {mode: 'live'}, thankYou: true});
  oldReceipt.emit('tfl:order_received', accepted);
  assert.equal(oldReceipt.ga('generate_lead').length, 0);
});

check(() => {
  const page = setup();
  const link = new page.Element();
  link.dataset.choose = 'red';
  link.closest = (selector) => selector === 'header' ? link : null;
  const target = new page.Element();
  target.closest = () => link;
  page.click({target, isTrusted: false});
  assert.equal(page.ga('cta_click').length, 0);
  page.click({target, isTrusted: true});
  assert.equal(page.ga('cta_click')[0].placement, 'header');
  assert.equal(page.ga('cta_click')[0].items[0].item_id, 'TFL-540-ROUGE-50');
  assert.equal(page.meta('CTA_Click').length, 1);
});

check(() => {
  const page = setup({url: 'https://thefragrancelabperfume.shop/?utm_source=facebook&utm_content=customer%40example.invalid&phone=0912345678'});
  const configCall = page.window.dataLayer.find((args) => args[0] === 'config');
  assert.equal(configCall[2].campaign_source, 'facebook');
  assert.equal(configCall[2].campaign_content, undefined);
  assert.equal(page.ga('page_view')[0].page_location, 'https://thefragrancelabperfume.shop/');
  assert.equal(page.attributes['data-tfl-pixel'], 'privacy-blocked');
  assert.equal(page.attributes['data-tfl-replay'], 'privacy-blocked');
  assert.equal(page.scripts.length, 1);
  assertNoCustomerData(page);
});

check(() => {
  const page = setup({blockedForm: false});
  assert.equal(page.attributes['data-tfl-replay'], 'privacy-blocked');
  assert.equal(page.scripts.some((script) => script.id === 'tfl-session-replay'), false);
  assert.equal(page.ga('page_view').length, 1);
  assert.equal(page.meta('PageView').length, 1);
});

check(() => {
  const page = setup();
  const calls = [];
  page.window.TNANOReplay = {initReplay: (options) => { calls.push(plain(options)); }};
  const script = page.scripts.find((entry) => entry.id === 'tfl-session-replay');
  assert.equal(script.src, 'https://tnano-session-replay.baovan-tnano.workers.dev/recorder/tnano-replay.js');
  script.listeners.load();
  script.listeners.load();
  assert.deepEqual(calls, [{endpoint: 'https://tnano-session-replay.baovan-tnano.workers.dev'}]);
});

console.log('Tracking: ' + checks + ' scenarios passed (production gates, exact offers, no PII, no preview conversions, ACK deduplication, replay contract). No network calls.');
