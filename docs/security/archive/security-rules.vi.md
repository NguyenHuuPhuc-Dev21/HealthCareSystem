# Quy tắc An ninh & Bảo vệ Quyền riêng tư (Security & Privacy Rules)
## Nền tảng Thuê & Điều phối Điều dưỡng Theo Yêu cầu (HealthCareSystem On-Demand Nursing)

| Thuộc tính | Chi tiết Đặc tả |
|---|---|
| **Nguồn chuẩn đặc tả** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Cập nhật 28/10/2026)**, Mục 6 (NFR-SEC-01, NFR-PRIV) & Mục 9 (Tích hợp ngoài) |
| **Mô hình Kiến trúc** | Sàn giao dịch y tế & điều dưỡng theo yêu cầu (Marketplace). **Không có mô hình bệnh viện (No hospital tenants).** |
| **Căn cứ Pháp lý & Chuẩn An ninh** | • Luật Khám bệnh, chữa bệnh số 15/2023/QH15 & Nghị định 96/2023/NĐ-CP<br>• Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân (Dữ liệu sức khỏe là **dữ liệu nhạy cảm**)<br>• OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS |
| **Phân loại Mức ưu tiên** | **[P0]** Bắt buộc hoàn tất trước khi triển khai MVP Phase 1 · **[P1]** Bắt buộc trước Go-Live thương mại · **[P2]** Nâng cấp liên tục theo lộ trình. |

---

## 1. Tám Bất biến An ninh Không Thể Vi Phạm (The 8 Non-Negotiable Invariants)

Tám nguyên tắc an ninh này là luật kiến trúc tuyệt đối, không được phép phá vỡ trong bất kỳ tình huống vận hành hay bản vá nóng (hotfix) nào:

| # | Bất biến An ninh | Cơ chế Phòng vệ Bắt buộc | Căn cứ SRS v2.0 |
|---|---|---|---|
| **1** | **Phân quyền Phía Máy chủ Toàn diện** | Mọi API request đều phải kiểm tra ở Backend: `Vai trò (Role) × Phân công Ca (Assignment) × Trạng thái Ca (State) × Cửa sổ Thời gian (Time Window)`. Giao diện ẩn nút bấm tuyệt đối không phải ranh giới bảo mật. | NFR-SEC-01.2, SEC-02 |
| **2** | **Kiểm soát Giới hạn Chuyên môn & GPHN** | Dịch vụ xâm lấn (`is_invasive = true`) bị khóa cứng ở mức Database và API: Điều dưỡng Hạng 1 (`TIER_1_BASIC`) gọi API nhận việc sẽ nhận mã lỗi `HTTP 403 Forbidden`. Quét hạn GPHN tự động hạ xuống Hạng 1 khi hết hạn. | FR-AUTH-02, NFR-PRIV-04 |
| **3** | **Tự động Thu hồi Quyền Xem Hồ sơ Bệnh án** | Quyền xem thông tin bệnh án và ảnh y lệnh của điều dưỡng được phân công **tự động đóng lại chính xác sau 12 giờ kể từ thời điểm Check-out** (`checkout_time`) theo Nghị định 13/2023/NĐ-CP. | FR-PRIV-01, NFR-SEC-01.6 |
| **4** | **Lưu trữ Private & URL Ký trước 10 Phút** | Toàn bộ ảnh CCCD, GPHN, Y lệnh/Đơn thuốc và ảnh Selfie Check-in phải lưu trữ ở chế độ **Private** trên S3/MinIO. Truy cập qua **Presigned URL có hiệu lực tối đa 10 phút**. Cấm URL công khai vĩnh viễn. | NFR-SEC-01.1 |
| **5** | **Toàn vẹn Webhook Thanh toán Cryptographic** | Mọi callback từ cổng thanh toán đều phải băm kiểm tra **HMAC-SHA256** trên dữ liệu thô. Chống tấn công phát lại (Replay attack) qua ràng buộc `UNIQUE` `idempotency_key` trong `wallet_transactions`. | NFR-SEC-01.4, SRS §9 |
| **6** | **Xử lý Đồng thời & Chống Race Condition** | API nhận ca trực và toàn bộ API làm biến động số dư ví (quyết toán, nộp hoa hồng, trừ phạt, rút tiền) bắt buộc chạy trong ACID Transaction với khóa dòng (`SELECT ... FOR UPDATE`) hoặc Redis Distributed Lock. | NFR-SEC-01.2 |
| **7** | **Giao thức Chống Giả mạo Check-in** | Đọc cờ OS (`isFromMockProvider` / `isSimulatedBySoftware`) từ chối ngay lập tức khi phát hiện Fake GPS. Bán kính Haversine $\le 200m$. Chụp Live Camera trực tiếp (chặn thư viện ảnh) kèm watermark Server Timestamp & GPS. | FR-SHIFT-01, NFR-SEC-01.3 |
| **8** | **Bảo vệ Viễn thông & Che Giấu Số Điện thoại** | Số điện thoại thật của Bệnh nhân và Điều dưỡng được che giấu hoàn toàn (Masked Telecom). Quét regex nội dung tin nhắn in-app thời gian thực để chặn lộ số điện thoại hoặc mồi chài giao dịch ngoài sàn. | FR-CHAT-01, NFR-PRIV-03 |

