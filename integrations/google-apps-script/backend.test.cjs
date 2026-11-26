const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const spreadsheetId = '1O-QtB1kgtPPfwxzRHl6JlLfCnVb0javKbG8pCAaSoQQ';
const origin = 'https://thefragrancelabperfume.shop';

function harness() {
  const state = {sheets: new Map(), flushFailures: 0, busy: false, releases: 0, sheetName: null};
  function newSheet(name, initial = []) {
    const rows = initial.map((row) => row.slice());
    const sheet = {
      name, rows, columns: 26,
      getName: () => name,
      getLastRow: () => rows.length,
      getMaxColumns: () => sheet.columns,
      insertColumnsAfter: (_, count) => { sheet.columns += count; },
      setFrozenRows: () => {},
      appendRow: (row) => { rows.push(row.slice()); return sheet; },
      getRange: (row, column, count = 1, width = 1) => ({
        getRow: () => row,
        setValues: (values) => {
          values.forEach((value, index) => {
            if (!rows[row - 1 + index]) rows[row - 1 + index] = [];
            value.forEach((cell, offset) => { rows[row - 1 + index][column - 1 + offset] = cell; });
          });
        },
        getValues: () => rows.slice(row - 1, row - 1 + count)
          .map((value) => value.slice(column - 1, column - 1 + width)),
        getDisplayValues: () => rows.slice(row - 1, row - 1 + count)
          .map((value) => value.slice(column - 1, column - 1 + width).map(String)),
        createTextFinder: (key) => {
          const finder = {
            matchEntireCell: () => finder,
            matchCase: () => finder,
            findNext: () => {
              const index = rows.findIndex((value, position) =>
                position >= row - 1 && position < row - 1 + count &&
                String(value[column - 1]).toLowerCase() === key.toLowerCase());
              return index === -1 ? null : {getRow: () => index + 1};
            }
          };
          return finder;
        }
      })
    };
    state.sheets.set(name, sheet);
    return sheet;
  }
  const context = vm.createContext({
    console: {error: () => {}},
    ContentService: {
      MimeType: {JSON: 'application/json'},
      createTextOutput: (content) => ({content, setMimeType() { return this; }})
    },
    HtmlService: {
      XFrameOptionsMode: {ALLOWALL: 'ALLOWALL'},
      createHtmlOutput: (content) => ({
        content, setXFrameOptionsMode(value) { this.frameMode = value; return this; }
      })
    },
    PropertiesService: {getScriptProperties: () => ({getProperty: () => state.sheetName})},
    LockService: {getScriptLock: () => ({
      tryLock: () => !state.busy,
      releaseLock: () => { state.releases += 1; }
    })},
    SpreadsheetApp: {
      openById: (id) => {
        assert.equal(id, spreadsheetId);
        return {
          getSheetByName: (name) => state.sheets.get(name),
          insertSheet: (name) => newSheet(name)
        };
      },
      flush: () => {
        if (state.flushFailures > 0) {
          state.flushFailures -= 1;
          throw new Error('Simulated acknowledgement uncertainty after append');
        }
      }
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: () => '2026-11-26 12:00:00',
      DigestAlgorithm: {SHA_256: 'sha256'},
      Charset: {UTF_8: 'utf8'},
      computeDigest: (_, text) => Array.from(crypto.createHash('sha256').update(text).digest())
    }
  });
  vm.runInContext(source, context);
  function payload(overrides = {}) {
    return {
      product: 'Untrusted client label', sku: 'TFL-540-BLANC-50',
      volumeMl: 50, quantity: 1, subtotal: 1, shipping: 0, total: 1, currency: 'VND',
      customerName: 'Khách thử nghiệm', phone: '+84 912 345 678',
      address: 'Địa chỉ thử nghiệm, không giao hàng', note: '',
      attribution: {utm_source: 'test'},
      idempotencyKey: crypto.randomUUID(),
      ...overrides
    };
  }
  function post(value, extra = {}) {
    return context.doPost({parameter: {payload: JSON.stringify(value), ...extra}, contentLength: 2000});
  }
  function json(value) { return JSON.parse(post(value).content); }
  function bridge(value, extra = {}) {
    const responseToken = crypto.randomUUID();
    const result = post(value, {
      responseMode: 'bridge', parentOrigin: origin, requestId: value.idempotencyKey,
      responseToken, ...extra
    });
    const match = result.content.match(/var data=(\{.*?\});var origin=/);
    return {result, message: match ? JSON.parse(match[1]) : JSON.parse(result.content), responseToken};
  }
  return {state, context, newSheet, payload, post, json, bridge};
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write('PASS ' + name + '\n');
}

