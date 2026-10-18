# Quy tắc bảo mật (Security Rules) — Nền tảng đặt điều dưỡng bệnh viện chăm sóc tại nhà

*Soạn 2026-10-18 bởi Atlas, dưới góc độ chuyên gia an toàn thông tin. Trạng thái: **đề xuất chờ Phúc/PO + đội kỹ thuật chốt**.*
*Phạm vi áp dụng: toàn bộ hệ thống theo baseline `use_case_diagram.drawio` + `workflow_diagram.drawio` — web app bệnh nhân/nhân sự/quản trị, API backend, tích hợp cổng thanh toán, hạ tầng SaaS đa bệnh viện (multi-tenant).*
*Khung tham chiếu: OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS; pháp lý VN: Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (dữ liệu sức khỏe là **dữ liệu cá nhân nhạy cảm**).*
*Mức ưu tiên: **[P0]** bắt buộc trước khi pilot có người dùng thật · **[P1]** bắt buộc trước go-live chính thức · **[P2]** tăng cường theo lộ trình.*

---

## Nhóm 0 — Nguyên tắc nền (áp dụng cho mọi quyết định kỹ thuật)

- **SEC-0.1 [P0] Không tin phía client.** Mọi kiểm tra quyền, giá, trạng thái đều thực thi ở backend. Giao diện ẩn nút không bao giờ được coi là biện pháp bảo mật. *(Đây chính là BR-09 của baseline — kiểm tra phía backend theo vai trò + quan hệ + phiên + trạng thái.)*
- **SEC-0.2 [P0] Least privilege mặc định.** Mọi tài khoản, vai trò, khóa API, tiến trình chỉ có đúng quyền tối thiểu cần cho việc của mình; quyền thừa phải có lý do và thời hạn.
- **SEC-0.3 [P0] Deny by default.** Endpoint/tài nguyên không có quy tắc cho phép rõ ràng thì mặc định từ chối, không phải mặc định mở.
- **SEC-0.4 [P0] Phòng thủ nhiều lớp.** Không một biện pháp đơn lẻ nào (WAF, CAPTCHA, OTP…) được coi là đủ; mỗi lớp giả định lớp trước nó có thể bị xuyên thủng.
- **SEC-0.5 [P1] Mọi quyết định bảo mật phải truy vết được.** Ai cấp quyền, ai đổi cấu hình bảo mật, ai xem dữ liệu bệnh nhân — đều có audit log (xem Nhóm 9).

## Nhóm 1 — Xác thực & quản lý phiên (điểm yếu số 1 của hệ thống email-only)