---

## 2. Danh mục Chi tiết Quy tắc An ninh theo Từng Nhóm

### Nhóm 0 — Nguyên tắc Nền tảng (Foundational Principles)
- **SEC-0.1 [P0] Không tin phía Client (Zero Client Trust):** Mọi logic tính toán giá, trạng thái đơn và phân quyền bắt buộc thực thi ở Backend.
- **SEC-0.2 [P0] Quyền tối thiểu mặc định (Least Privilege):** Mỗi vai trò (`PATIENT`, `NURSE`, `ADMIN`, `GATEWAY`) chỉ được cấp đúng phạm vi cần thiết.
- **SEC-0.3 [P0] Mặc định từ chối (Deny by Default):** Mọi endpoint không có quy tắc cho phép tường minh đều mặc định trả về `403 Forbidden`.
- **SEC-0.4 [P0] Phòng thủ chiều sâu (Defense in Depth):** Kết hợp kiểm soát mạng (WAF/Rate limit), xác thực JWT, kiểm tra logic nghiệp vụ và ràng buộc cơ sở dữ liệu.
- **SEC-0.5 [P1] Khả năng truy vết (Auditability):** Toàn bộ thao tác nhạy cảm ghi nhật ký bất biến vào bảng `audit_logs`.

### Nhóm 1 — Xác thực & Quản lý Phiên (Authentication & Session Management)
- **SEC-1.1 [P0] Đăng nhập bằng Số điện thoại + OTP SMS:** OTP gồm 6 chữ số ngẫu nhiên an toàn, hiệu lực tối đa 5 phút, sử dụng 1 lần, khóa sau 5 lần nhập sai liên tiếp.
- **SEC-1.2 [P0] Chống Brute-force & Dò OTP:** Giới hạn tần suất gọi API (Rate limit) theo Số điện thoại và IP (tối đa 3 OTP trong 10 phút). Khóa tạm thời tăng dần khi sai nhiều lần.
- **SEC-1.3 [P0] Bắt buộc 2FA cho Quản trị viên (Admin 2FA):** Mọi tài khoản Admin bắt buộc xác thực 2 bước bằng TOTP App (Google Authenticator) hoặc Hardware Security Key.
- **SEC-1.4 [P0] Quản lý Phiên & Token JWT:** Token JWT được ký bằng khóa bí mật mạnh (RS256 hoặc HS256 với secret $\ge 256\text{-bit}$). Thời gian sống của Access Token tối đa 15 phút, Refresh Token thu hồi khi đăng xuất hoặc đổi mật khẩu.
- **SEC-1.5 [P0] Phân định rõ các loại mã xác thực:** Mã OTP tài khoản qua SMS $\ne$ Mã Webhook HMAC $\ne$ Dấu vết eKYC. Không dùng chung cơ chế.

