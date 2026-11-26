# The Fragrance Lab — Hãy chọn cách bạn xuất hiện

Storefront tiếng Việt cho hai phiên bản Baccarat 540 Trắng và Đỏ, cùng lựa chọn combo Trắng + Đỏ. Câu chuyện tập trung vào phong thái cá nhân: Đỏ mạnh mẽ, quyền lực; Trắng nhẹ nhàng, tinh tế; combo cho hai sắc thái của cùng một người. Giữ ảnh riêng cho từng khu vực, hình nam nữ gần gũi, ưu đãi Tết và bộ font tiếng Việt hoàn chỉnh. HTML/CSS/JavaScript thuần, không có bước cài đặt hay build.

## Trạng thái

- Repository này triển khai storefront tại `https://thefragrancelabperfume.shop/` bằng GitHub Pages, nhánh `main`, thư mục gốc.
- `index.html` ở gốc và `dist/index.html` có cùng nội dung; bản gốc thêm tiền tố `dist/` cho tài nguyên.
- Form hiện ở `mode: 'preview'`: chọn sản phẩm, tính giá, kiểm tra dữ liệu và xem đầy đủ tóm tắt, không gửi yêu cầu đến cửa hàng. Sau khi bật live và nhận ACK v2 hợp lệ, thông tin đơn đầy đủ được giữ trong sessionStorage của tab để mở trang cảm ơn; không đưa dữ liệu khách vào URL, localStorage hay analytics.
- Bộ nhận đơn Google Apps Script v2 đã có mã nguồn và kiểm tra ngoại tuyến; giữ nguyên spreadsheet, tab `Don_hang_Web`, property `ORDER_SHEET_NAME` và 23 cột gốc, chỉ thêm tám cột thông tin sản phẩm ở bên phải. Chưa triển khai thay receiver v1 đang chạy tại endpoint cũ.
- Không có đơn thử nào được gửi vào Google Sheet.

## Ba lựa chọn

| Lựa chọn | Sản phẩm | Giá niêm yết | Giá Tết | Vận chuyển | Tổng thanh toán |
| --- | --- | ---: | ---: | ---: | ---: |
| `white` | 01 Baccarat 540 Trắng, 50ml | 3.995.000đ | 549.000đ | 30.000đ | 579.000đ |
| `red` | 01 Baccarat 540 Đỏ, 50ml | 3.995.000đ | 549.000đ | 30.000đ | 579.000đ |
| `duo` | 01 Trắng + 01 Đỏ, 50ml/chai | 7.990.000đ | 998.000đ | 0đ | 998.000đ |

Giá gạch ngang được khôi phục theo yêu cầu trực tiếp của chủ cửa hàng và đúng bản gốc: `index.html` tại commit `550a824` ghi Trắng 3.995.000đ/chai, 7.990.000đ/hai chai; trang `https://www.thefragrancelab.io.vn/sale` ghi Đỏ “3.995.000 >> 549.000/đ 1 chai”, đã đối chiếu lại bằng HTTP 200 ngày 26/11/2026. Giá niêm yết combo Trắng + Đỏ bằng tổng hai giá niêm yết đơn.

Mức tiết kiệm trình bày theo giá niêm yết: 3.446.000đ cho một chai, 6.992.000đ cho combo. Không dùng 1.098.000đ làm giá gạch ngang của combo. Miễn phí vận chuyển được trình bày riêng. Giá bán 549.000đ/998.000đ, phí ship và payload nhận đơn vẫn giữ nguyên; `listPrice` và `savings` chỉ bổ sung cho giao diện và sự kiện danh mục.

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
- `cam-on.html` và `dist/cam-on.html`: trang cảm ơn đầy đủ sản phẩm, số lượng từng loại, họ tên, số điện thoại, địa chỉ, lời nhắn, tiền hàng, phí ship và thành tiền. Chỉ hiển thị xác nhận khi có receipt hợp lệ được tạo sau ACK.
- `dist/receipt.js`: tạo và kiểm tra receipt với catalog/SKU/giá, lưu trong session của tab sau ACK; storage bị chặn thì hiển thị đủ chi tiết trong hộp thoại, không yêu cầu khách đặt lại.
- `dist/thank-you.js`, `dist/thank-you.css`: giao diện biên nhận, dùng font tiếng Việt hiện tại, không tải pixel hay session replay.
- `tests/receipt-tests.js`: kiểm tra dữ liệu biên nhận, các lỗi lưu trữ, an toàn render và ranh giới preview/live.
- `design/asset-prompts.txt`: prompt và nguồn tham chiếu của các ảnh ImageGen.
- `design/tet-product-prompts.txt`, `design/tet-lifestyle-prompts.txt`: prompt, tham chiếu và cách dùng bộ ảnh mới mùa Tết.
- `design/font-notes.txt`: nguồn chính thức, giấy phép, cách chuẩn bị và kiểm tra bộ font tiếng Việt mới.