- **SEC-1.1 [P0] Mật khẩu lưu bằng thuật toán băm chuyên dụng** (Argon2id hoặc bcrypt với cost phù hợp). Cấm lưu mật khẩu dạng rõ hoặc băm nhanh (MD5/SHA-1/SHA-256 trần). Chính sách mật khẩu: tối thiểu 10 ký tự, kiểm tra danh sách mật khẩu đã lộ (breached-password list), không ép đổi định kỳ vô cớ.
- **SEC-1.2 [P0] OTP qua email phải có đủ 5 thuộc tính:** ngẫu nhiên đủ mạnh (tối thiểu 6 số từ nguồn ngẫu nhiên an toàn), hết hạn ngắn (≤ 10 phút), dùng một lần, khóa sau tối đa 5 lần nhập sai, và giới hạn số lần gửi lại theo tài khoản + IP. *(Áp dụng cho BR-20: OTP email là kênh xác thực duy nhất của bệnh nhân — nó gánh toàn bộ rủi ro mà SMS/CCCD đã bị loại bỏ để tránh.)*
- **SEC-1.3 [P0] Chống dò OTP và brute-force đăng nhập:** rate-limit theo tài khoản + IP + thiết bị; khóa tạm tăng dần (exponential backoff); CAPTCHA sau vài lần thất bại; cảnh báo đăng nhập lạ qua email cho chủ tài khoản.
- **SEC-1.4 [P0] Nhân sự bắt buộc 2FA** (BR-21) — ưu tiên yếu tố chống phishing (passkey/WebAuthn hoặc ứng dụng xác thực TOTP); mã dự phòng (backup code) băm khi lưu và dùng một lần. Bệnh nhân không áp 2FA theo BR-20 nhưng **bước nhạy cảm** (đổi email, đổi mật khẩu, rút consent hàng loạt) phải yêu cầu xác thực lại (re-authentication) bằng OTP email mới.
- **SEC-1.5 [P0] Quản lý phiên:** token phiên sinh ngẫu nhiên an toàn, cookie đặt `HttpOnly + Secure + SameSite=Lax/Strict`; phiên vô hiệu ngay khi đổi mật khẩu/đổi email/thu hồi quyền; timeout phiên nhân sự ngắn hơn bệnh nhân; đăng xuất là hủy phiên phía server, không chỉ xóa cookie phía client.
- **SEC-1.6 [P0] Ba loại mã không được thay thế cho nhau:** OTP tài khoản (email) ≠ mã check-in trong phiên chăm sóc (UC40) ≠ mã xác nhận consent qua link. Mỗi loại có vòng đời, phạm vi và kho lưu riêng. *(Baseline BR-20 đã tách nguyên tắc này — dev tuyệt đối không gộp chung một cơ chế "mã 6 số" cho cả ba.)*
- **SEC-1.7 [P0] Link email (consent, đặt lại mật khẩu, đổi email) là token mang quyền:** token dài ≥ 128-bit ngẫu nhiên, dùng một lần, có hạn, lưu dạng băm phía server; click link không tự thực hiện hành động nhạy cảm mà phải qua bước xác nhận trong phiên.
- **SEC-1.8 [P0] Khôi phục tài khoản khi mất email chỉ theo quy trình tổng đài đã duyệt** (khóa tạm tài khoản ngay khi tiếp nhận; xác minh đa yếu tố đã có trong hệ thống; đổi email hiệu lực sau 24h kèm thông báo tới email cũ; tổng đài không bao giờ nhận/nhập hộ OTP). Cấm mọi đường khôi phục tắt qua hỗ trợ kỹ thuật không theo quy trình này.
- **SEC-1.9 [P1] Chống chiếm đoạt tài khoản hàng loạt:** theo dõi đăng nhập bất thường (IP lạ, nhiều tài khoản cùng IP, tốc độ bất thường), bắt xác thực lại khi đổi thiết bị/vị trí đột ngột đối với tài khoản nhân sự và Platform Admin.

## Nhóm 2 — Phân quyền & cách ly đa bệnh viện (multi-tenant)

- **SEC-2.1 [P0] Mọi request API đều kiểm tra đủ 4 lớp theo BR-09:** (1) vai trò có quyền làm hành động này không, (2) quan hệ của người dùng với đối tượng (bệnh nhân của đơn này? điều dưỡng được giao ca này? quản trị của đúng bệnh viện này?), (3) phiên/token hợp lệ, (4) trạng thái đối tượng có cho phép hành động không. Thiếu một lớp là lỗ hổng.
- **SEC-2.2 [P0] Tenant nằm trong mọi truy vấn:** mọi bản ghi nghiệp vụ đều mang `hospital_id`; tầng dữ liệu tự động lọc theo tenant của người dùng (không tin `hospital_id` do client gửi lên — lấy từ phiên/token đã xác thực). Truy cập chéo bệnh viện phải bất khả thi kể cả khi đoán được ID.
- **SEC-2.3 [P0] Chống IDOR/BOLA (lỗ hổng số 1 của API):** mọi ID trong URL/body (đơn, ca, hồ sơ, báo cáo) đều phải qua kiểm tra quan hệ ở SEC-2.1 trước khi trả dữ liệu. Có bộ test tự động: hoán đổi ID giữa hai bệnh nhân/hai bệnh viện khác nhau và kỳ vọng 403/404 cho mọi endpoint.
- **SEC-2.4 [P0] Không lộ dữ liệu qua thông báo lỗi và metadata:** đối tượng không thuộc quyền truy cập trả về cùng một dạng lỗi như không tồn tại; danh sách/tìm kiếm không làm rò rỉ tổng số bản ghi của tenant khác.
- **SEC-2.5 [P0] Platform Admin không mặc định thấy dữ liệu lâm sàng:** quyền của phía SaaS tách khỏi dữ liệu sức khỏe chi tiết của bệnh nhân; mọi truy cập của Platform Admin vào dữ liệu tenant đều ghi audit log và chỉ trong phạm vi hỗ trợ đã định.
- **SEC-2.6 [P1] Phân quyền theo vai trò con:** vai trò Quản trị BV gồm các vai trò con (Điều phối, Kế toán, Trực SOS…) — cấp quyền theo đúng vai trò con như bảng phân quyền trang 13 của use_case_v8.1, không cấp "quản trị toàn quyền" cho mọi nhân sự vận hành.
- **SEC-2.7 [P1] Thu hồi quyền có hiệu lực tức thì** ở mọi tầng (token, cache quyền, phiên) — đặc biệt khi nhân sự bị khóa tài khoản (vi phạm/bom ca) hoặc nghỉ việc.

