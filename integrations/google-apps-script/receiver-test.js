'use strict';

// Offline tests only. All Google services are in-memory mocks; no network use.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const ORIGIN = 'https://thefragrancelabperfume.shop';
const WHITE = 'TFL-540-BLANC-50';
const RED = 'TFL-540-ROUGE-50';
const LEGACY_HEADERS = [
  'Thoi_gian_VN', 'Ma_don', 'Idempotency_key', 'Payload_hash', 'Trang_thai',
  'San_pham', 'SKU', 'Dung_tich_ml', 'So_luong', 'Tien_san_pham',
  'Phi_van_chuyen', 'Tong_thanh_toan', 'Tien_te', 'Ho_va_ten',
  'Dien_thoai', 'Dia_chi', 'Ghi_chu', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_content', 'utm_term', 'Nguon_website'
];

function harness() {
  const state = {sheets: new Map(), properties: {}, busy: false, locked: false,
    releases: 0, flushFails: false, flushes: 0, logs: [], writes: 0};
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.columns = 26; }
    getName() { return this.name; }
    getLastRow() { return this.rows.length; }
    getMaxColumns() { return this.columns; }
    insertColumnsAfter(start, n) { this.columns += n; }
    setFrozenRows(n) { this.frozenRows = n; }
    appendRow(row) { assert.equal(state.locked, true); this.rows.push(copy(row)); state.writes++; }
    getRange(row, col, count, width) {
      const sheet = this;
      return {
        setValues(values) {
          assert.equal(state.locked, true);
          values.forEach((r, i) => {
            if (!sheet.rows[row - 1 + i]) sheet.rows[row - 1 + i] = [];
            r.forEach((v, j) => { sheet.rows[row - 1 + i][col - 1 + j] = v; });
          });
        },
        getValues() {
          return Array.from({length: count}, (_, i) =>
            Array.from({length: width}, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
        },
        getDisplayValues() { return this.getValues().map(r => r.map(String)); },
        createTextFinder(text) {
          return {
            matchEntireCell() { return this; }, matchCase() { return this; },
            findNext() {
              for (let r = row - 1; r < row - 1 + count; r++) {
                if (String(sheet.rows[r]?.[col - 1]).toLowerCase() === text.toLowerCase()) {
                  return {getRow: () => r + 1};
                }
              }
              return null;
            }
          };
        }
      };
    }
  }
  const spreadsheet = {
    getSheetByName: name => state.sheets.get(name) || null,
    insertSheet(name) { const sheet = new Sheet(name); state.sheets.set(name, sheet); return sheet; }
  };
  const output = text => ({text, setMimeType() { return this; }, setXFrameOptionsMode() { return this; }});
  const context = vm.createContext({
    console: {error: message => state.logs.push(message)},
    PropertiesService: {getScriptProperties: () => ({getProperty: key => state.properties[key] || null})},
    SpreadsheetApp: {
      openById: () => spreadsheet,
      flush() { state.flushes++; if (state.flushFails) throw new Error('mock flush failure'); }
    },
    LockService: {getScriptLock: () => ({
      tryLock() { if (state.busy || state.locked) return false; state.locked = true; return true; },
      releaseLock() { state.locked = false; state.releases++; }
    })},
    Utilities: {
      getUuid: crypto.randomUUID,
      formatDate: () => '2026-11-26 19:30:00',
      DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'},
      computeDigest: (algorithm, input) => Array.from(crypto.createHash(algorithm).update(input).digest())
    },
    ContentService: {createTextOutput: output, MimeType: {JSON: 'application/json'}},
    HtmlService: {createHtmlOutput: output, XFrameOptionsMode: {ALLOWALL: 'allowall'}}
  });
  vm.runInContext(source, context, {filename: 'Code.gs'});
  return {
    state, context, spreadsheet,
    call(name, ...args) { return context[name](...args); },
    sheet() { return state.sheets.get(state.properties.ORDER_SHEET_NAME || 'Don_hang_Web'); }
  };
}

