const assert = require('node:assert/strict');
require('../dist/app.js');
const app = globalThis.TFLApp;
let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const customer = {customerName: '  Nguyễn   Minh An  ', phone: '+84 912 345 678',
  address: '12 Đường Hoa, Phường Bến Thành, Thành phố Hồ Chí Minh', note: ''};
check(() => assert.equal(app.normalizePhone(customer.phone), '0912345678'));
check(() => assert.equal(app.normalizePhone('0084.912.345.678'), '0912345678'));
check(() => assert.equal(app.normalizePhone('0912-345-678'), '0912345678'));
check(() => assert.equal(app.normalizePhone('001234'), ''));
check(() => assert.equal(app.normalizePhone('091234567890'), ''));
check(() => assert.equal(app.normalizePhone('+1 912 345 678'), ''));
check(() => assert.equal(app.validateCustomer(customer).value.customerName, 'Nguyễn Minh An'));
check(() => assert.equal(app.validateCustomer({...customer, address: 'abc'}).valid, false));
check(() => assert.equal(app.validateCustomer({...customer, note: 'a'.repeat(1001)}).valid, false));
for (const [id, expectedTotal] of [['white', 579000], ['red', 579000], ['duo', 998000]]) {
  const payload = app.buildPayload(id, customer, '304e130a-5a09-4f93-8ce0-019ea054f9f0');
  check(() => assert.equal(payload.total, expectedTotal));
  check(() => assert.equal(payload.total, payload.subtotal + payload.shipping));
  check(() => assert.equal(payload.quantity, payload.items.reduce((sum, item) => sum + item.quantity, 0)));
  check(() => assert.equal(payload.phone, '0912345678'));
  check(() => assert.deepEqual(Object.keys(payload).sort(), ['schemaVersion','offerId','currency','items','quantity','subtotal','shipping','total','customerName','phone','address','note','idempotencyKey','attribution'].sort()));
  const ack = {success: true, schemaVersion: 2, receiverVersion: 2, orderId: 'TFL-TEST',
    offerId: id, currency: 'VND', quantity: payload.quantity, subtotal: payload.subtotal,
    shipping: payload.shipping, total: payload.total};
  check(() => assert.equal(app.validateAck(ack, payload), true));
  check(() => assert.equal(app.validateAck({...ack, receiverVersion: 1}, payload), false));
  check(() => assert.equal(app.validateAck({...ack, total: payload.total + 1}, payload), false));
  check(() => assert.equal(app.validateAck({...ack, offerId: 'legacy'}, payload), false));
}
const combo = app.buildPayload('duo', customer, '304e130a-5a09-4f93-8ce0-019ea054f9f0');
for (const [id, listPrice] of [['white', 3995000], ['red', 3995000], ['duo', 7990000]]) {
  check(() => assert.equal(app.offers[id].listPrice, listPrice));
  check(() => assert.equal(app.offers[id].savings, listPrice - app.offers[id].subtotal));
}
check(() => assert.equal(new Set(Object.values(app.offers).map((offer) => offer.image)).size, 3));
check(() => assert.deepEqual(combo.items.map((item) => item.sku), ['TFL-540-BLANC-50','TFL-540-ROUGE-50']));
check(() => assert.equal(app.offers.white.subtotal + app.offers.red.subtotal - app.offers.duo.subtotal, 100000));
check(() => assert.throws(() => app.buildPayload('legacy', customer, 'test')));
check(() => assert.throws(() => app.buildPayload('white', {...customer, phone: ''}, 'test')));
const health = {success: true, receiverVersion: 2, schemaVersion: 2, currency: 'VND', offers: app.offers};
check(() => assert.equal(app.validateHealth(health), true));
check(() => assert.equal(app.validateHealth({...health, receiverVersion: 1}), false));
check(() => assert.equal(app.validateHealth({...health, offers: {white: app.offers.white}}), false));
check(() => assert.equal(app.validateHealth({...health, offers: {...app.offers, duo: {...app.offers.duo, total: 998001}}}), false));
console.log('Frontend: ' + checks + ' checks passed (offers, validation, payload, strict receiver v2 ACK/health). No network calls.');