### Nhóm 2 — Phân quyền & Kiểm soát Đối tượng (Authorization & Access Control)
- **SEC-2.1 [P0] Kiểm tra 4 yếu tố phía Backend:** Mọi request đọc/ghi hồ sơ bệnh nhân đều phải kiểm tra: (1) Vai trò tài khoản, (2) Sự phân công vào ca trực tương ứng, (3) Phiên đăng nhập hợp lệ, (4) Trạng thái ca trực (`CONFIRMED` hoặc `IN_PROGRESS`).
- **SEC-2.2 [P0] Chống IDOR/BOLA (Broken Object Level Authorization):** Mọi tham số ID (như `booking_id`, `patient_profile_id`, `shift_log_id`) phải được kiểm tra quyền sở hữu và phân công ca trước khi trả dữ liệu, ngăn chặn việc người dùng đổi ID để đọc trộm dữ liệu người khác.
- **SEC-2.3 [P0] Thu hồi Quyền Xem Hồ sơ Sau 12 Giờ:** Đúng 12 giờ sau khi ca trực chuyển sang `COMPLETED`, API tự động chặn quyền truy cập của điều dưỡng vào hồ sơ bệnh nhân (`403 Forbidden`).
- **SEC-2.4 [P0] Admin Không Mặc Định Xem Chi Tiết Lâm Sàng:** Quản trị viên vận hành chỉ xem dữ liệu vận hành; chỉ Admin chuyên môn y tế được phân công xử lý khiếu nại mới được xem bệnh án và mọi lần xem đều phải ghi vết vào `audit_logs`.

### Nhóm 3 — Bảo vệ Quyền riêng tư & Tuân thủ Nghị định 13/2023/NĐ-CP
- **SEC-3.1 [P0] Dữ liệu Sức khỏe là Dữ liệu Cá nhân Nhạy cảm:** Áp dụng cấp độ bảo vệ cao nhất cho triệu chứng bệnh, chỉ số sinh tồn, ảnh đơn thuốc và ghi chú lâm sàng.
- **SEC-3.2 [P0] Mã hóa Toàn diện:** Mã hóa đường truyền bằng TLS 1.3 (bắt buộc HTTPS, HSTS với max-age 31536000). Mã hóa dữ liệu tĩnh (Encryption at Rest) trên ổ đĩa CSDL và kho lưu trữ S3/MinIO bằng AES-256.
- **SEC-3.3 [P0] Che số Điện thoại (Telecom Masking):** Ẩn hoàn toàn số điện thoại thật của bệnh nhân và điều dưỡng trên mọi giao diện và API response; đàm thoại thực hiện qua VoIP nội bộ hoặc đầu số ảo.
- **SEC-3.4 [P0] Log Không Chứa Thông tin Nhạy cảm:** Cấm tuyệt đối ghi mật khẩu, mã OTP, số CCCD đầy đủ, hay dữ liệu bệnh án chi tiết vào application logs.
- **SEC-3.5 [P1] Thời hạn Lưu trữ & Xóa Dữ liệu:** Lưu trữ hồ sơ y tế tối đa 24 tháng. Hỗ trợ quy trình tiếp nhận và thực hiện "Yêu cầu xóa / ẩn danh hóa dữ liệu" theo quy định của Nghị định 13/2023/NĐ-CP.
- **SEC-3.6 [P1] Quy trình Thông báo Sự cố 72 Giờ:** Quy trình ứng cứu sự cố bảo đảm báo cáo sự cố lộ lọt dữ liệu cho cơ quan chức năng trong vòng 72 giờ theo luật định.