function payload(offerId = 'white', key = crypto.randomUUID()) {
  const duo = offerId === 'duo';
  return {
    schemaVersion: 2, offerId, currency: 'VND', idempotencyKey: key,
    items: (duo ? [WHITE, RED] : [offerId === 'red' ? RED : WHITE])
      .map(sku => ({sku, volumeMl: 50, quantity: 1})),
    quantity: duo ? 2 : 1, subtotal: duo ? 998000 : 549000,
    shipping: duo ? 0 : 30000, total: duo ? 998000 : 579000,
    customerName: 'Khách Kiểm Thử', phone: '+84 901 234 567',
    address: '123 Đường Kiểm Thử, phường Mẫu, Thanh Hóa', note: '',
    attribution: {utm_source: 'offline-test'}
  };
}

function eventFor(p, override = {}) {
  return {parameter: {
    responseMode: 'bridge', parentOrigin: ORIGIN, requestId: p.idempotencyKey,
    responseToken: 'offline_test_token_01234567890123456789', payload: JSON.stringify(p), ...override
  }};
}

function response(result) {
  if (result.text.startsWith('{')) return JSON.parse(result.text);
  const match = result.text.match(/var data=(.*?);var origin=/s);
  assert.ok(match, 'Bridge ACK must embed explicit result data');
  return JSON.parse(match[1]);
}

function rejects(h, input, code) {
  assert.throws(() => h.call('validateOrder_', input), error => error.tflCode === code);
}

const tests = [];
const test = (name, run) => tests.push({name, run});

test('health advertises exact v2 capabilities and all three server prices', () => {
  const h = harness();
  const result = response(h.call('doGet', {parameter: {action: 'health'}}));
  assert.equal(result.success, true);
  assert.equal(result.receiverVersion, 2);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.currency, 'VND');
  assert.deepEqual(result.capabilities.offerIds, ['white', 'red', 'duo']);
  assert.equal(result.offers.white.total, 579000);
  assert.equal(result.offers.red.total, 579000);
  assert.equal(result.offers.duo.total, 998000);
  assert.equal(result.offers.duo.discount, 100000);
  assert.equal(h.state.writes, 0);
});

test('each offer produces distinct authoritative itemized amounts', () => {
  const h = harness();
  for (const id of ['white', 'red', 'duo']) {
    const order = copy(h.call('validateOrder_', payload(id)));
    assert.equal(order.quantity, id === 'duo' ? 2 : 1);
    assert.equal(order.total, id === 'duo' ? 998000 : 579000);
    assert.equal(order.phone, '0901234567');
    assert.equal(order.items[0].sku, id === 'red' ? RED : WHITE);
    assert.equal(order.retailSubtotal - order.discount, order.subtotal);
    if (id === 'duo') assert.equal(order.items[1].sku, RED);
  }
});

test('tampered or non-integer client price fields cannot change stored totals', () => {
  const h = harness();
  for (const field of ['subtotal', 'shipping', 'total']) {
    for (const value of [0, -1, '579000', 0.1, null, Number.MAX_SAFE_INTEGER + 1]) {
      const p = payload(); p[field] = value;
      rejects(h, p, 'PRICE_CHANGED');
    }
  }
  assert.equal(h.state.writes, 0);
});

test('rejects unknown, duplicated and mismatched SKUs, volumes and quantities', () => {
  const h = harness();
  const cases = [
    p => { p.items[0].sku = 'OTHER'; },
    p => { p.items[0].volumeMl = 70; },
    p => { p.items[0].volumeMl = '50'; },
    p => { p.items[0].quantity = 2; },
    p => { p.items[0].unitPrice = 1; },
    p => { p.items = []; },
    p => { p.items[0] = null; }
  ];
  for (const mutate of cases) { const p = payload(); mutate(p); rejects(h, p, 'INVALID_PRODUCT'); }
  const duplicate = payload('duo'); duplicate.items[1] = copy(duplicate.items[0]);
  rejects(h, duplicate, 'INVALID_PRODUCT');
  const quantity = payload(); quantity.quantity = 2;
  rejects(h, quantity, 'INVALID_QUANTITY');
  for (const offerId of ['unknown', '__proto__', 'constructor']) {
    const p = payload(); p.offerId = offerId; rejects(h, p, 'INVALID_OFFER');
  }
});

