const TFL_ORDER_CONFIG = Object.freeze({
  spreadsheetId: '1O-QtB1kgtPPfwxzRHl6JlLfCnVb0javKbG8pCAaSoQQ',
  sheetName: 'Don_hang_Web',
  timezone: 'Asia/Ho_Chi_Minh',
  productName: 'Baccarat 540 Trắng',
  sku: 'TFL-540-BLANC-50',
  volumeMl: 50,
  maxPayloadChars: 12000,
  allowedOrigins: Object.freeze([
    'https://thefragrancelabperfume.shop',
    'https://www.thefragrancelabperfume.shop',
    'https://nguyenbao30122000-jpg.github.io'
  ]),
  offers: Object.freeze({
    1: Object.freeze({subtotal: 549000, shipping: 30000}),
    2: Object.freeze({subtotal: 998000, shipping: 0})
  })
});

const TFL_ORDER_HEADERS = Object.freeze([
  'Thoi_gian_VN', 'Ma_don', 'Idempotency_key', 'Payload_hash', 'Trang_thai',
  'San_pham', 'SKU', 'Dung_tich_ml', 'So_luong', 'Tien_san_pham',
  'Phi_van_chuyen', 'Tong_thanh_toan', 'Tien_te', 'Ho_va_ten',
  'Dien_thoai', 'Dia_chi', 'Ghi_chu', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_content', 'utm_term', 'Nguon_website'
]);

const TFL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TFL_RESPONSE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function doGet() {
  return jsonResponse_({ok: true, service: 'TFL order receiver', version: 1});
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const context = {
    bridge: params.responseMode === 'bridge',
    parentOrigin: typeof params.parentOrigin === 'string' ? params.parentOrigin : '',
    requestId: validUuid_(params.requestId) ? params.requestId.toLowerCase() : '',
    responseToken: typeof params.responseToken === 'string' &&
      TFL_RESPONSE_TOKEN_PATTERN.test(params.responseToken) ? params.responseToken : ''
  };
  let response;
  try {
    if (context.bridge &&
        (!allowedOrigin_(context.parentOrigin) || !context.requestId || !context.responseToken)) {
      fail_('INVALID_TRANSPORT', 'Không xác nhận được nguồn gửi yêu cầu.');
    }
    const payload = parsePayload_(e);
    const order = validateOrder_(payload);
    if (context.bridge && context.requestId !== order.idempotencyKey) {
      fail_('INVALID_REQUEST', 'Mã yêu cầu không khớp. Vui lòng thử lại.');
    }
    context.requestId = order.idempotencyKey;
    response = saveOrder_(order, context.parentOrigin);
  } catch (error) {
    const known = error && error.tflCode;
    const code = known ? error.tflCode : 'ORDER_SAVE_FAILED';
    response = {
      success: false,
      code: code,
      message: known ? error.message :
        'Chưa xác nhận được đơn đã lưu. Vui lòng thử lại với cùng yêu cầu.',
      retryable: code === 'BUSY' || code === 'ORDER_SAVE_FAILED'
    };
    if (!known) console.error('[TFL orders] ORDER_SAVE_FAILED');
  }
  const message = Object.assign({
    type: 'tfl:order-result',
    requestId: context.requestId,
    responseToken: context.responseToken
  }, response);
  if (context.bridge && allowedOrigin_(context.parentOrigin)) {
    return bridgeResponse_(message, context.parentOrigin);
  }
  return jsonResponse_(message);
}

function setupOrderSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) fail_('BUSY', 'Hệ thống đang bận, vui lòng thử lại.');
  try {
    const sheet = orderSheet_();
    SpreadsheetApp.flush();
    return {ok: true, sheetName: sheet.getName()};
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (!e || (typeof e.contentLength === 'number' && e.contentLength > 65536)) {
    fail_('INVALID_REQUEST', 'Dữ liệu gửi lên không hợp lệ.');
  }
  const params = e.parameter || {};
  let raw = params.payload;
  if (typeof raw !== 'string' && e.postData &&
      /^application\/json(?:;|$)/i.test(String(e.postData.type || ''))) {
    raw = e.postData.contents;
  }
  if (typeof raw !== 'string' || !raw.length || raw.length > TFL_ORDER_CONFIG.maxPayloadChars) {
    fail_('INVALID_REQUEST', 'Dữ liệu đơn hàng không hợp lệ.');
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    fail_('INVALID_REQUEST', 'Không đọc được dữ liệu đơn hàng.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail_('INVALID_REQUEST', 'Dữ liệu đơn hàng không hợp lệ.');
  }
  return payload;
}

function validateOrder_(payload) {
  if (!validUuid_(payload.idempotencyKey)) {
    fail_('INVALID_REQUEST', 'Mã yêu cầu không hợp lệ.');
  }
  if (payload.sku !== TFL_ORDER_CONFIG.sku ||
      Number(payload.volumeMl) !== TFL_ORDER_CONFIG.volumeMl ||
      payload.currency !== 'VND') {
    fail_('INVALID_PRODUCT', 'Sản phẩm không hợp lệ. Vui lòng tải lại trang.');
  }
  const quantity = Number(payload.quantity);
  if (!Number.isInteger(quantity) ||
      !Object.prototype.hasOwnProperty.call(TFL_ORDER_CONFIG.offers, quantity)) {
    fail_('INVALID_QUANTITY', 'Vui lòng chọn một chai hoặc bộ hai chai.');
  }
  const customerName = boundedText_(payload.customerName, 2, 100, 'họ và tên', true);
  if (!/\p{L}/u.test(customerName)) fail_('INVALID_CUSTOMER', 'Họ và tên không hợp lệ.');
  const address = boundedText_(payload.address, 10, 350, 'địa chỉ nhận hàng', false);
  if (!/[\p{L}\p{N}]/u.test(address)) fail_('INVALID_CUSTOMER', 'Địa chỉ nhận hàng không hợp lệ.');
  const note = boundedText_(payload.note == null ? '' : payload.note, 0, 250, 'ghi chú', false);
  let phone = boundedText_(payload.phone, 9, 32, 'số điện thoại', true).replace(/[\s.()\-]/g, '');
  phone = phone.replace(/^\+?84/, '0');
  if (!/^0[35789]\d{8}$/.test(phone)) {
    fail_('INVALID_PHONE', 'Vui lòng nhập số di động Việt Nam hợp lệ.');
  }
  const offer = TFL_ORDER_CONFIG.offers[quantity];
  const attribution = {};
  const source = payload.attribution && typeof payload.attribution === 'object' &&
    !Array.isArray(payload.attribution) ? payload.attribution : {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
    attribution[key] = typeof source[key] === 'string' ?
      cleanText_(source[key], true).slice(0, 200) : '';
  });
  return {
    idempotencyKey: payload.idempotencyKey.toLowerCase(),
    product: TFL_ORDER_CONFIG.productName,
    sku: TFL_ORDER_CONFIG.sku,
    volumeMl: TFL_ORDER_CONFIG.volumeMl,
    quantity: quantity,
    subtotal: offer.subtotal,
    shipping: offer.shipping,
    total: offer.subtotal + offer.shipping,
    currency: 'VND',
    customerName: customerName,
    phone: phone,
    address: address,
    note: note,
    attribution: attribution
  };
}