### Nhóm 4 — An ninh API & Kiểm soát Đầu vào (API Security & Input Validation)
- **SEC-4.1 [P0] Kiểm tra Danh sách Cho phép (Whitelist Validation):** Toàn bộ dữ liệu gửi lên API (Body, Query, Params) được thẩm định qua schema chặt chẽ (Zod / Joi). Loại bỏ hoàn toàn các trường thừa (chống Mass Assignment).
- **SEC-4.2 [P0] Ngăn ngừa SQL Injection 100%:** Sử dụng câu truy vấn tham số hóa (Parameterized Queries) tuyệt đối. Cấm nối chuỗi câu lệnh SQL thô.
- **SEC-4.3 [P0] Giới hạn Tần suất (Rate Limiting):** Cấu hình rate limit ở tầng API Gateway (Nginx / Express Rate Limit): tối đa 100 requests/phút đối với người dùng thông thường; 5 requests/phút đối với API nhạy cảm như yêu cầu OTP hoặc rút tiền.
- **SEC-4.4 [P0] Chống Trùng lặp Giao dịch (Idempotency):** Áp dụng header `Idempotency-Key` với chỉ mục `UNIQUE` trong CSDL cho các thao tác thanh toán, nhận ca và rút tiền.

### Nhóm 5 — An toàn Tài chính & Ký quỹ Mô phỏng (Financial Security & Escrow)
- **SEC-5.1 [P0] Nền tảng Không Lưu trữ Thẻ Ngân hàng (PCI-DSS):** Nền tảng không xử lý và không lưu trữ số thẻ tín dụng/CVV; thanh toán ủy thác 100% qua cổng thanh toán được cấp phép (PayOS / VNPay).
- **SEC-5.2 [P0] Tính toán Giá Phía Máy chủ (Server-Authoritative Pricing):** Giá dịch vụ và phụ phí được tính hoàn toàn ở Backend dựa trên `system_configs`. Không tin giá do client gửi lên.
- **SEC-5.3 [P0] Xác thực Chữ ký Webhook HMAC-SHA256:** Mọi webhook báo trạng thái thanh toán bắt buộc phải đối chiếu chữ ký số HMAC-SHA256 với Secret Key. Sai chữ ký trả về `HTTP 401 Unauthorized` ngay lập tức.
- **SEC-5.4 [P0] Sổ cái Tài chính Bất biến:** Mọi giao dịch thay đổi số dư phải ghi nối tiếp vào `wallet_transactions` kèm `balance_before` và `balance_after`. Cấm lệnh SQL `UPDATE` số dư trực tiếp.
- **SEC-5.5 [P0] Cách ly Ví Cọc Tiền phạt:** Khóa logic ở cấp Backend: không bao giờ trừ phí hoa hồng 15% vào ngăn tiền cọc `deposit_balance`.

### Nhóm 6 — Xử lý Đồng thời & Tính Toàn vẹn Logic Nghiệp vụ (Concurrency)
- **SEC-6.1 [P0] Khóa Phân tán Nhận Ca:** Tránh 2 điều dưỡng cùng nhận 1 ca khi bắn Radar: Sử dụng Redis Lock kèm TTL xác định kết hợp `SELECT ... FOR UPDATE` trong PostgreSQL để gán ca nguyên tử (Atomic).
- **SEC-6.2 [P0] Toàn vẹn Máy Trạng thái 3 Trục:** Kiểm tra ràng buộc hợp lệ khi chuyển trạng thái: `execution_status`, `payment_status` và `dispute_status`. Từ chối mọi chuyển trạng thái bất hợp pháp (như chuyển thẳng từ `DRAFT` sang `COMPLETED`).
- **SEC-6.3 [P0] Không Chặn Quy trình Cấp cứu SOS:** Quy trình kích hoạt cuộc gọi khẩn cấp 115 trên máy chạy độc lập ở luồng cục bộ, không bị phong tỏa hay chờ đợi phản hồi mạng từ server.

