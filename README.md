# The Fragrance Lab · 540 Blanc

Landing page tiếng Việt, HTML/CSS/JavaScript thuần, cho Baccarat 540 Trắng 50ml.

## Xem website

- Landing page: https://nguyenbao30122000-jpg.github.io/baccarat-540-blanc-landing-page/
- Duyệt giao diện máy tính và điện thoại: https://nguyenbao30122000-jpg.github.io/baccarat-540-blanc-landing-page/review.html

GitHub Pages phục vụ nhánh `main`, thư mục `/ (root)`. File `index.html` ở gốc là trang chủ; `.nojekyll` giữ nguyên website HTML tĩnh. README này chỉ là hướng dẫn mã nguồn.

## Mở và chỉnh sửa

- `dist/index.html`: landing page chính, 12 phần nội dung.
- `dist/styles.css`: giao diện responsive và quy tắc typography.
- `dist/app.js`: menu, tầng hương dạng tab, lựa chọn combo, kiểm tra và xem lại đơn.
- `dist/config.js`: chế độ form, endpoint và hai gói giá.
- `dist/orders.js`: gửi đơn và chờ xác nhận đã lưu từ Apps Script.
- `dist/tracking.js`: Google Analytics 4 và TNANO Replay.
- `cam-on.html` và `dist/cam-on.html`: trang cảm ơn sau khi hệ thống xác nhận đã lưu đơn.
- `dist/thank-you.js`, `dist/thank-you.css`: kiểm tra biên nhận và giao diện trang cảm ơn.
- `integrations/google-apps-script/`: bộ nhận đơn cho Google Sheet, hướng dẫn triển khai và kiểm tra.
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

Mặc định `mode: 'preview'`, `orderEndpoint: ''`. Form tạm khóa các trường thông tin khách và nút gửi, với thông báo rõ trước phần nhập liệu. Form chỉ mở khi có chế độ live, URL nhận đơn hợp lệ và module nhận đơn đã tải thành công. HTML mặc định dùng POST và khóa các trường để tránh gửi thông tin vào query URL nếu JavaScript không tải được.

Sau ACK thành công, trang lưu mã đơn, số lượng, các khoản tiền và thời điểm vào `sessionStorage`, rồi chuyển tới `cam-on.html`. Không lưu tên, điện thoại, địa chỉ hoặc ghi chú vào biên nhận này. Trang cảm ơn không phát thêm lead hoặc purchase; truy cập trực tiếp không có biên nhận sẽ không hiển thị xác nhận đơn thành công. Nếu trình duyệt chặn storage, khách vẫn nhận xác nhận ngay trong trang đặt hàng.

Đã chuẩn bị bộ nhận đơn cho Google Sheet **Baccarat 540 trắng**, ID `1O-QtB1kgtPPfwxzRHl6JlLfCnVb0javKbG8pCAaSoQQ`. Bộ nhận tạo tab `Don_hang_Web`, kiểm tra dữ liệu, tự tính giá và chống trùng bằng `idempotencyKey`. Mã ở `integrations/google-apps-script/Code.gs`; hướng dẫn triển khai nằm trong cùng thư mục.

**Chưa triển khai Apps Script và chưa bật nhận đơn thật.** Cần đăng nhập Google để triển khai Web app, lấy URL `/exec`, đặt URL đó vào `orderEndpoint` rồi bật `mode: 'live'` sau khi kiểm thử. Google Sheet URL không phải endpoint nhận POST của form.

Transport `apps-script` gửi form POST vào iframe và chờ thông điệp xác nhận từ Google, có kiểm tra nguồn, iframe, request ID và token phản hồi. Chỉ hiển thị thành công sau xác nhận đã lưu đơn; timeout vẫn giữ cùng mã yêu cầu khi thử lại. Không suy ra thành công từ iframe load hoặc phản hồi opaque `no-cors`. Nhánh JSON/CORS vẫn có sẵn cho endpoint HTTPS khác.

Payload gồm sản phẩm/SKU, số lượng, họ tên, điện thoại, địa chỉ, ghi chú, các khoản tiền, currency và UTM cho phép. Không đưa token đăng nhập hay khóa bí mật vào config.js. Không cài Meta Pixel hoặc CAPI.

## Tracking đã cấu hình

- GA4: `G-YNKR6EDF5D`. Các sự kiện: `page_view`, `view_item`, `cta_click`, `select_offer`, `begin_checkout`, `generate_lead`.
- `generate_lead` chỉ phát sau xác nhận đã nhận đơn; không ghi nhận `purchase` cho yêu cầu đặt hàng chưa thanh toán. Tên, điện thoại, địa chỉ, ghi chú và mã đơn không được đưa vào payload GA.
- Giữ nguồn chiến dịch bằng 6 tham số UTM cho phép, không gửi toàn bộ query URL.
- TNANO Replay tải đúng script do chủ cửa hàng cung cấp và gọi `window.TNANOReplay.initReplay({endpoint: 'https://tnano-session-replay.baovan-tnano.workers.dev'})`.
- Các dịch vụ tải bất đồng bộ, lỗi của tracking không chặn form. Bản iframe xem giao diện và localhost không gửi tracking. Website HTTPS công khai vẫn có tracking khi form còn preview.
- Đã thêm marker `rr-block`, `rr-mask`, `data-private` vào trường khách và phần xem lại đơn. **Chưa xác minh thư viện TNANO tuân thủ các marker hoặc đã che thông tin khách**: URL source trả HTTP 403 trong môi trường kiểm tra. Không coi lời gọi init thành công là bằng chứng đã nhận bản ghi.

Trạng thái tải kỹ thuật có thể kiểm tra qua thuộc tính `data-tfl-analytics` và `data-tfl-replay` trên thẻ `html`. Dữ liệu trên GA Realtime và dashboard replay cần được xác minh trong tài khoản của chủ cửa hàng.

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

GitHub Pages là bản website công khai. Form còn ở chế độ duyệt trong khi chờ triển khai Google Apps Script; cấu hình tên miền riêng cũng chưa hoàn tất. Thiết kế, nội dung và giá được giữ nguyên trong lần tích hợp này.

## Bản sao GitHub

Repository này chứa mã nguồn độc lập và các ảnh gốc hiện có trong source-assets. GitHub Pages dùng `index.html` ở gốc, tham chiếu CSS, JavaScript, ảnh và font trong `dist/`. `review.html` ở gốc dùng cùng trang chủ đó để duyệt các kích thước màn hình.

Bản `dist/index.html` vẫn hoạt động độc lập để triển khai toàn bộ thư mục `dist` lên hosting khác. Khi sửa nội dung HTML, cập nhật đồng bộ `dist/index.html` và `index.html` ở gốc; bản ở gốc thêm tiền tố `dist/` vào các đường dẫn tài nguyên, còn anchor nội bộ giữ nguyên. Các file CSS, JavaScript, ảnh và font chỉ có một bản trong `dist/`.

Cấu hình định danh riêng của bản xem duyệt trên Sites không nằm trong repository. Thẻ `og:image` ở cả hai trang đã dùng URL GitHub Pages; cần cập nhật theo tên miền mới nếu triển khai ở một nơi khác.