## Kiểm tra

```sh
node --check dist/app.js
node --check dist/orders.js
node --check dist/config.js
node --check dist/tracking.js
node tests/frontend-tests.js
node tests/tracking-tests.js
node tests/receipt-tests.js
node integrations/google-apps-script/receiver-test.js
```

Bộ kiểm tra gồm 106 trường hợp ngoại tuyến: 51 frontend, 9 tracking, 27 receipt và 19 receiver. Các kiểm tra receiver bao gồm giữ nguyên 23 cột và dữ liệu đơn cũ. Kiểm tra frontend bổ sung giá niêm yết, số tiền giảm và ba ảnh đặt hàng riêng, đồng thời giữ các kiểm tra hợp đồng payload/health/ACK. Các lệnh trên không gửi đơn thật hoặc gọi dịch vụ analytics.

Khi duyệt giao diện cần kiểm tra desktop và khung điện thoại 375px/345px: không tràn ngang, chữ có dấu và chữ nghiêng hiển thị đúng, ảnh không cắt sai chủ thể, ba lựa chọn đổi đúng ảnh/giá niêm yết/giá Tết/phí ship, menu và modal preview hoạt động. Kiểm tra ngoại tuyến và giao diện không thay thế thử nghiệm triển khai Google thật.

## Thiết kế và nội dung

Thông điệp chính: “Hãy chọn cách bạn xuất hiện”; “Đỏ — mạnh mẽ, quyền lực”; “Trắng — nhẹ nhàng, tinh tế”. Mỗi sản phẩm có câu chuyện phong thái riêng; combo là “Hai sắc thái. Cùng là bạn.” Khối ảnh cặp đôi giữ cảm giác gần gũi với “Gần rồi, khó xa” và “Khoảng cách ngắn lại. Dư âm dài hơn.” Đây là ngôn ngữ thương hiệu gợi cảm xúc, không phải cam kết tác động sinh học hoặc khiến người khác bị thu hút.

Hệ màu kem sáng, đỏ rượu và vàng champagne. Nội dung tình yêu và tặng người thương đã được thay bằng phong cách cá nhân ở hero, danh mục, câu chuyện, combo, hướng dẫn chọn, FAQ, phần kết, metadata và nhận diện trang cảm ơn. Tết được giữ làm chương trình ưu đãi. Ảnh nam nữ trưởng thành, ảnh cặp đôi gần gũi và các phối cảnh sản phẩm được giữ; chú thích hộp quà/phụ kiện không thuộc combo vẫn hiển thị rõ. Những câu nói là nội dung thương hiệu, không phải lời chứng thực của khách hàng. Không dùng số lượng đã bán, tồn kho hay đồng hồ đếm ngược chưa có dữ liệu.

Noto Serif (tên CSS `TFL Editorial`) thay font tiêu đề cũ, có cả kiểu thường và kiểu nghiêng thật. Trục chiều rộng đã cố định 100%; chỉ trục độ đậm thay đổi. Nội dung dùng Be Vietnam Pro 400/500/600/700 với bản đầy đủ thay cho các tệp chia nhỏ theo bộ ký tự. Cả sáu font cục bộ đã kiểm tra đủ chữ Việt dạng NFC và NFD, gồm dấu mũ, dấu râu và dấu trăng. CSS tắt kiểu chữ tổng hợp bằng `font-synthesis: none`; nội dung HTML chuẩn hóa NFC; giãn dòng tiêu đề khoảng 1,28–1,5, nội dung thường 1,9–2. Không dùng biến đổi co kéo chữ.

Sản phẩm được đưa lên đầu màn hình điện thoại; thanh chọn mua cố định cập nhật theo lựa chọn. Nút chọn từ mọi phần đồng bộ cùng một gói, ảnh đặt hàng, giá gạch ngang và tổng tiền. Đường dẫn CSS/JS có hash nội dung để tránh trộn giao diện mới với tài nguyên cũ trong cache.

## Hình ảnh và thông tin cần chốt

