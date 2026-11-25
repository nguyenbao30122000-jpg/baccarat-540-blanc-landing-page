# The Fragrance Lab · 540 Blanc

Landing page tiếng Việt, HTML/CSS/JavaScript thuần, cho Baccarat 540 Trắng 50ml.

## Mở và chỉnh sửa

- `dist/index.html`: landing page chính, 12 phần nội dung.
- `dist/styles.css`: giao diện responsive và quy tắc typography.
- `dist/app.js`: menu, tầng hương dạng tab, lựa chọn combo, kiểm tra và xem lại đơn.
- `dist/config.js`: chế độ form, endpoint và hai gói giá.
- `dist/review.html`: trình duyệt giao diện máy tính / tablet / điện thoại.
- `dist/assets/`: 6 ảnh WebP tạo riêng cho concept, favicon, font Be Vietnam Pro và giấy phép OFL.

Có thể mở index.html để xem cục bộ, hoặc phục vụ toàn bộ dist bằng hosting tĩnh. Không cần cài thư viện npm hay tải font từ bên thứ ba.

## Giá đã xác nhận từ yêu cầu

| Gói | Tiền sản phẩm | Vận chuyển | Tổng |
| --- | ---: | ---: | ---: |
| 1 chai 50ml | 549.000đ | 30.000đ | 579.000đ |
| 2 chai, 50ml/chai | 998.000đ | 0đ | 998.000đ |

Combo tiết kiệm 100.000đ tiền sản phẩm so với 2 × 549.000đ. Không dùng con số 130.000đ trong bản nháp trước.

## Trạng thái form

Mặc định `mode: 'preview'`, `orderEndpoint: ''`. Thông tin chỉ dùng để xem lại trong trang; không gửi qua mạng, không phát sinh đơn, không lưu thông tin khách vào localStorage/cookie.

Để nhận đơn thật, cần endpoint HTTPS do cửa hàng quản lý, hỗ trợ POST JSON và CORS cho origin được dùng. Chỉ bật `mode: 'live'` sau khi cấu hình và kiểm tra endpoint đó. Endpoint phải xác thực dữ liệu, tự tính giá từ SKU/gói, chống trùng bằng `idempotencyKey` và chỉ trả `{ "success": true, "orderId": "..." }` khi đã lưu đơn thành công. Không tin giá do trình duyệt gửi. Nhánh live đã được chuẩn bị nhưng chưa kết nối hoặc kiểm thử với hệ thống nhận đơn thực tế.

Payload gồm sản phẩm/SKU, số lượng, họ tên, điện thoại, địa chỉ, ghi chú, các khoản tiền, currency và UTM cho phép. Không đưa token hay khóa bí mật vào config.js. Có sự kiện DOM `tfl:offer_selected` và `tfl:order_received` để nối tracking theo hệ thống của cửa hàng; chưa cài Meta Pixel hoặc CAPI.

Đây là mã nguồn landing page độc lập, không phải tệp dự án nội bộ .ladipage. Khi tích hợp vào LadiPage cần dùng phương án xuất bản/custom HTML tương thích với tài khoản hiện có hoặc dựng lại trong editor. Chưa chỉnh sửa trang đang chạy tại thefragrancelab.io.vn/sale.

## Nội dung và hình ảnh

Phong cách hình ảnh theo concept người dùng duyệt: kem, champagne, nâu trầm, ánh sáng điện ảnh, ảnh người mẫu trưởng thành. Ảnh do ImageGen tạo để minh họa concept; nhãn THE FRAGRANCE LAB / 540 BLANC / 50 ML. Hình ảnh không chứng minh bao bì giao thực tế, nguồn gốc, quà tặng hay hiệu năng sản phẩm. Không có feedback giả, số đơn giả, countdown hoặc thời gian lưu hương chưa xác nhận.

Các câu slogan được sáng tác cho trang, không gắn tên người nổi tiếng. Sắc thái hương dựa trên mô tả dòng tham chiếu Baccarat Rouge 540; nguồn hãng để đối chiếu: https://www.franciskurkdjian.com/int-en/p/baccarat-rouge-540-eau-de-parfum-RA12231.html . Không trình bày như phân tích thành phần của mẫu đang bán.

## Kiểm tra đã thực hiện

- Kiểm tra cú pháp JavaScript, asset nội bộ, ID duy nhất và UTF-8 NFC.
- Font Be Vietnam Pro 400/500/600/700, Vietnamese/Latin-ext/Latin, có glyph tiếng Việt.
- Duyệt desktop và khung mobile (bao gồm nội dung rộng 345px và 375px): không tràn ngang.
- Kiểm tra menu mobile, tab tầng hương, chọn 2 gói, tổng 579.000đ/998.000đ.
- Form bắt lỗi trường trống và số điện thoại, xem lại đơn đúng giá, trạng thái preview không gửi đơn.
- CTA mobile tự ẩn khi form đã vào vùng nhìn; hỗ trợ bàn phím, focus và reduced motion.

Trang được xuất bản riêng tư để duyệt. Khi mở bán công khai cần cập nhật thông tin sản phẩm/chính sách thực tế, kết nối nhận đơn, cấu hình tên miền và tracking theo yêu cầu của chủ cửa hàng.

## Bản sao GitHub

Repository này chứa mã nguồn độc lập và các ảnh gốc hiện có trong source-assets. Khi triển khai, chọn thư mục dist làm thư mục xuất bản. Cấu hình định danh riêng của bản xem duyệt trên Sites không nằm trong repository. Thẻ og:image cần cập nhật theo tên miền mới nếu triển khai ở một nơi khác.
