# The Fragrance Lab — bộ nhận đơn v2

Bộ nhận đơn Google Apps Script cho ba lựa chọn: 540 Trắng, 540 Đỏ, hoặc combo một chai mỗi loại. Mỗi chai trong cấu hình này là 50ml. Đây là mã nguồn tích hợp đã kiểm tra cục bộ, **chưa triển khai lên tài khoản Google và chưa bật nhận đơn thật**.

## Giá và dòng hàng

| `offerId` | Sản phẩm | Tiền sản phẩm | Vận chuyển | Tổng |
| --- | --- | ---: | ---: | ---: |
| `white` | `TFL-540-BLANC-50` × 1 | 549.000đ | 30.000đ | 579.000đ |
| `red` | `TFL-540-ROUGE-50` × 1 | 549.000đ | 30.000đ | 579.000đ |
| `duo` | Mỗi SKU trên × 1 | 998.000đ | 0đ | 998.000đ |

Combo có giá mua lẻ của hai sản phẩm là 1.098.000đ, giảm 100.000đ, còn 998.000đ. Phần giảm này tính trên tiền sản phẩm, tách biệt khỏi vận chuyển. `items[].unitPrice` và `items[].lineSubtotal` trong dữ liệu lưu là giá mua lẻ trước giảm combo; cột `Giam_combo` ghi mức giảm toàn đơn.

Các mức giá và dung tích là cấu hình của bản thiết kế mới. Nguồn bán hàng cũ có thông tin 50ml/70ml chưa thống nhất; cần chốt đúng hàng giao trước khi bật bán thật. Mã nhận đơn dùng tên “540 Đỏ” để tránh tự quyết định thêm nồng độ/bao bì chưa được xác nhận.

## Giao diện tích hợp

Hợp đồng máy đọc được nằm trong `contract.json`. `GET <web-app-exec-url>?action=health` trả về JSON có:

```json
{
  "success": true,
  "ok": true,
  "schemaVersion": 2,
  "receiverVersion": 2,
  "currency": "VND",
  "capabilities": {"offerIds": ["white", "red", "duo"]},
  "offers": {
    "white": {"subtotal": 549000, "shipping": 30000, "total": 579000},
    "red": {"subtotal": 549000, "shipping": 30000, "total": 579000},
    "duo": {"subtotal": 998000, "shipping": 0, "total": 998000}
  }
}
```

Phản hồi thực tế còn có các trường mô tả dịch vụ và dòng hàng. Frontend phải kiểm tra phiên bản, các gói và giá trước khi mở form. Phản hồi receiver v1, lỗi đọc JSON, lỗi mạng hoặc khác giá phải giữ chức năng gửi đơn đóng và hiện cách liên hệ cửa hàng. Health chỉ xác minh dịch vụ/khả năng, không chứng minh một đơn đã lưu.

### Payload

POST payload là JSON có:

```json
{
  "schemaVersion": 2,
  "offerId": "duo",
  "currency": "VND",
  "items": [
    {"sku": "TFL-540-BLANC-50", "volumeMl": 50, "quantity": 1},
    {"sku": "TFL-540-ROUGE-50", "volumeMl": 50, "quantity": 1}
  ],
  "quantity": 2,
  "subtotal": 998000,
  "shipping": 0,
  "total": 998000,
  "customerName": "Tên khách hàng",
  "phone": "0901234567",
  "address": "Địa chỉ nhận hàng đầy đủ",
  "note": "",
  "idempotencyKey": "11111111-1111-4111-8111-111111111111",
  "attribution": {"utm_source": "website"}
}
```

Ví dụ trên là dữ liệu minh họa, không phải đơn thật. UUID cần được tạo mới bằng nguồn ngẫu nhiên an toàn cho từng yêu cầu mới. Giữ nguyên UUID khi thử lại một yêu cầu chưa rõ đã lưu hay chưa. Thay nội dung khách hàng hoặc gói sau một yêu cầu đã gửi phải tạo UUID mới.

`note` và `attribution` không bắt buộc. Không gửi thêm trường ngoài hợp đồng. `items` chỉ nhận `sku`, `volumeMl`, `quantity`; tên và đơn giá được lấy từ catalog trên server. Số tiền phải là số nguyên VND, không phải chuỗi. Server tự tính mọi khoản và từ chối giá frontend không khớp.

### Transport Apps Script

Giữ cách gửi form POST vào iframe ẩn để tránh suy ra thành công từ phản hồi opaque. Các field ngoài JSON payload:

| Field | Giá trị |
| --- | --- |
| `payload` | JSON.stringify(payload ở trên) |
| `responseMode` | `bridge` |
| `parentOrigin` | `window.location.origin` chính xác |
| `requestId` | Cùng UUID với `payload.idempotencyKey` |
| `responseToken` | Token ngẫu nhiên riêng cho lần gửi, 32–128 ký tự A–Z/a–z/0–9/_/- |

Frontend chỉ xác nhận đã nhận đơn khi nhận `postMessage` từ origin Google được chấp nhận, đúng iframe (hoặc iframe con Google), đúng `requestId`, đúng `responseToken`, đúng phiên bản, gói, dòng hàng và toàn bộ số tiền.

