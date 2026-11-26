# The Fragrance Lab — bộ nhận đơn v2

Bộ nhận đơn Google Apps Script cho ba lựa chọn: Baccarat 540 Pearl (Trắng), Baccarat 540 Ruby (Đỏ), hoặc bộ đôi Pearl + Ruby gồm một chai mỗi loại. Mỗi chai trong cấu hình này là 50ml. Đây là mã nguồn tích hợp đã kiểm tra cục bộ, **chưa triển khai lên tài khoản Google và chưa bật nhận đơn thật**.

## Giá và dòng hàng

| `offerId` | Sản phẩm | Tiền sản phẩm | Vận chuyển | Tổng |
| --- | --- | ---: | ---: | ---: |
| `white` | `TFL-540-BLANC-50` × 1 | 549.000đ | 30.000đ | 579.000đ |
| `red` | `TFL-540-ROUGE-50` × 1 | 549.000đ | 30.000đ | 579.000đ |
| `duo` | Mỗi SKU trên × 1 | 998.000đ | 0đ | 998.000đ |

Combo có giá mua lẻ của hai sản phẩm là 1.098.000đ, giảm 100.000đ, còn 998.000đ. Phần giảm này tính trên tiền sản phẩm, tách biệt khỏi vận chuyển. `items[].unitPrice` và `items[].lineSubtotal` trong dữ liệu lưu là giá mua lẻ trước giảm combo; cột `Giam_combo` ghi mức giảm toàn đơn.

Pearl và Ruby là tên hiển thị cho hai lựa chọn Trắng và Đỏ tại The Fragrance Lab. Tên mới được ghi vào `San_pham` và tên từng dòng hàng; `offerId`, SKU, giá, dung tích và cấu trúc Sheet giữ nguyên. Đơn hàng cũ giữ tên đã lưu, không đổi dữ liệu lịch sử.

Các mức giá và dung tích là cấu hình của bản thiết kế mới. Nguồn bán hàng cũ có thông tin 50ml/70ml chưa thống nhất; cần chốt đúng hàng giao trước khi bật bán thật. Việc đổi tên hiển thị không bổ sung cam kết về nồng độ hoặc bao bì.

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

Phản hồi thực tế còn có các trường mô tả dịch vụ và dòng hàng. Frontend phải kiểm tra phiên bản, các gói và giá trước khi mở form. Phản hồi receiver v1, lỗi đọc JSON, lỗi mạng hoặc khác giá phải giữ chức năng gửi đơn đóng và thông báo rõ trạng thái. Health chỉ xác minh dịch vụ/khả năng, không chứng minh một đơn đã lưu.

Kiểm tra GET chỉ đọc trong đợt sửa này nhận HTTP 200 với `{"ok":true,"service":"TFL order receiver","version":1}` từ endpoint đang cấu hình. Bộ nhận đang chạy vẫn là v1. Không có POST hoặc đơn thử nào được gửi. Receiver v1 cố định tên và SKU Trắng ở phía server; không được giả SKU Trắng rồi nhét lựa chọn Đỏ/combo vào ghi chú để vượt qua giới hạn này.

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

`Code.gs` giữ nguyên spreadsheet đích, tab **`Don_hang_Web`** và Script Property **`ORDER_SHEET_NAME`** của hệ thống cũ. Nếu tài khoản đã có `ORDER_SHEET_NAME`, bộ nhận tiếp tục dùng đúng tab đó. Không tạo tab `Don_hang_Web_v2`, không sử dụng `ORDER_SHEET_NAME_V2`, không đổi endpoint.

**23 cột hiện có được giữ nguyên tên, thứ tự và ý nghĩa.** Dữ liệu đơn cũ không được ghi lại, xóa hay chuyển sang tab khác:

| Cột | Trường hiện có | Dữ liệu đơn mới |
| --- | --- | --- |
| A–E | `Thoi_gian_VN`, `Ma_don`, `Idempotency_key`, `Payload_hash`, `Trang_thai` | Thời gian, mã đơn, chống trùng, dấu vân tay nội dung và trạng thái |
| F | `San_pham` | Tên đúng của Trắng, Đỏ hoặc combo |
| G | `SKU` | SKU đúng; combo ghi hai SKU nối bằng ` + ` |
| H | `Dung_tich_ml` | 50ml mỗi chai, giữ ý nghĩa cột cũ |
| I | `So_luong` | Tổng số chai, 1 hoặc 2 |
| J–M | `Tien_san_pham`, `Phi_van_chuyen`, `Tong_thanh_toan`, `Tien_te` | Giá server tính, phí ship, thành tiền và VND |
| N–Q | `Ho_va_ten`, `Dien_thoai`, `Dia_chi`, `Ghi_chu` | Thông tin nhận hàng và nguyên lời nhắn của khách |
| R–W | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `Nguon_website` | Nguồn truy cập như trước |

