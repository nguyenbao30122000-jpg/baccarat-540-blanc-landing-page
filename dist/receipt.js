(() => {
  'use strict';
  const root = typeof window === 'object' ? window : globalThis;
  const storageKey = 'tfl:last-confirmed-order';
  const productNames = Object.freeze({
    'TFL-540-BLANC-50': 'Baccarat 540 Pearl (Trắng)',
    'TFL-540-ROUGE-50': 'Baccarat 540 Ruby (Đỏ)'
  });
  function matchesItems(items, expected) {
    return Array.isArray(items) && items.length === expected.length &&
      expected.every((item, index) => items[index] && items[index].sku === item.sku &&
        items[index].quantity === item.quantity && items[index].volumeMl === item.volumeMl);
  }
  function valid(receipt, now = Date.now()) {
    const app = root.TFLApp;
    if (!app || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
    const offer = app.offers[receipt.offerId];
    if (!offer || receipt.receiptVersion !== 1 || receipt.schemaVersion !== 2 ||
        receipt.receiverVersion !== 2 || receipt.currency !== 'VND' ||
        typeof receipt.orderId !== 'string' || !receipt.orderId.trim() ||
        receipt.orderId.length > 120 || /[\u0000-\u001f\u007f]/.test(receipt.orderId) ||
        receipt.quantity !== offer.quantity || receipt.subtotal !== offer.subtotal ||
        receipt.shipping !== offer.shipping || receipt.total !== offer.total ||
        !matchesItems(receipt.items, offer.items)) return false;
    if (!['customerName', 'phone', 'address', 'note'].every((key) => typeof receipt[key] === 'string')) return false;
    const customer = app.validateCustomer(receipt);
    if (!customer.valid || Object.keys(customer.value).some((key) => receipt[key] !== customer.value[key])) return false;
    const confirmedAt = typeof receipt.confirmedAt === 'string' ? Date.parse(receipt.confirmedAt) : NaN;
    return Number.isFinite(confirmedAt) && confirmedAt > 0 && confirmedAt <= now + 300000;
  }
  function create(payload, result, confirmedAt = new Date().toISOString()) {
    const app = root.TFLApp;
    if (!app || !app.validateAck(result, payload)) throw new Error('unconfirmed_receipt');
    const offer = app.offers[payload.offerId];
    if (!offer || !matchesItems(payload.items, offer.items)) throw new Error('invalid_receipt_items');
    const customer = app.validateCustomer(payload);
    if (!customer.valid) throw new Error('invalid_receipt_customer');
    const receipt = {
      receiptVersion: 1, schemaVersion: 2, receiverVersion: 2,
      orderId: result.orderId, offerId: offer.id,
      items: offer.items.map((item) => ({...item})), quantity: offer.quantity,
      subtotal: offer.subtotal, shipping: offer.shipping, total: offer.total,
      currency: 'VND', ...customer.value, confirmedAt
    };
    if (!valid(receipt) || payload.quantity !== offer.quantity ||
        payload.subtotal !== offer.subtotal || payload.shipping !== offer.shipping ||
        payload.total !== offer.total || payload.currency !== 'VND' || payload.schemaVersion !== 2) {
      throw new Error('invalid_receipt');
    }
    return receipt;
  }
  function save(storage, receipt) {
    if (!valid(receipt)) return false;
    try {
      const encoded = JSON.stringify(receipt);
      storage.setItem(storageKey, encoded);
      return storage.getItem(storageKey) === encoded;
    } catch (_) { return false; }
  }
  function read(storage) {
    let encoded;
    try { encoded = storage.getItem(storageKey); }
    catch (_) { return {state: 'unavailable', receipt: null}; }
    if (!encoded) return {state: 'missing', receipt: null};
    try {
      const receipt = JSON.parse(encoded);
      return valid(receipt) ? {state: 'confirmed', receipt} : {state: 'invalid', receipt: null};
    } catch (_) { return {state: 'invalid', receipt: null}; }
  }
  root.TFLReceipt = Object.freeze({storageKey, productNames, create, valid, save, read});
})();
