# The Fragrance Lab — Bộ đôi Baccarat 540

Bản thiết kế storefront tiếng Việt cho hai phiên bản Baccarat 540 Trắng và Đỏ, cùng lựa chọn combo Trắng + Đỏ. HTML/CSS/JavaScript thuần, không có bước cài đặt hay build.

## Trạng thái

- Repository này triển khai storefront tại `https://thefragrancelabperfume.shop/` bằng GitHub Pages, nhánh `main`, thư mục gốc.
- `index.html` ở gốc và `dist/index.html` có cùng nội dung; bản gốc thêm tiền tố `dist/` cho tài nguyên.
- Form hoạt động ở `mode: 'preview'`: chọn sản phẩm, tính giá, kiểm tra dữ liệu và xem tóm tắt. Không gửi yêu cầu đến cửa hàng; không ghi dữ liệu khách vào localStorage/sessionStorage.
- Bộ nhận đơn Google Apps Script v2 đã có mã nguồn và kiểm tra ngoại tuyến; chưa triển khai thay endpoint v1.
- Không có đơn thử nào được gửi vào Google Sheet.

## Ba lựa chọn

| Lựa chọn | Sản phẩm | Tiền sản phẩm | Vận chuyển | Tổng |
| --- | --- | ---: | ---: | ---: |
| `white` | 01 Baccarat 540 Trắng, 50ml | 549.000đ | 30.000đ | 579.000đ |
| `red` | 01 Baccarat 540 Đỏ, 50ml | 549.000đ | 30.000đ | 579.000đ |
| `duo` | 01 Trắng + 01 Đỏ, 50ml/chai | 998.000đ | 0đ | 998.000đ |

Giá combo phối hai phiên bản là đề xuất áp dụng từ ưu đãi hai chai đang có. Hai trang nguồn chỉ ghi combo cùng loại, nên cần chủ cửa hàng xác nhận trước khi mở đơn thật. Tiết kiệm 100.000đ là tiền sản phẩm so với 549.000đ × 2; miễn phí vận chuyển trình bày riêng.

## Cấu trúc

- `dist/index.html`: toàn bộ storefront.
- `dist/styles.css`: giao diện responsive, typography, mobile sticky CTA, reduced motion.
- `dist/app.js`: danh mục ba lựa chọn, chọn SKU, tính tổng, validation, trạng thái preview/live, kiểm tra receiver v2, xác nhận sau ACK.
- `dist/orders.js`: transport Apps Script iframe, kiểm tra nguồn phản hồi/token/request ID và timeout.
- `dist/config.js`: cấu hình chế độ và URL receiver hiện có; mặc định preview.
- `dist/assets/`: ảnh WebP và font cục bộ kèm giấy phép.
- `integrations/google-apps-script/`: receiver v2, hợp đồng payload, hướng dẫn triển khai và test.
- `tests/frontend-tests.js`: kiểm tra logic danh mục, số điện thoại, payload, health và ACK.
- `tests/tracking-tests.js`: kiểm tra bằng mô phỏng việc phân biệt ba gói, chặn conversion ở preview, chống ghi nhận trùng và không gửi thông tin khách vào analytics.
- `scripts/sync-pages.mjs`: đồng bộ root `index.html` từ `dist/index.html`, giữ đúng đường dẫn tài nguyên và ảnh thay đổi theo lựa chọn.
- `dist/tracking.js`: giữ GA4, Meta Pixel và TNANO của website gốc; sự kiện sản phẩm phân biệt Trắng, Đỏ và combo.
- `review.html` và `dist/review.html`: xem giao diện ở các kích thước; không phát tracking trong iframe.
- `cam-on.html` và `dist/cam-on.html`: đường dẫn cũ được giữ tương thích, dẫn về bộ sưu tập và không tự xác nhận đơn hàng.
- `design/asset-prompts.txt`: prompt và nguồn tham chiếu của các ảnh ImageGen.

## Kiểm tra

```sh
node --check dist/app.js
node --check dist/orders.js
node --check dist/config.js
node --check dist/tracking.js
node tests/frontend-tests.js
node tests/tracking-tests.js
node integrations/google-apps-script/receiver-test.js
```

68 kiểm tra ngoại tuyến đã đạt: 44 cho frontend, 9 tình huống tracking và 15 cho receiver. Đã duyệt trong trình duyệt ở kích thước desktop và các khung nội dung điện thoại 375px/345px; không tràn ngang. Đã thử chuyển ba gói, menu điện thoại, lỗi form và modal kiểm tra đơn ở chế độ preview. Kiểm tra này không thay thế thử nghiệm triển khai Google thật.

## Thiết kế và nội dung

Hệ màu kem sáng, đỏ rượu và vàng champagne. Cormorant Garamond cho tiêu đề; Be Vietnam Pro cho nội dung. Sản phẩm được đưa lên đầu màn hình điện thoại. Nút chọn từ mọi phần đồng bộ một lựa chọn và một tổng tiền.