- Trắng dùng hình chai trong Eau de Parfum, nhãn đỏ theo ảnh người dùng đính kèm. Điều này thay cho ảnh TFL/540 BLANC nhãn trắng được tạo trong web cũ.
- Đỏ dùng hình chai thủy tinh đỏ, nhãn vàng Extrait de Parfum theo ảnh trên trang `/sale`.
- Bộ ảnh mùa Tết gồm chín ảnh mới: ảnh mở đầu dọc, ảnh bộ đôi ngang dùng cho chia sẻ (OG), phối cảnh quà Tết, ba ảnh Trắng/Đỏ/combo riêng ở phần chọn mua, người nữ, người nam và cặp đôi trong câu chuyện. Hai ảnh danh mục Trắng/Đỏ đã tạo trước được giữ cho đúng vị trí thẻ sản phẩm. Các khu vực nội dung chính không lặp lại cùng một ảnh.
- Hình ảnh được tạo bằng ImageGen theo tham chiếu, không phải ảnh chụp hàng tồn hoặc khách hàng thực tế. Mẫu chai vẫn nhất quán dù bối cảnh và bố cục khác nhau. Các ảnh phong cách có người trưởng thành và không mô phỏng người nổi tiếng.
- Hộp quà, hoa và phụ kiện phối cảnh không thuộc combo; nội dung tại phần ưu đãi và FAQ nói rõ điều này.
- Trang `/sale` có tiêu đề và ảnh ghi 70ml nhưng form ghi 50ml. Bản này tạm dùng 50ml theo form, cần chủ cửa hàng chốt dung tích giao thực tế.
- Chưa xác minh hãng/nguồn gốc hàng; website không tự thêm cam kết “chính hãng” hay thời gian lưu hương cố định.
- Theo yêu cầu chủ cửa hàng, đã bỏ số điện thoại cá nhân và liên kết gọi khỏi trang chủ, trang cảm ơn, cấu hình frontend và tài liệu hiện tại. Trường số điện thoại khách hàng vẫn được giữ để nhận đơn.

## Đồng bộ và triển khai

Repository: `https://github.com/nguyenbao30122000-jpg/baccarat-540-blanc-landing-page`

GitHub Pages phục vụ nhánh `main`, thư mục gốc. Sau khi sửa HTML, CSS hoặc JavaScript, chạy:

```sh
node scripts/sync-pages.mjs
```

Lệnh này gắn phiên bản theo SHA-256 của CSS/JS và đồng bộ cả trang chủ lẫn trang cảm ơn ở thư mục gốc và dist. Nhờ đó, người từng mở bản cũ không nhận HTML mới ghép với CSS hoặc JavaScript còn lưu trong cache. Chạy lại không làm đổi phiên bản nếu nội dung tài nguyên giữ nguyên.

Giữ `CNAME` là `thefragrancelabperfume.shop` và `.nojekyll`. Không có bước build hay dependency bên ngoài. Ảnh OG và canonical trỏ về tên miền thật; `noindex,nofollow` được giữ theo cấu hình trước đó trong khi thông tin sản phẩm và nhận đơn trực tuyến còn chờ chốt.

Trước khi mở nhận đơn: xác nhận dung tích và hình chai giao thực tế; triển khai Apps Script v2 theo hướng dẫn trong `integrations/google-apps-script`; kiểm tra health v2 và đường lưu/ACK; cập nhật endpoint khi cần rồi đổi `mode` sang `live`. GitHub Pages chỉ cập nhật mã nguồn, không tự triển khai Apps Script. Chế độ live tự chặn receiver v1 hoặc giá không khớp. Bản cập nhật mùa Tết không sửa receiver hoặc bật nhận đơn.

Form hiện ở preview, không tạo đơn. GET chỉ đọc xác nhận endpoint thực tế vẫn trả `version:1`. Giữ endpoint cũ và cập nhật chính deployment Apps Script sang bản v2 trước khi đổi `mode` sang `live`. Không có đơn thử nào được gửi vào Sheet.

## Đo lường

Giữ các định danh đã có của website gốc: GA4 `G-YNKR6EDF5D`, Meta Pixel `4503743036565644`, TNANO script và endpoint trong `dist/config.js`. Tracking chỉ chạy trên tên miền sản xuất được khai báo, không chạy trên localhost, bản xem riêng hoặc iframe duyệt giao diện. Các sự kiện lựa chọn/checkout chứa SKU và giá từng gói; không chứa họ tên, số điện thoại, địa chỉ hoặc ghi chú. Lead chỉ ghi nhận sau ACK v2 hợp lệ trong chế độ live; thao tác xem trước không phải đơn thành công. Không phát `purchase` cho yêu cầu đặt hàng chưa thanh toán.

Trang cảm ơn không tải dịch vụ đo lường hoặc replay. Dữ liệu khách được render bằng `textContent`, không nội suy HTML. Toàn bộ form và hộp thoại đơn có `rr-block`, `rr-mask`, `data-private`, từng trường khách có marker che dữ liệu. Việc đã tải script replay không chứng minh đã ghi hoặc che dữ liệu: cần kiểm chứng bản ghi trong dashboard của chủ cửa hàng. Lỗi dịch vụ đo lường không làm gián đoạn lựa chọn hoặc đặt hàng.

## Nguồn đối chiếu

- https://thefragrancelabperfume.shop/
- https://www.thefragrancelab.io.vn/sale
- https://github.com/nguyenbao30122000-jpg/baccarat-540-blanc-landing-page

Đối chiếu ngày 26/11/2026, giờ Việt Nam. Các mức giá/cấu hình từ nguồn công khai tại thời điểm đối chiếu, không phải chứng minh về sản phẩm được giao thực tế.