## Nhóm 3 — Bảo vệ dữ liệu cá nhân & dữ liệu sức khỏe

- **SEC-3.1 [P0] Phân loại dữ liệu trước khi code:** dữ liệu sức khỏe (triệu chứng, đánh giá, báo cáo chăm sóc) là dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023 — mức bảo vệ cao nhất trong hệ thống; dữ liệu thanh toán và dữ liệu định danh ở mức cao; dữ liệu vận hành ở mức thường. Mọi tính năng mới phải khai báo chạm vào loại dữ liệu nào.
- **SEC-3.2 [P0] Mã hóa khi truyền và khi lưu:** TLS 1.2+ cho mọi kết nối (bắt buộc HTTPS, HSTS); mã hóa ổ đĩa/cơ sở dữ liệu khi lưu; các trường đặc biệt nhạy cảm (nội dung báo cáo chăm sóc) cân nhắc mã hóa ở tầng ứng dụng [P1].
- **SEC-3.3 [P0] Tối thiểu hóa hiển thị (masking):** SĐT/email hiển thị che một phần ở các màn hình không cần đầy đủ; liên lạc BN–ĐD chỉ qua kênh trong ứng dụng ẩn số (UC133) — không hiển thị số điện thoại cá nhân ở bất kỳ màn hình hay API response nào.
- **SEC-3.4 [P0] API chỉ trả đúng trường cần thiết** cho từng vai trò và từng màn hình (chống Excessive Data Exposure): response cho điều dưỡng không kèm thông tin thanh toán chi tiết của bệnh nhân; response danh sách không kèm nội dung lâm sàng.
- **SEC-3.5 [P0] Log không chứa dữ liệu nhạy cảm:** cấm ghi vào log nội dung triệu chứng/báo cáo, OTP, token, mật khẩu, dữ liệu thẻ. Log chỉ ghi mã định danh và mã sự kiện (nguyên tắc đã áp dụng trong quy trình khôi phục tài khoản: ghi mã yếu tố đã khớp, không ghi giá trị).
- **SEC-3.6 [P0] Consent là điều kiện xử lý:** dữ liệu chỉ được xử lý trong phạm vi consent đang hiệu lực; rút consent (UC106) phải chặn các xử lý phụ thuộc ngay và lan được tới các bản sao (cache, export, báo cáo).
- **SEC-3.7 [P1] Thời hạn lưu trữ và xóa:** mỗi loại dữ liệu có thời hạn lưu theo Q-14; hết hạn thì xóa hoặc ẩn danh hóa; backup cũng nằm trong chính sách xóa (xóa lan tới backup theo chu kỳ đã cam kết).
- **SEC-3.8 [P1] Hồ sơ tuân thủ Nghị định 13/2023:** lập hồ sơ đánh giá tác động xử lý dữ liệu cá nhân (DPIA) cho hệ thống, hồ sơ chuyển dữ liệu (nếu có nhà cung cấp con ở nước ngoài — email, cổng thanh toán, lưu trữ), và quy trình thông báo sự cố rò rỉ dữ liệu trong 72 giờ tới cơ quan có thẩm quyền theo quy định.
- **SEC-3.9 [P1] Export/in ấn là hành động nhạy cảm:** xuất danh sách bệnh nhân, tải báo cáo hàng loạt phải có quyền riêng, ghi log, và file xuất có thời hạn truy cập ngắn (link ký, hết hạn), không gửi file đính kèm qua email thường.