test('rejects legacy schema, invalid customer fields and unexpected fields', () => {
  const h = harness();
  const old = payload(); old.schemaVersion = 1; rejects(h, old, 'UNSUPPORTED_SCHEMA');
  const extra = payload(); extra.sku = WHITE; rejects(h, extra, 'INVALID_REQUEST');
  const phone = payload(); phone.phone = '01234567890'; rejects(h, phone, 'INVALID_PHONE');
  const name = payload(); name.customerName = '123'; rejects(h, name, 'INVALID_CUSTOMER');
  const address = payload(); address.address = 'x'; rejects(h, address, 'INVALID_CUSTOMER');
  const note = payload(); note.note = 'x'.repeat(251); rejects(h, note, 'INVALID_CUSTOMER');
  const currency = payload(); currency.currency = 'USD'; rejects(h, currency, 'INVALID_OFFER');
});

test('parsing rejects malformed, oversized and non-record payloads before any write', () => {
  const h = harness();
  for (const raw of ['{', '[]', 'null', '"string"', 'x'.repeat(12001)]) {
    const e = eventFor(payload()); e.parameter.payload = raw;
    assert.equal(response(h.call('doPost', e)).success, false);
  }
  assert.equal(h.state.writes, 0);
});

test('successful bridge ACK has matching request/token/offer and no customer PII', () => {
  const h = harness(); const p = payload('duo'); const e = eventFor(p);
  const result = response(h.call('doPost', e));
  assert.equal(result.success, true);
  assert.equal(result.type, 'tfl:order-result');
  assert.equal(result.requestId, p.idempotencyKey);
  assert.equal(result.responseToken, e.parameter.responseToken);
  assert.equal(result.receiverVersion, 2);
  assert.equal(result.offerId, 'duo');
  assert.deepEqual(result.items, p.items);
  assert.equal(result.subtotal, 998000); assert.equal(result.shipping, 0); assert.equal(result.total, 998000);
  assert.equal(result.duplicate, false);
  for (const field of ['customerName', 'phone', 'address', 'note']) assert.equal(field in result, false);
  assert.equal(h.sheet().rows.length, 2);
  assert.equal(h.sheet().rows[1][26], 1); assert.equal(h.sheet().rows[1][27], 1);
  assert.deepEqual(JSON.parse(h.sheet().rows[1][25]).map(item => item.sku), [WHITE, RED]);
  assert.equal(h.state.locked, false);
});

test('identical retries and reordered duo items retain order ID without duplicate rows', () => {
  const h = harness(); const p = payload('duo');
  const first = response(h.call('doPost', eventFor(p)));
  p.items.reverse(); p.attribution.utm_source = 'changed-on-retry';
  const retry = response(h.call('doPost', eventFor(p)));
  assert.equal(retry.success, true); assert.equal(retry.duplicate, true);
  assert.equal(retry.orderId, first.orderId); assert.equal(h.state.writes, 1);
});

test('reuse of idempotency key with different customer or offer is rejected', () => {
  const h = harness(); const p = payload();
  response(h.call('doPost', eventFor(p)));
  const changed = copy(p); changed.phone = '0901234568';
  assert.equal(response(h.call('doPost', eventFor(changed))).code, 'REQUEST_CONFLICT');
  const other = payload('red', p.idempotencyKey);
  assert.equal(response(h.call('doPost', eventFor(other))).code, 'REQUEST_CONFLICT');
  assert.equal(h.state.writes, 1);
});

