(() => {
  'use strict';
  if (!document.body || document.body.dataset.page !== 'thank-you') return;
  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => { const node = byId(id); if (node) node.textContent = text; };
  const api = window.TFLReceipt;
  let result = {state: 'unavailable', receipt: null};
  try { if (api) result = api.read(window.sessionStorage); } catch (_) {}
  document.body.dataset.receiptState = result.state;
  if (result.state !== 'confirmed') {
    if (result.state !== 'missing') {
      setText('receipt-empty-description', 'Chưa thể hiển thị thông tin đơn hàng trong phiên này. Nếu vừa gửi yêu cầu, bạn vui lòng chờ cửa hàng xác nhận trước khi đặt lại.');
    }
    return;
  }
  const receipt = result.receipt;
  const offer = window.TFLApp.offers[receipt.offerId];
  const money = window.TFLApp.money;
  setText('receipt-order-id', receipt.orderId);
  setText('receipt-date', new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date(receipt.confirmedAt)));
  setText('receipt-product-name', offer.name);
  setText('receipt-quantity', receipt.quantity + ' chai · 50ml/chai');
  setText('receipt-customer-name', receipt.customerName);
  setText('receipt-phone', receipt.phone);
  setText('receipt-address', receipt.address);
  setText('receipt-note', receipt.note || 'Không có lời nhắn thêm.');
  setText('receipt-subtotal', money(receipt.subtotal));
  setText('receipt-shipping', receipt.shipping ? money(receipt.shipping) : 'Miễn phí');
  setText('receipt-total', money(receipt.total));
  const image = byId('receipt-product-image');
  image.src = (window.TFL_ASSET_BASE || '') + offer.image;
  image.alt = offer.name;
  const items = byId('receipt-items');
  items.replaceChildren();
  receipt.items.forEach((item) => {
    const row = document.createElement('li');
    const description = document.createElement('div');
    const name = document.createElement('strong');
    const detail = document.createElement('span');
    const amount = document.createElement('span');
    name.textContent = api.productNames[item.sku];
    detail.textContent = 'Số lượng: ' + item.quantity + ' chai · ' + item.volumeMl + 'ml';
    amount.textContent = money(receipt.subtotal / receipt.quantity * item.quantity);
    amount.className = 'receipt-item-amount';
    description.append(name, detail);
    row.append(description, amount);
    items.append(row);
  });
  byId('empty-receipt').hidden = true;
  byId('confirmed-receipt').hidden = false;
})();
