(() => {
  'use strict';

  if (!document.body || document.body.dataset.page !== 'thank-you') return;
  const $ = (id) => document.getElementById(id);
  const expectedOffers = {
    1: {subtotal: 549000, shipping: 30000, total: 579000},
    2: {subtotal: 998000, shipping: 0, total: 998000}
  };
  const money = (value) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

  function showUnavailable(state) {
    document.body.dataset.receiptState = state;
    $('confirmed-receipt').hidden = true;
    $('empty-receipt').hidden = false;
    if (state === 'unavailable') {
      $('receipt-empty-description').textContent = 'Chưa thể hiển thị thông tin đơn hàng. Vui lòng kiểm tra trạng thái trước khi gửi lại.';
    }
  }

  let stored;
  try {
    stored = window.sessionStorage.getItem('tfl:last-confirmed-order');
  } catch (_) {
    showUnavailable('unavailable');
    return;
  }
  if (!stored) { showUnavailable('missing'); return; }

  let receipt;
  try {
    receipt = JSON.parse(stored);
  } catch (_) {
    showUnavailable('invalid');
    return;
  }

  const expected = receipt && expectedOffers[receipt.quantity];
  const confirmedAt = receipt && typeof receipt.confirmedAt === 'string' ? Date.parse(receipt.confirmedAt) : NaN;
  const valid = receipt && typeof receipt === 'object' && !Array.isArray(receipt) &&
    typeof receipt.orderId === 'string' && receipt.orderId.trim().length > 0 && receipt.orderId.length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(receipt.orderId) &&
    Number.isInteger(receipt.quantity) && expected && receipt.currency === 'VND' &&
    receipt.subtotal === expected.subtotal && receipt.shipping === expected.shipping && receipt.total === expected.total &&
    Number.isFinite(confirmedAt) && confirmedAt > 0 && confirmedAt <= Date.now() + 300000;
  if (!valid) { showUnavailable('invalid'); return; }

  $('receipt-quantity').textContent = receipt.quantity + ' chai × 50ml';
  $('receipt-subtotal').textContent = money(receipt.subtotal);
  $('receipt-shipping').textContent = receipt.shipping === 0 ? 'Miễn phí' : money(receipt.shipping);
  $('receipt-total').textContent = money(receipt.total);
  $('thank-title-tail').textContent = 'đã đặt hàng!';
  $('thank-description').textContent = 'The Fragrance Lab đã nhận được đơn hàng của bạn. Cảm ơn bạn đã tin tưởng và lựa chọn sản phẩm!';
  $('status-icon').setAttribute('d', 'm5 12 4 4L19 6');
  $('receipt-status').textContent = 'Đặt hàng thành công';
  $('empty-receipt').hidden = true;
  $('confirmed-receipt').hidden = false;
  document.body.dataset.receiptState = 'confirmed';
})();