test('rejects corrupt previously saved state rather than returning a success ACK', () => {
  const h = harness(); const p = payload();
  response(h.call('doPost', eventFor(p)));
  h.sheet().rows[1][11] = 1;
  const result = response(h.call('doPost', eventFor(p)));
  assert.equal(result.success, false); assert.equal(result.code, 'ORDER_STATE_INVALID');
  assert.equal(h.state.writes, 1); assert.equal(h.state.locked, false);
});

test('busy or failed flush never returns success; uncertain retry deduplicates', () => {
  const h = harness(); const p = payload();
  h.state.busy = true;
  const busy = response(h.call('doPost', eventFor(p)));
  assert.equal(busy.success, false); assert.equal(busy.code, 'BUSY'); assert.equal(busy.retryable, true);
  assert.equal(h.state.writes, 0);
  h.state.busy = false; h.state.flushFails = true;
  const uncertain = response(h.call('doPost', eventFor(p)));
  assert.equal(uncertain.success, false); assert.equal(uncertain.retryable, true);
  assert.equal(h.state.writes, 1); assert.equal(h.state.locked, false);
  h.state.flushFails = false;
  const retry = response(h.call('doPost', eventFor(p)));
  assert.equal(retry.success, true); assert.equal(retry.duplicate, true);
  assert.equal(h.state.writes, 1);
  assert.deepEqual(h.state.logs, ['[TFL orders v2] ORDER_SAVE_FAILED']);
});

test('wrong origins, malformed transport token or request mismatch cannot write', () => {
  const h = harness(); const p = payload();
  for (const overrides of [
    {parentOrigin: 'https://evil.example'},
    {parentOrigin: ORIGIN + '/path'},
    {responseToken: 'short'},
    {requestId: crypto.randomUUID()}
  ]) assert.equal(response(h.call('doPost', eventFor(p, overrides))).success, false);
  assert.equal(h.state.writes, 0);
});

test('new exact Sites origin can receive a bridge result', () => {
  const h = harness(); const p = payload('red');
  const result = response(h.call('doPost', eventFor(p, {
    parentOrigin: 'https://the-fragrance-lab-duo-atelier.kh-ng-gian-l-3718.chatgpt.site'
  })));
  assert.equal(result.success, true); assert.equal(result.offerId, 'red');
});

test('formula-like customer text is neutralized in the sheet', () => {
  const h = harness(); const p = payload();
  p.note = '=IMPORTXML("https://example.invalid","x")';
  response(h.call('doPost', eventFor(p)));
  assert.equal(h.sheet().rows[1][16], "'" + p.note);
  assert.equal(h.sheet().rows[1][14], "'0901234567");
});

test('v2 preserves all legacy columns and existing rows while adding item metadata', () => {
  const h = harness();
  const old = h.spreadsheet.insertSheet('Don_hang_Web');
  const previousOrder = [
    '2026-11-20 10:00:00', 'old-id', 'old-key', 'old-hash', 'Moi',
    'Baccarat 540 Trắng', WHITE, 50, 1, 549000, 30000, 579000, 'VND',
    "'Khách Cũ", "'0900000000", "'Địa chỉ kiểm thử cũ", "'Giữ nguyên", 'source',
    'medium', 'campaign', 'content', 'term', ORIGIN
  ];
  old.rows = [copy(LEGACY_HEADERS), copy(previousOrder)];
  h.state.properties.ORDER_SHEET_NAME = 'Don_hang_Web';
  h.state.properties.ORDER_SHEET_NAME_V2 = 'Unrelated_v2_sheet';
  const setup = h.call('setupOrderSheet');
  assert.equal(setup.sheetName, 'Don_hang_Web');
  assert.deepEqual(old.rows[0].slice(0, 23), LEGACY_HEADERS);
  assert.deepEqual(old.rows[1], previousOrder);
  assert.equal(old.rows.length, 2);
  assert.equal(old.rows[0].length, 31);
  assert.equal(h.state.writes, 0);
  const afterSetup = copy(old.rows);
  h.call('setupOrderSheet');
  assert.deepEqual(old.rows, afterSetup);
  const p = payload('duo');
  assert.equal(response(h.call('doPost', eventFor(p))).success, true);
  assert.deepEqual(old.rows[1], previousOrder);
  assert.equal(old.rows.length, 3);
  assert.deepEqual(Array.from(h.state.sheets.keys()), ['Don_hang_Web']);
  assert.equal(old.rows[2][8], 2);
  assert.equal(old.rows[2][11], 998000);
  assert.equal(h.state.writes, 1);
});