## Nhóm 4 — An toàn API & xử lý đầu vào

- **SEC-4.1 [P0] Validate mọi đầu vào ở backend** theo whitelist (kiểu, độ dài, khoảng giá trị, định dạng); từ chối dữ liệu thừa — đặc biệt cấm gán hàng loạt (mass assignment): client không được tự gửi lên các trường như `status`, `hospital_id`, `role`, giá, trạng thái thanh toán.
- **SEC-4.2 [P0] Chống injection:** toàn bộ truy vấn DB dùng tham số hóa (parameterized query/ORM đúng cách); cấm nối chuỗi SQL; validate và encode đầu ra theo ngữ cảnh để chống XSS (kể cả nội dung do người dùng nhập hiển thị ở app khác — ví dụ ghi chú triệu chứng hiển thị trên app điều dưỡng và web quản trị).
- **SEC-4.3 [P0] CSRF:** mọi API thay đổi trạng thái qua cookie phải có token CSRF hoặc dựa trên `SameSite` + kiểm tra `Origin`; API dùng Bearer token thì khóa chặt CORS (SEC-8.3).
- **SEC-4.4 [P0] Rate-limit theo endpoint và theo hành vi:** giới hạn riêng cho đăng nhập, OTP, đặt lịch, bấm SOS, tìm kiếm; chống enumeration (đoán email có tồn tại, đoán mã đơn) bằng thông điệp lỗi thống nhất và giới hạn tốc độ.
- **SEC-4.5 [P0] Giới hạn kích thước và thời gian:** payload tối đa, timeout request, phân trang bắt buộc cho mọi API danh sách; chống tấn công từ chối dịch vụ ở tầng ứng dụng (query đắt, export lớn phải chạy nền và có hạn mức).
- **SEC-4.6 [P1] Phiên bản API và hợp đồng rõ ràng:** API có versioning; endpoint cũ bị gỡ theo lộ trình công bố; schema (OpenAPI) là nguồn sự thật để sinh kiểm tra validate tự động.
- **SEC-4.7 [P1] Chống lạm dụng logic nghiệp vụ (business-logic abuse):** các giới hạn nghiệp vụ (một đơn một ca đang chạy, một điều dưỡng không trùng ca, cửa sổ hủy/hoàn) phải được thực thi bằng ràng buộc dữ liệu phía server — không dựa vào việc client "không hiển thị nút".

## Nhóm 5 — Thanh toán, tiền cọc & webhook cổng thanh toán