ACK thành công giữ `type: 'tfl:order-result'` và thêm `schemaVersion: 2`, `receiverVersion: 2`, `offerId`, `items`, `subtotal`, `shipping`, `discount`, `quantity`, `total`, `currency`, `orderId`, `duplicate`. Không chứa tên, số điện thoại, địa chỉ hoặc ghi chú. ACK chỉ được tạo sau khi lưu và flush thành công; đây là xác nhận nhận yêu cầu, không phải xác nhận đã thanh toán.

ACK lỗi có `success:false`, `code`, `message`, `retryable`. Trường hợp timeout không được tự kết luận đã lưu hoặc chưa lưu. Thử lại cùng UUID để tránh tạo trùng.

JSON POST trực tiếp vẫn được hỗ trợ cho tích hợp phù hợp. Không xem allowlist origin hay response token là xác thực người mua: đây là endpoint nhận yêu cầu ẩn danh; allowlist và token bảo vệ tuyến phản hồi bridge. Không đặt khóa bí mật trong frontend.

## Lưu dữ liệu

`Code.gs` giữ nguyên spreadsheet đích của hệ thống cũ, nhưng dùng tab mới **`Don_hang_Web_v2`** và cấu trúc cột riêng. Không đổi hay xóa dữ liệu tab cũ. Nếu muốn đổi tên tab v2, đặt Script Property `ORDER_SHEET_NAME_V2`. Thuộc tính v1 `ORDER_SHEET_NAME` không được dùng lại.

Dữ liệu có dòng hàng JSON riêng biệt, số chai trắng, số chai đỏ, tổng số chai, tổng dung tích, giá mua lẻ, giảm combo, tiền sản phẩm, vận chuyển và tổng. Nội dung do khách nhập được trung hòa trước khi ghi vào Sheet để tránh bị diễn giải là công thức.

Khóa script bảo vệ bước tìm mã trùng và ghi hàng. Cùng `idempotencyKey` + cùng nội dung chuẩn hóa trả lại mã đơn trước đó; cùng key nhưng đổi gói/khách/giá trả `REQUEST_CONFLICT`. Không có đường xóa hay sửa đơn thông qua endpoint.

## Triển khai trong tài khoản Google

Bước này cần đăng nhập tài khoản Google có quyền chỉnh sửa Apps Script và spreadsheet của cửa hàng. Mã nguồn cục bộ không cấp quyền đó và không tự cập nhật deployment đang chạy.

1. Mở dự án Apps Script nhận đơn của cửa hàng và lưu lại phiên bản hiện tại.
2. Cập nhật `Code.gs` bằng bản này. Kiểm tra `allowedOrigins`; đã có hai origin tên miền `.shop`, GitHub Pages và origin Sites chính xác được cung cấp cho bản mới. Khi dùng địa chỉ khác, thêm đúng origin, không dùng ký tự đại diện.
3. Chạy `setupOrderSheet()` trong editor và cấp quyền cần thiết. Hàm tạo/kiểm tra tab v2, không tạo đơn.
4. Triển khai phiên bản web app v2 bằng quyền của chủ cửa hàng, với quyền truy cập phù hợp cho khách đặt hàng không cần đăng nhập Google. Dùng URL triển khai `/exec`, không dùng URL editor hay `/dev`.
5. Đọc health và đối chiếu `receiverVersion:2`, ba gói và giá. Chưa bật live nếu health không xác nhận chính xác.
6. Đặt URL `/exec` v2 trong cấu hình frontend, cấu hình phiên bản receiver yêu cầu là 2. Kiểm tra toàn bộ đường gửi/ACK bằng một đơn kiểm thử được chủ cửa hàng cho phép, đối chiếu đúng SKU và số tiền trong Sheet; không suy ra thành công chỉ từ frontend.
7. Sau khi xác minh gói, dung tích, giá, chính sách và đường nhận đơn, bật chế độ live. Endpoint v1 hiện tại không đủ khả năng nhận 540 Đỏ hoặc combo.

Các thay đổi không thực hiện trong phiên làm việc này: đăng nhập Google, cấp quyền, đổi deployment, gửi đơn thật, hoặc chuyển form sang live.

## Kiểm tra cục bộ

Chạy:

```sh
node receiver-test.js
```

Bộ 15 kiểm tra dùng Node VM và giả lập Google Services trong bộ nhớ; không gọi mạng hay gửi đơn. Phạm vi gồm: health và ba bảng giá, SKU/dung tích/số lượng, giá bị sửa, dữ liệu sai, ACK không chứa thông tin khách, retry không trùng, xung đột request, dữ liệu cũ bị sai, khóa bận, flush thất bại, transport sai, origin Sites, trung hòa công thức, tách tab v1/v2.

Các kiểm tra này không thay thế kiểm chứng deployment thực tế, quyền Google Sheet, CORS/iframe trong trình duyệt hoặc việc đơn thật đến được người xử lý.