### Nhóm 7 — Kiểm soát Tệp tin & Tải lên Đa phương tiện (File Uploads)
- **SEC-7.1 [P0] Kiểm tra MIME Type Thực tế (Magic Bytes):** Không chỉ tin phần mở rộng tệp (.png, .jpg), hệ thống đọc các byte đầu tiên của file để xác định loại tệp hợp lệ. Chỉ chấp nhận `image/jpeg`, `image/png`, `application/pdf`.
- **SEC-7.2 [P0] Giới hạn Dung lượng & Quét Mã độc:** Dung lượng tệp tối đa 10 MB. Tệp tải lên chạy qua đường ống quét mã độc trước khi lưu vào kho lưu trữ chính.
- **SEC-7.3 [P0] Xóa Siêu dữ liệu Nhạy cảm (EXIF Stripping):** Loại bỏ thông tin vị trí GPS gốc và thông tin thiết bị trong thẻ EXIF của ảnh đơn thuốc/CCCD trước khi lưu trữ để bảo vệ bí mật đời tư.
- **SEC-7.4 [P0] Phân phối qua Presigned URL:** File được lưu trong Private Bucket, cấp quyền xem qua URL ký trước có thời hạn $\le$ 10 phút.

### Nhóm 8 — Hạ tầng, Mạng & Triển khai Đám mây (Infrastructure Hardening)
- **SEC-8.1 [P0] Bảo vệ Header HTTP:** Cấu hình Helmet để bật HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Content-Security-Policy (CSP) chặt chẽ.
- **SEC-8.2 [P0] Quản lý Bí mật Tập trung:** Tuyệt đối không commit tệp `.env`, khóa API, mật khẩu database lên kho Git. Quản lý bí mật qua biến môi trường hoặc Vault / AWS Secrets Manager.
- **SEC-8.3 [P0] Chính sách CORS Nghiêm ngặt:** Chỉ cho phép domain chính thức của Patient Web, Nurse Web và Admin Portal gọi API. Cấm dùng `Access-Control-Allow-Origin: *` trên các route có xác thực.
- **SEC-8.4 [P1] Tách biệt Môi trường:** Tách biệt hoàn toàn cơ sở dữ liệu, kho lưu trữ và khóa API giữa môi trường Development, Staging và Production.

### Nhóm 9 — Nhật ký Kiểm toán & Ứng phó Sự cố (Audit Logging & Incident Response)
- **SEC-9.1 [P0] Bảng Nhật ký Bất biến `audit_logs`:** Ghi nhận toàn bộ thao tác duyệt hồ sơ GPHN, phân xử khiếu nại, xem bệnh án, thay đổi cấu hình `system_configs`, và yêu cầu xóa dữ liệu (Actor ID, Hành động, Bảng mục tiêu, Bản ghi, Giá trị cũ, Giá trị mới, Địa chỉ IP, Thời gian UTC).
- **SEC-9.2 [P0] Cảnh báo An ninh Thời gian thực:** Thiết lập cảnh báo lập tức đến đội ngũ kỹ thuật khi phát hiện các dấu hiệu bất thường: tấn công Fake GPS hàng loạt, sai chữ ký webhook thanh toán, hoặc cố gắng nhận ca xâm lấn khi chưa có GPHN.

### Nhóm 10 — Vòng đời Phát triển An toàn & Kiểm thử (DevSecOps)
- **SEC-10.1 [P0] Cổng Duyệt PR An ninh (PR Gates):** Mọi thay đổi liên quan đến phân quyền, thanh toán, máy trạng thái ca trực bắt buộc có kiểm thử phủ định (Negative Test Cases) đi kèm.
- **SEC-10.2 [P1] Rà soát Lỗ hổng Phụ thuộc Tự động:** Tích hợp `npm audit` / Snyk / Dependabot trong pipeline CI để phát hiện và ngăn chặn các thư viện có lỗ hổng CVE đã công bố.
- **SEC-10.3 [P1] Kiểm thử Thâm nhập (Penetration Testing):** Thực hiện kiểm thử thâm nhập độc lập đối với các bề mặt API, Web và Mobile trước khi nghiệm thu thương mại.

---

*Lưu ý: Mọi quy tắc an ninh trên tuân thủ tuyệt đối **SRS Version 2.0 (Cập nhật 28/10/2026)**. Khi có mâu thuẫn giữa tài liệu này và SRS v2.0, **SRS v2.0 là nguồn chân lý cao nhất**.*