- **SEC-5.1 [P0] Nền tảng không chạm dữ liệu thẻ:** thanh toán qua trang/sdk của cổng; hệ thống chỉ lưu mã giao dịch, số tiền, trạng thái và 4 số cuối (nếu cổng trả về). Không log, không lưu, không truyền qua hệ thống bất kỳ phần nào khác của số thẻ.
- **SEC-5.2 [P0] Số tiền luôn tính lại ở backend:** số cọc (30%, tối thiểu 50.000đ) và số còn phải trả được backend tính từ giá cấu hình của bệnh viện và các dòng đã xác nhận; mọi số tiền client gửi lên chỉ để đối chiếu, lệch là từ chối.
- **SEC-5.3 [P0] Webhook phải xác thực chữ ký và chống phát lại:** chỉ nhận thông báo kết quả thanh toán qua webhook có chữ ký của cổng (hoặc kênh xác thực tương đương), kiểm tra chữ ký trước mọi xử lý, chống replay bằng mã giao dịch + mốc thời gian; endpoint webhook không chấp nhận dữ liệu từ nguồn không xác thực.
- **SEC-5.4 [P0] Idempotency cho mọi thao tác tiền:** mỗi giao dịch cọc/hoàn có khóa idempotency; webhook đến hai lần, người dùng bấm hai lần, mạng retry — đều cho đúng một kết quả tài chính. Hoàn tiền (UC90) thực hiện một lần duy nhất cho một quyết định hoàn.
- **SEC-5.5 [P0] Tiền là sổ cái chỉ-ghi-thêm (append-only ledger):** không sửa/xóa bản ghi tài chính; sai sót xử lý bằng bút toán điều chỉnh kèm lý do, quy tắc áp dụng và người quyết (nhật ký quyết định tài chính). Mọi thay đổi số dư/khoản phải trả đều truy về được một sự kiện.
- **SEC-5.6 [P0] Phân tách nhiệm vụ tài chính:** người lập lệnh hoàn ≠ người duyệt lệnh hoàn ở các ngưỡng đã định; quyết định leo thang F1b của Platform Admin ghi căn cứ đầy đủ (liên kết US-HP-28/US-HP-34).
- **SEC-5.7 [P1] Đối soát tự động với cổng:** lịch đối soát định kỳ giữa sổ cái nội bộ và sao kê cổng (luồng 11); lệch đối soát sinh cảnh báo và đóng băng khoản lệch cho tới khi có quyết định ghi vết.

## Nhóm 6 — Toàn vẹn nghiệp vụ nhạy cảm thời gian (race condition & lạm dụng luồng)

- **SEC-6.1 [P0] Mọi "cửa sổ thời gian" của baseline là bất biến phía server:** cửa sổ cọc 15 phút, vòng ghép mới 15 phút (Q-45), "Chờ thanh toán" 24h, leo thang SOS 5 phút, tự mở khóa bom ca 24h — đều tính bằng thời gian server, thực thi bằng job/hàng đợi có khóa, không tính ở client.
- **SEC-6.2 [P0] Thao tác tranh chấp tài nguyên phải nguyên tử:** ghép một điều dưỡng cho một ca, nhận ca, check-in (UC40), bấm SOS, xác nhận dòng phát sinh — dùng khóa lạc quan/bi quan hoặc ràng buộc duy nhất ở DB để hai request đồng thời không tạo hai kết quả (hai điều dưỡng cùng nhận một ca, hai lần hoàn cho một đơn, hai lần hủy do cập nhật cấp cứu ở 07A).
- **SEC-6.3 [P0] Máy trạng thái thực thi ở backend:** chuyển trạng thái đơn/ca/thanh toán chỉ theo bảng chuyển trạng thái hợp lệ; request nhảy trạng thái (ví dụ gọi thẳng "hoàn tất" khi chưa có báo cáo chăm sóc BR-22) bị từ chối và ghi log.
- **SEC-6.4 [P1] Chống spam SOS và thông báo:** SOS giả lặp lại có cơ chế ghi nhận và xử lý phía bệnh viện nhưng **không bao giờ chặn khả năng phát SOS** của bệnh nhân trong ca thật; rate-limit chỉ áp ở lớp thông báo phụ, không ở việc ghi nhận sự cố.
- **SEC-6.5 [P1] Việc nền (job) cũng là bề mặt tấn công:** job hết hạn cọc, job leo thang, job đối soát phải idempotent, có khóa chống chạy trùng, và thất bại của job sinh cảnh báo vận hành — một job chết lặng lẽ có thể thành lỗ hổng tiền hoặc an toàn (SOS không leo thang).

## Nhóm 7 — Tải lên, biểu mẫu lâm sàng & nội dung người dùng