test('server prices ignore client amounts for both offers', () => {
  const h = harness();
  const one = h.json(h.payload());
  const two = h.json(h.payload({quantity: 2, total: -500}));
  assert.equal(one.success, true);
  assert.equal(one.total, 579000);
  assert.equal(two.total, 998000);
  const rows = h.state.sheets.get('Don_hang_Web').rows;
  assert.equal(rows[1][5], 'Baccarat 540 Trắng');
  assert.equal(rows[1][9], 549000);
  assert.equal(rows[1][10], 30000);
  assert.equal(rows[2][10], 0);
});

test('invalid UUID, phone, address, quantity and SKU cause no order append', () => {
  const h = harness();
  for (const invalid of [
    {idempotencyKey: 'invalid'}, {phone: '123'}, {address: 'abc'},
    {quantity: 3}, {sku: 'OTHER'}, {currency: 'USD'}
  ]) assert.equal(h.json(h.payload(invalid)).success, false);
  assert.equal(h.state.sheets.size, 0);
});

test('customer fields stay literal and phone retains its leading zero', () => {
  const h = harness();
  const request = h.payload({
    customerName: '=HYPERLINK("example.invalid")',
    note: '=IMPORTXML("example.invalid","//a")',
    attribution: {utm_source: '+FORMULA'}
  });
  assert.equal(h.json(request).success, true);
  const row = h.state.sheets.get('Don_hang_Web').rows[1];
  assert.equal(row[13], "'" + request.customerName);
  assert.equal(row[14], "'0912345678");
  assert.equal(row[16], "'" + request.note);
  assert.equal(row[17], "'+FORMULA");
});

test('same idempotency key returns the saved order without adding rows', () => {
  const h = harness();
  const request = h.payload();
  const first = h.json(request);
  const second = h.json(request);
  assert.equal(second.success, true);
  assert.equal(second.orderId, first.orderId);
  assert.equal(second.duplicate, true);
  assert.equal(h.state.sheets.get('Don_hang_Web').rows.length, 2);
  assert.equal(h.json({...request, quantity: 2}).code, 'REQUEST_CONFLICT');
  assert.equal(h.state.sheets.get('Don_hang_Web').rows.length, 2);
});

test('existing unrelated tab contents are not overwritten', () => {
  const h = harness();
  const existing = h.newSheet('Don_hang_Web', [['Unrelated header', 'Keep this cell'], ['Existing row']]);
  const before = JSON.stringify(existing.rows);
  assert.equal(h.json(h.payload()).code, 'SHEET_CONFIGURATION');
  assert.equal(JSON.stringify(existing.rows), before);
});

test('uncertain flush has no success receipt; retry finds the same saved row', () => {
  const h = harness();
  h.state.flushFailures = 1;
  const request = h.payload();
  assert.equal(h.json(request).success, false);
  assert.equal(h.state.sheets.get('Don_hang_Web').rows.length, 2);
  const retry = h.json(request);
  assert.equal(retry.success, true);
  assert.equal(retry.duplicate, true);
  assert.equal(h.state.sheets.get('Don_hang_Web').rows.length, 2);
});

test('bridge binds exact origin, request ID and response token without customer data', () => {
  const h = harness();
  const request = h.payload();
  const {result, message, responseToken} = h.bridge(request);
  assert.equal(result.frameMode, 'ALLOWALL');
  assert.equal(message.type, 'tfl:order-result');
  assert.equal(message.requestId, request.idempotencyKey);
  assert.equal(message.responseToken, responseToken);
  assert.equal(message.success, true);
  assert.ok(result.content.includes('var origin="' + origin + '"'));
  assert.ok(!result.content.includes(request.customerName));
  assert.ok(!result.content.includes(request.address));
  assert.ok(!Object.hasOwn(message, 'phone'));
  const rejected = h.bridge(h.payload(), {parentOrigin: 'https://untrusted.example'});
  assert.equal(rejected.message.success, false);
  assert.equal(rejected.message.code, 'INVALID_TRANSPORT');
});

test('busy lock reports a retryable error and creates no sheet', () => {
  const h = harness();
  h.state.busy = true;
  const response = h.json(h.payload());
  assert.equal(response.success, false);
  assert.equal(response.code, 'BUSY');
  assert.equal(response.retryable, true);
  assert.equal(h.state.sheets.size, 0);
});

process.stdout.write('Completed ' + passed + ' focused backend checks. No Google services contacted.\n');