Copy xoay quanh “Hai sắc thái. Một dấu ấn riêng.”, tiến từ bộ sưu tập đến câu chuyện, combo, tư vấn lựa chọn và đặt hàng. Giá combo nổi bật bằng so sánh giá mua lẻ thực tế. Không dùng đánh giá khách hàng, số lượng đã bán, tồn kho, đồng hồ đếm ngược hoặc chứng nhận xuất xứ chưa có bằng chứng.

## Hình ảnh và thông tin cần chốt

- Trắng dùng hình chai trong Eau de Parfum, nhãn đỏ theo ảnh người dùng đính kèm. Điều này thay cho ảnh TFL/540 BLANC nhãn trắng được tạo trong web cũ.
- Đỏ dùng hình chai thủy tinh đỏ, nhãn vàng Extrait de Parfum theo ảnh trên trang `/sale`.
- Các ảnh mới là ảnh phối cảnh ImageGen, không phải ảnh chụp hàng tồn thực tế. Cùng một ảnh mỗi SKU được dùng nhất quán ở thẻ sản phẩm và tóm tắt đơn.
- Trang `/sale` có tiêu đề và ảnh ghi 70ml nhưng form ghi 50ml. Bản này tạm dùng 50ml theo form, cần chủ cửa hàng chốt dung tích giao thực tế.
- Chưa xác minh hãng/nguồn gốc hàng; website không tự thêm cam kết “chính hãng” hay thời gian lưu hương cố định.
- Hotline 0358885789 xuất hiện trong popup cảm ơn của trang `/sale`; không tự gắn nhãn Zalo khi chưa xác nhận tài khoản.

## Đồng bộ và triển khai

Repository: `https://github.com/nguyenbao30122000-jpg/baccarat-540-blanc-landing-page`

GitHub Pages phục vụ nhánh `main`, thư mục gốc. Sau khi sửa HTML, CSS hoặc JavaScript, chạy:

```sh
node scripts/sync-pages.mjs
```

Lệnh này gắn phiên bản theo SHA-256 của CSS/JS và đồng bộ hai trang chủ. Nhờ đó, người từng mở bản cũ không nhận HTML mới ghép với CSS hoặc JavaScript còn lưu trong cache. Chạy lại không làm đổi phiên bản nếu nội dung tài nguyên giữ nguyên.

Giữ `CNAME` là `thefragrancelabperfume.shop` và `.nojekyll`. Không có bước build hay dependency bên ngoài. Ảnh OG và canonical trỏ về tên miền thật; `noindex,nofollow` được giữ theo cấu hình trước đó trong khi thông tin sản phẩm và nhận đơn trực tuyến còn chờ chốt.

Trước khi mở nhận đơn: xác nhận combo, dung tích và hình chai thực tế; triển khai Apps Script v2 theo hướng dẫn trong `integrations/google-apps-script`; kiểm tra health v2 và đường lưu/ACK; cập nhật endpoint khi cần rồi đổi `mode` sang `live`. GitHub Pages chỉ cập nhật mã nguồn, không tự triển khai Apps Script. Chế độ live tự chặn receiver v1 hoặc giá không khớp.

Form hiện ở preview, không tạo đơn; đã có liên kết gọi 0358885789 ngay dưới nút kiểm tra lựa chọn để khách liên hệ cửa hàng. Không thay thành `live` chỉ vì giao diện đã lên tên miền.

## Đo lường

Giữ các định danh đã có của website gốc: GA4 `G-YNKR6EDF5D`, Meta Pixel `4503743036565644`, TNANO script và endpoint trong `dist/config.js`. Tracking chỉ chạy trên tên miền sản xuất được khai báo, không chạy trên localhost, bản xem riêng hoặc iframe duyệt giao diện. Các sự kiện lựa chọn/checkout chứa SKU và giá từng gói; không chứa họ tên, số điện thoại, địa chỉ hoặc ghi chú. Lead chỉ ghi nhận sau ACK v2 hợp lệ trong chế độ live; thao tác xem trước không phải đơn thành công. Không phát `purchase` cho yêu cầu đặt hàng chưa thanh toán.

Toàn bộ form và hộp thoại đơn có `rr-block`, `rr-mask`, `data-private`, từng trường khách có marker che dữ liệu. Việc đã tải script replay không chứng minh đã ghi hoặc che dữ liệu: cần kiểm chứng bản ghi trong dashboard của chủ cửa hàng. Lỗi dịch vụ đo lường không làm gián đoạn lựa chọn hoặc đặt hàng.

## Nguồn đối chiếu

- https://thefragrancelabperfume.shop/
- https://www.thefragrancelab.io.vn/sale
- https://github.com/nguyenbao30122000-jpg/baccarat-540-blanc-landing-page

Đối chiếu ngày 26/11/2026, giờ Việt Nam. Các mức giá/cấu hình từ nguồn công khai tại thời điểm đối chiếu, không phải chứng minh về sản phẩm được giao thực tế.