- **SEC-7.1 [P0] File tải lên (chứng từ lệnh hoàn, tài liệu đính kèm) qua cửa kiểm soát:** giới hạn loại file theo whitelist, giới hạn dung lượng, quét mã độc, lưu ngoài thư mục web và đổi tên ngẫu nhiên, tải xuống qua endpoint kiểm tra quyền — không bao giờ qua URL công khai đoán được.
- **SEC-7.2 [P0] Nội dung biểu mẫu lâm sàng là dữ liệu có cấu trúc, không phải HTML tự do:** biểu mẫu theo phiên bản (Q-49) validate theo schema của phiên bản đó; cấm nhúng script/markup vào trường văn bản tự do; hiển thị lại phải encode chống stored-XSS cho mọi app đọc (điều dưỡng, quản trị, bệnh nhân).
- **SEC-7.3 [P1] Ảnh chụp trong ca (nếu có)** phải tách metadata vị trí (EXIF GPS) trước khi lưu/chia sẻ, trừ khi vị trí là một phần bắt buộc của chứng cứ ca và được quy định rõ.

## Nhóm 8 — Hạ tầng, trình duyệt & triển khai

- **SEC-8.1 [P0] HTTPS toàn hệ thống + bộ header bảo mật:** HSTS, `Content-Security-Policy` (chặt, không `unsafe-inline` bừa bãi), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, chống clickjacking (`frame-ancestors`); tắt các header lộ phiên bản công nghệ.
- **SEC-8.2 [P0] Bí mật (secret) quản lý tập trung:** khóa API cổng thanh toán, khóa ký token, thông tin DB nằm trong kho bí mật/miến môi trường của hạ tầng — không nằm trong code, không trong git, không trong file cấu hình gửi kèm; có quy trình xoay khóa (rotation) và thu hồi khẩn cấp.
- **SEC-8.3 [P0] CORS khóa theo danh sách domain chính thức** của từng app (bệnh nhân, nhân sự, quản trị, portal SaaS); cấm `Access-Control-Allow-Origin: *` cho mọi API có xác thực.
- **SEC-8.4 [P0] Tách môi trường tuyệt đối:** dữ liệu thật (đặc biệt dữ liệu sức khỏe) không bao giờ xuống môi trường dev/test; môi trường test dùng dữ liệu giả; khóa và cổng thanh toán sandbox tách khỏi production.
- **SEC-8.5 [P0] Vá và quản lý thư viện:** quy trình theo dõi lỗ hổng thư viện/framework (quét dependency tự động trong CI), thời hạn vá theo mức độ nghiêm trọng; cấm triển khai bản có lỗ hổng critical đã biết.
- **SEC-8.6 [P1] WAF + chống bot ở biên** cho các endpoint công khai (đăng ký, đăng nhập, đặt lịch); WAF là lớp phụ trợ, không thay thế kiểm tra ở ứng dụng.
- **SEC-8.7 [P0] Sao lưu mã hóa, kiểm thử khôi phục:** backup DB và file chứng từ được mã hóa, tách quyền truy cập khỏi hệ thống chính; định kỳ diễn tập khôi phục — backup chưa từng khôi phục thử coi như không có backup.
- **SEC-8.8 [P1] Tài khoản hạ tầng/DB theo least privilege:** ứng dụng chạy bằng tài khoản DB chỉ có quyền trên schema của nó, không quyền quản trị server; truy cập production của con người qua tài khoản cá nhân + 2FA + ghi log phiên.

## Nhóm 9 — Ghi log, giám sát & ứng phó sự cố