function saveOrder_(order, parentOrigin) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) fail_('BUSY', 'Hệ thống đang bận. Vui lòng thử lại.');
  try {
    const sheet = orderSheet_();
    const fingerprint = orderFingerprint_(order);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const match = sheet.getRange(2, 3, lastRow - 1, 1)
        .createTextFinder(order.idempotencyKey).matchEntireCell(true).matchCase(false).findNext();
      if (match) {
        const existing = sheet.getRange(match.getRow(), 1, 1, TFL_ORDER_HEADERS.length).getValues()[0];
        if (String(existing[3]) !== fingerprint) {
          fail_('REQUEST_CONFLICT', 'Yêu cầu này đã được dùng cho nội dung khác. Vui lòng tạo đơn mới.');
        }
        if (!validUuid_(existing[1]) || Number(existing[8]) !== order.quantity ||
            Number(existing[11]) !== order.total) {
          fail_('ORDER_STATE_INVALID', 'Cửa hàng cần kiểm tra lại trạng thái yêu cầu này.');
        }
        return {
          success: true, orderId: String(existing[1]), quantity: Number(existing[8]),
          total: Number(existing[11]), currency: 'VND', duplicate: true
        };
      }
    }
    const orderId = Utilities.getUuid();
    const row = [
      Utilities.formatDate(new Date(), TFL_ORDER_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
      orderId, order.idempotencyKey, fingerprint, 'Moi', order.product, order.sku,
      order.volumeMl, order.quantity, order.subtotal, order.shipping, order.total,
      order.currency, safeCell_(order.customerName), safeCell_(order.phone),
      safeCell_(order.address), safeCell_(order.note),
      safeCell_(order.attribution.utm_source), safeCell_(order.attribution.utm_medium),
      safeCell_(order.attribution.utm_campaign), safeCell_(order.attribution.utm_content),
      safeCell_(order.attribution.utm_term), allowedOrigin_(parentOrigin) ? parentOrigin : ''
    ];
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return {
      success: true, orderId: orderId, quantity: order.quantity, total: order.total,
      currency: 'VND', duplicate: false
    };
  } finally {
    lock.releaseLock();
  }
}

function orderSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredName = properties.getProperty('ORDER_SHEET_NAME');
  const name = configuredName ? configuredName.trim() : TFL_ORDER_CONFIG.sheetName;
  if (!name || name.length > 100 || /[\\/?*:[\]]/.test(name)) {
    fail_('SHEET_CONFIGURATION', 'Trang tính nhận đơn chưa được cấu hình đúng.');
  }
  const spreadsheet = SpreadsheetApp.openById(TFL_ORDER_CONFIG.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    if (sheet.getMaxColumns() < TFL_ORDER_HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), TFL_ORDER_HEADERS.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, TFL_ORDER_HEADERS.length).setValues([Array.from(TFL_ORDER_HEADERS)]);
    sheet.setFrozenRows(1);
  } else {
    if (sheet.getMaxColumns() < TFL_ORDER_HEADERS.length) {
      fail_('SHEET_CONFIGURATION', 'Trang tính nhận đơn có cấu trúc khác. Cửa hàng cần kiểm tra.');
    }
    const actual = sheet.getRange(1, 1, 1, TFL_ORDER_HEADERS.length).getDisplayValues()[0];
    if (!TFL_ORDER_HEADERS.every(function (header, index) { return actual[index] === header; })) {
      fail_('SHEET_CONFIGURATION', 'Trang tính nhận đơn có cấu trúc khác. Cửa hàng cần kiểm tra.');
    }
  }
  return sheet;
}

function orderFingerprint_(order) {
  const canonical = JSON.stringify([
    order.sku, order.volumeMl, order.quantity, order.subtotal, order.shipping, order.total,
    order.currency, order.customerName, order.phone, order.address, order.note
  ]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function cleanText_(value, singleLine) {
  let text = value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (singleLine) text = text.replace(/\s+/g, ' ');
  return text;
}

function boundedText_(value, minimum, maximum, label, singleLine) {
  if (typeof value !== 'string') fail_('INVALID_CUSTOMER', 'Vui lòng kiểm tra ' + label + '.');
  const text = cleanText_(value, singleLine);
  if (text.length < minimum || text.length > maximum) {
    fail_('INVALID_CUSTOMER', 'Vui lòng kiểm tra ' + label + '.');
  }
  return text;
}

function safeCell_(value) {
  return value ? "'" + String(value) : '';
}

function validUuid_(value) {
  return typeof value === 'string' && TFL_UUID_PATTERN.test(value);
}

function allowedOrigin_(value) {
  return TFL_ORDER_CONFIG.allowedOrigins.indexOf(value) !== -1;
}

function fail_(code, message) {
  const error = new Error(message);
  error.tflCode = code;
  throw error;
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function bridgeResponse_(message, parentOrigin) {
  const data = JSON.stringify(message).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const target = JSON.stringify(parentOrigin);
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>' +
    '(function(){var data=' + data + ';var origin=' + target + ';var current=window;' +
    'for(var depth=0;depth<10;depth++){var next;try{next=current.parent;}catch(error){break;}' +
    'if(!next||next===current)break;try{next.postMessage(data,origin);}catch(error){}current=next;}' +
    '})();</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