Bộ nhận bổ sung tám cột ở bên phải, từ X đến AE: `Phien_ban`, `Ma_goi`, `Chi_tiet_san_pham_JSON`, `So_chai_trang`, `So_chai_do`, `Tong_dung_tich_ml`, `Gia_mua_le`, `Giam_combo`. Các cột này phân biệt rõ dòng hàng và số chai từng màu; `Ghi_chu` vẫn dành riêng cho lời nhắn của khách.

`setupOrderSheet()` kiểm tra chính xác 23 tiêu đề cũ trước khi bổ sung tiêu đề mới. Nếu phần cột bổ sung đã có tiêu đề lạ hoặc dữ liệu chưa có tiêu đề, hàm dừng với `SHEET_CONFIGURATION` thay vì đè dữ liệu. Chạy lại không tạo thêm cột trùng và không viết lại các hàng đơn cũ. Nội dung do khách nhập được trung hòa trước khi ghi vào Sheet để tránh bị diễn giải là công thức.

Khóa script bảo vệ bước tìm mã trùng và ghi hàng. Cùng `idempotencyKey` + cùng nội dung chuẩn hóa trả lại mã đơn trước đó; cùng key nhưng đổi gói/khách/giá trả `REQUEST_CONFLICT`. Không có đường xóa hay sửa đơn thông qua endpoint.

## Triển khai trong tài khoản Google

Bước này cần đăng nhập tài khoản Google có quyền chỉnh sửa Apps Script và spreadsheet của cửa hàng. Mã nguồn cục bộ không cấp quyền đó và không tự cập nhật deployment đang chạy.

1. Mở dự án Apps Script nhận đơn của cửa hàng và lưu lại phiên bản hiện tại.
2. Cập nhật `Code.gs` bằng bản này. Kiểm tra `allowedOrigins`; đã có hai origin tên miền `.shop`, GitHub Pages và origin Sites chính xác được cung cấp cho bản mới. Khi dùng địa chỉ khác, thêm đúng origin, không dùng ký tự đại diện.
3. Giữ nguyên Script Property `ORDER_SHEET_NAME` nếu đã đặt. Chạy `setupOrderSheet()` trong editor và cấp quyền cần thiết. Hàm kiểm tra tab hiện có và chỉ thêm tám tiêu đề bên phải; không tạo đơn hoặc sửa dữ liệu đơn cũ.
4. Trong **Manage deployments**, sửa chính deployment web app hiện có sang phiên bản mới để giữ URL `/exec` đang dùng. Giữ quyền truy cập nhận đơn hiện có của cửa hàng; không cần tạo spreadsheet, tab hay endpoint khác. Không dùng URL editor hoặc `/dev` ở frontend.
5. Đọc health và đối chiếu `receiverVersion:2`, ba gói và giá. Chưa bật live nếu health không xác nhận chính xác.
6. Giữ URL `/exec` hiện có trong cấu hình frontend, với phiên bản receiver yêu cầu là 2. Kiểm tra toàn bộ đường gửi/ACK bằng một đơn kiểm thử được chủ cửa hàng cho phép, đối chiếu đúng SKU, thông tin khách, lời nhắn và số tiền trong chính tab cũ; không suy ra thành công chỉ từ frontend.
7. Sau khi xác minh gói, dung tích, giá, chính sách và đường nhận đơn, bật chế độ live. Endpoint v1 hiện tại không đủ khả năng nhận 540 Đỏ hoặc combo.

Các thay đổi không thực hiện trong phiên làm việc này: đăng nhập Google, cấp quyền, đổi deployment, gửi đơn thật, hoặc chuyển form sang live.

## Kiểm tra cục bộ

Chạy:

```sh
node receiver-test.js
```

Bộ 19 kiểm tra dùng Node VM và giả lập Google Services trong bộ nhớ; không gọi mạng hay gửi đơn. Phạm vi gồm: health và ba bảng giá, SKU/dung tích/số lượng, giá bị sửa, dữ liệu sai, ACK không chứa thông tin khách, retry không trùng, xung đột request, dữ liệu cũ bị sai, khóa bận, flush thất bại, transport sai, origin Sites, trung hòa công thức, giữ nguyên 23 cột và hàng đơn cũ, dùng lại property/tab cũ, dữ liệu từng SKU đúng trong cột gốc và không ghi đè cột tùy chỉnh.

Các kiểm tra này không thay thế kiểm chứng deployment thực tế, quyền Google Sheet, CORS/iframe trong trình duyệt hoặc việc đơn thật đến được người xử lý.