test('legacy product, SKU, quantity and money columns stay correct for every offer', () => {
  const h = harness();
  const offerNames = {white: 'Baccarat 540 Pearl (Trắng)', red: 'Baccarat 540 Ruby (Đỏ)', duo: 'Bộ đôi Pearl + Ruby'};
  const productNames = {[WHITE]: offerNames.white, [RED]: offerNames.red};
  for (const id of ['white', 'red', 'duo']) {
    const p = payload(id);
    assert.equal(response(h.call('doPost', eventFor(p))).success, true);
    const row = h.sheet().rows.at(-1);
    const expectedSkus = p.items.map(item => item.sku);
    assert.equal(row[6], expectedSkus.join(' + '));
    assert.equal(row[5], offerNames[id]);
    assert.equal(row[7], 50);
    assert.equal(row[8], p.quantity);
    assert.equal(row[9], p.subtotal);
    assert.equal(row[10], p.shipping);
    assert.equal(row[11], p.total);
    assert.equal(row[12], 'VND');
    assert.equal(row[24], id);
    assert.deepEqual(JSON.parse(row[25]).map(item => item.sku), expectedSkus);
    assert.deepEqual(JSON.parse(row[25]).map(item => item.name), expectedSkus.map(sku => productNames[sku]));
  }
});

test('existing ORDER_SHEET_NAME override remains the sole worksheet destination', () => {
  const h = harness();
  h.state.properties.ORDER_SHEET_NAME = 'Orders_existing';
  const existing = h.spreadsheet.insertSheet('Orders_existing');
  existing.rows = [copy(LEGACY_HEADERS)];
  assert.equal(response(h.call('doPost', eventFor(payload('red')))).success, true);
  assert.equal(h.sheet(), existing);
  assert.deepEqual(Array.from(h.state.sheets.keys()), ['Orders_existing']);
  assert.deepEqual(existing.rows[0].slice(0, 23), LEGACY_HEADERS);
});

test('unknown legacy headers or occupied extension headers are never overwritten', () => {
  for (const column of [0, 23]) {
    const h = harness();
    const existing = h.spreadsheet.insertSheet('Don_hang_Web');
    existing.rows = [copy(LEGACY_HEADERS)];
    existing.rows[0][column] = 'Custom_existing_header';
    const before = copy(existing.rows);
    assert.equal(response(h.call('doPost', eventFor(payload()))).code, 'SHEET_CONFIGURATION');
    assert.deepEqual(existing.rows, before);
    assert.equal(existing.columns, 26);
    assert.equal(h.state.writes, 0);
  }
});

test('unlabelled extension columns containing existing data are left untouched', () => {
  const h = harness();
  const existing = h.spreadsheet.insertSheet('Don_hang_Web');
  existing.rows = [copy(LEGACY_HEADERS), Array(23).fill('')];
  existing.rows[1][23] = 'Existing unlabelled value';
  const before = copy(existing.rows);
  assert.equal(response(h.call('doPost', eventFor(payload()))).code, 'SHEET_CONFIGURATION');
  assert.deepEqual(existing.rows, before);
  assert.equal(existing.columns, 26);
  assert.equal(h.state.writes, 0);
});

let failures = 0;
for (const {name, run} of tests) {
  try { run(); process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { failures++; process.stderr.write('FAIL ' + name + '\n' + error.stack + '\n'); }
}
process.stdout.write(`${tests.length - failures}/${tests.length} offline receiver tests passed. No network requests or real orders.\n`);
process.exitCode = failures ? 1 : 0;