- **SEC-9.1 [P0] Audit log append-only cho mọi hành động nhạy cảm:** đăng nhập/2FA, cấp-thu hồi quyền, xem dữ liệu lâm sàng, thao tác tiền, đổi cấu hình bệnh viện, hành động của Platform Admin trên tenant. Log bất biến (không sửa/xóa bởi cả quản trị hệ thống thường), đồng bộ thời gian chuẩn.
- **SEC-9.2 [P0] Cảnh báo tự động cho các mẫu tấn công:** nhiều lần đăng nhập/OTP thất bại, quét ID đối tượng (nhiều 403 liên tiếp), truy cập chéo tenant bị chặn, xuất dữ liệu lớn, thay đổi cấu hình thanh toán, job an toàn (SOS) thất bại.
- **SEC-9.3 [P1] Quy trình ứng phó sự cố có trước khi cần:** đầu mối chịu trách nhiệm, thang phân loại mức độ, kịch bản khóa tài khoản hàng loạt/buộc đặt lại mật khẩu, mẫu thông báo cho bệnh viện và người dùng, và nghĩa vụ thông báo cơ quan quản lý trong 72 giờ khi rò rỉ dữ liệu cá nhân theo Nghị định 13/2023.
- **SEC-9.4 [P1] Log tập trung và giữ đủ lâu** theo chính sách lưu trữ (Q-14), tách khỏi hệ thống chính để sự cố ở ứng dụng không xóa được dấu vết.

## Nhóm 10 — Quy trình phát triển & kiểm thử bảo mật

- **SEC-10.1 [P0] Security review là cổng merge:** mọi PR chạm vào xác thực, phân quyền, tiền, dữ liệu lâm sàng phải có người thứ hai review với checklist bảo mật (kiểm tra quyền ở đâu? validate đầu vào? có log chưa? có test âm không?).
- **SEC-10.2 [P0] Bộ test bảo mật tự động trong CI:** test IDOR hoán đổi ID/tenant (SEC-2.3), test nhảy trạng thái (SEC-6.3), test idempotency tiền (SEC-5.4), quét bí mật trong code (secret scanning) và quét dependency (SEC-8.5). Test đỏ = không merge.
- **SEC-10.3 [P1] Kiểm thử xâm nhập (penetration test) độc lập trước go-live** và sau mỗi thay đổi lớn về xác thực/thanh toán; phạm vi tối thiểu: OWASP Top 10 + API Top 10 + kịch bản chéo tenant + kịch bản lạm dụng luồng tiền.
- **SEC-10.4 [P1] Threat modeling cho tính năng mới:** mỗi epic mới (ví dụ UC135 đặt hộ qua tổng đài nếu được giữ lại) phải có một buổi phân tích mối đe dọa ngắn trước khi code — riêng UC135 phải trả lời: ai có thể mạo danh bệnh nhân qua kênh đặt hộ, và consent qua email người đại diện bị lạm dụng thế nào.
- **SEC-10.5 [P2] Chương trình tiếp nhận báo lỗi bảo mật:** đầu mối security@ công khai, cam kết thời gian phản hồi, và quy tắc xử lý có trách nhiệm với người báo.

---

## Ánh xạ nhanh: các quy tắc "không được phép sai" của riêng hệ thống này

| # | Bất biến bảo mật | Quy tắc gốc |
|---|---|---|
| 1 | Kiểm tra quyền 4 lớp ở backend cho mọi request | SEC-2.1 (BR-09) |
| 2 | Không bao giờ truy cập được dữ liệu bệnh viện khác | SEC-2.2, SEC-2.3 |
| 3 | Ba loại mã (OTP tài khoản / mã check-in UC40 / token consent) không thay thế nhau | SEC-1.6 |
| 4 | Số tiền luôn do backend tính; webhook không chữ ký = không xử lý | SEC-5.2, SEC-5.3 |
| 5 | Mọi thao tác tiền idempotent và ghi sổ cái append-only | SEC-5.4, SEC-5.5 |
| 6 | SOS luôn ghi nhận được; job leo thang chết phải có cảnh báo | SEC-6.4, SEC-6.5 |
| 7 | Log không chứa dữ liệu sức khỏe, OTP, token | SEC-3.5 |
| 8 | Dữ liệu thật không xuống môi trường test | SEC-8.4 |

*Ghi chú: bộ quy tắc này là tài liệu yêu cầu — nó quy định "phải đạt điều gì", không chốt công nghệ cụ thể (hãng WAF, thư viện, nhà cung cấp quét) vì stack của dự án chưa chốt. Khi có thay đổi baseline (ví dụ UC135 được giữ trong pilot), các quy tắc liên quan phải được rà lại theo SEC-10.4.*
