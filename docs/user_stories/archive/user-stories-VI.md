# Đặc tả User Stories Toàn diện (User Stories Specification)
## Nền tảng Thuê & Điều phối Điều dưỡng Theo Yêu cầu (HealthCareSystem On-Demand Nursing)

| Thuộc tính | Chi tiết Đặc tả |
|---|---|
| **Nguồn chuẩn đặc tả** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Cập nhật 28/10/2026)** |
| **Mô hình Kiến trúc** | Sàn giao dịch dịch vụ điều dưỡng kết nối Bệnh nhân/Gia đình với Bác sĩ/Điều dưỡng nghỉ hưu và Sinh viên y điều dưỡng mới tốt nghiệp. **Không có mô hình bệnh viện (No hospital tenants).** |
| **Phân kỳ Sản phẩm** | Nhóm User Stories MVP (Giai đoạn 1) và Nhóm Mở rộng (Giai đoạn 2) |
| **Trạng thái tài liệu** | **Chính thức — Thay thế toàn diện phiên bản cơ sở bệnh viện cũ.** |

---

## Mục lục theo 8 Epic Chiến lược
1. [Epic 1: Định danh, Xác thực & Hồ sơ eKYC Chuyên môn](#epic-1-định-danh-xác-thực--hồ-sơ-ekyc-chuyên-môn)
2. [Epic 2: Danh mục Dịch vụ, Lịch rảnh & Tìm kiếm Điều dưỡng](#epic-2-danh-mục-dịch-vụ-lịch-rảnh--tìm-kiếm-điều-dưỡng)
3. [Epic 3: Đặt lịch, Kiểm soát Y lệnh & Điều phối Ca trực](#epic-3-đặt-lịch-kiểm-soát-y-lệnh--điều-phối-ca-trực)
4. [Epic 4: Thực thi Ca trực, Chống Gian lận & Cấp cứu SOS](#epic-4-thực-thi-ca-trực-chống-gian-lận--cấp-cứu-sos)
5. [Epic 5: Thanh toán, Ví Ký quỹ Mô phỏng, Tiền cọc & Rút tiền](#epic-5-thanh-toán-ví-ký-quỹ-mô-phỏng-tiền-cọc--rút-tiền)
6. [Epic 6: Khiếu nại, Đánh giá Ẩn, TrustScore & Giao tiếp Nội bộ](#epic-6-khiếu-nại-đánh-giá-ẩn-trustscore--giao-tiếp-nội-bộ)
7. [Epic 7: Quản trị Nền tảng, Cấu hình Tham số & Ma trận SLA](#epic-7-quản-trị-nền-tảng-cấu-hình-tham-số--ma-trận-sla)
8. [Epic 8: Các Tính năng Mở rộng Giai đoạn 2 (Phase 2)](#epic-8-các-tính-năng-mở-rộng-giai-đoạn-2-phase-2)

---

# Epic 1: Định danh, Xác thực & Hồ sơ eKYC Chuyên môn

### US-AUTH-01: Đăng ký & Đăng nhập bằng Số điện thoại + OTP SMS
- **Metadata:** Mã: `US-AUTH-01` | Đối tượng: Bệnh nhân, Khách hàng, Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-AUTH-01, SRS §8.
- **Bối cảnh & Vấn đề:** Bệnh nhân và điều dưỡng lớn tuổi thường gặp khó khăn với mật khẩu phức tạp; xác thực bằng Số điện thoại + OTP SMS tối ưu hóa trải nghiệm đăng nhập nhanh chóng, tin cậy.
- **Tuyên ngôn Story:**
  > Là **người dùng (Bệnh nhân / Điều dưỡng)**,  
  > tôi muốn đăng ký và đăng nhập nhanh bằng Số điện thoại và mã OTP gửi qua tin nhắn SMS,  
  > để tôi có thể truy cập nền tảng một cách thuận tiện, an toàn mà không cần nhớ mật khẩu phức tạp.
- **Tiêu chí Chấp nhận (Acceptance Criteria):**
  - **Given** người dùng nhập số điện thoại hợp lệ tại Việt Nam,
  - **When** người dùng bấm "Gửi mã xác thực",
  - **Then** hệ thống tạo mã OTP 6 số ngẫu nhiên an toàn, gửi qua SMS trong $< 10\text{ giây}$, hiệu lực 5 phút; nhập đúng mã OTP sẽ cấp phiên làm việc JWT hợp lệ.
  - **Given** người dùng nhập sai mã OTP quá 5 lần liên tiếp,
  - **When** người dùng cố gắng thử lại lần thứ 6,
  - **Then** hệ thống khóa tạm thời yêu cầu gửi mã trong 15 phút để chống tấn công brute-force.

---

### US-AUTH-02: Nộp Hồ sơ eKYC CCCD & Văn bằng Chuyên môn Điều dưỡng
- **Metadata:** Mã: `US-AUTH-02` | Đối tượng: Điều dưỡng Hạng 1 & 2 | Giai đoạn: **MVP** | Truy vết: FR-AUTH-01, NFR-SEC-01.
- **Tuyên ngôn Story:**
  > Là **Bác sĩ / Điều dưỡng**,  
  > tôi muốn nộp hồ sơ eKYC CCCD, bằng cấp chuyên môn và Giấy phép hành nghề (GPHN) trực tiếp trên Nurse Web Portal hoặc Mobile App,  
  > để Ban Quản trị thẩm định năng lực và cấp quyền nhận ca làm việc trên nền tảng.
- **Tiêu chí Chấp nhận (Acceptance Criteria):**
  - **Given** điều dưỡng đang ở trạng thái tài khoản mới,
  - **When** điều dưỡng tải ảnh CCCD 2 mặt, ảnh chân dung selfie, Bằng tốt nghiệp Y/Điều dưỡng, và thông tin GPHN (số, ngày cấp, ngày hết hạn, nơi cấp, phạm vi hoạt động),
  - **Then** hệ thống lưu hồ sơ ở trạng thái `PENDING_VERIFICATION`, các tệp ảnh lưu ở chế độ Private trên S3/MinIO và tạo bản ghi chờ Admin thẩm định.

---

### US-AUTH-03: Thẩm định GPHN & Phân hạng Điều dưỡng
- **Metadata:** Mã: `US-AUTH-03` | Đối tượng: Quản trị viên Y tế (Admin) | Giai đoạn: **MVP** | Truy vết: FR-AUTH-02, CT-01.
- **Tuyên ngôn Story:**
  > Là **Quản trị viên Y tế (Admin)**,  
  > tôi muốn kiểm tra hồ sơ văn bằng và thẩm định tính hợp lệ của Giấy phép hành nghề (GPHN),  
  > để phân bổ chính xác Hạng chuyên môn (`TIER_1_BASIC` hoặc `TIER_2_SPECIALIST`), ngăn chặn hành nghề vượt quá giới hạn pháp lý.
- **Tiêu chí Chấp nhận (Acceptance Criteria):**
  - **Given** hồ sơ điều dưỡng có bằng tốt nghiệp chính quy nhưng không có GPHN (hoặc GPHN đã hết hạn),
  - **When** Admin bấm phê duyệt,
  - **Then** hệ thống gán nhãn `TIER_1_BASIC` (chỉ được nhận dịch vụ không xâm lấn).
  - **Given** hồ sơ có GPHN còn hiệu lực và đúng phạm vi chuyên môn điều dưỡng/khám chữa bệnh,
  - **When** Admin bấm phê duyệt,
  - **Then** hệ thống gán nhãn `TIER_2_SPECIALIST` (được nhận cả dịch vụ xâm lấn và không xâm lấn). Quyết định nghỉ hưu chỉ có giá trị cấp huy hiệu nhận diện, không thay thế được GPHN.

---

### US-AUTH-04: Tự động Giáng hạng & Thăng hạng theo Thời hạn GPHN
- **Metadata:** Mã: `US-AUTH-04` | Đối tượng: Hệ thống Backend, Điều dưỡng Hạng 2 | Giai đoạn: **MVP** | Truy vết: FR-AUTH-02, TC-AUTH-02.
- **Tuyên ngôn Story:**
  > Là **Hệ thống Quản lý Tuân thủ Y tế**,  
  > tôi muốn tự động quét ngày hết hạn GPHN hàng ngày để giáng hạng điều dưỡng hết hạn xuống Hạng 1 và tự động phục hồi Hạng 2 khi có GPHN mới được duyệt,  
  > nhằm loại bỏ triệt để rủi ro nhân sự thực hiện thủ thuật xâm lấn khi giấy phép đã hết hiệu lực.
- **Tiêu chí Chấp nhận (Acceptance Criteria):**
  - **Given** điều dưỡng đang ở hạng `TIER_2_SPECIALIST` có `gphn_expiry_date < CURRENT_DATE`,
  - **When** Cronjob kiểm tra hạn chạy lúc 00:00 hàng ngày,
  - **Then** hệ thống tự động giáng hạng xuống `TIER_1_BASIC`, trạng thái hồ sơ vẫn `ACTIVE` để nhận việc cơ bản; đồng thời tự động hủy không phạt các ca xâm lấn đã `CONFIRMED` có lịch diễn ra sau ngày hết hạn và đẩy vào điều phối lại.
  - **Given** điều dưỡng đã tải GPHN gia hạn mới lên Nurse Web/App và được Admin duyệt,
  - **When** Admin bấm xác nhận hợp lệ,
  - **Then** hệ thống tự động thăng hạng tài khoản trở lại `TIER_2_SPECIALIST`.

---

### US-AUTH-05: eKYC CCCD Bắt buộc đối với Khách hàng Đặt ca Tại Nhà
- **Metadata:** Mã: `US-AUTH-05` | Đối tượng: Khách hàng / Gia đình | Giai đoạn: **MVP** | Truy vết: FR-AUTH-03, CT-14.
- **Tiêu chí Chấp nhận:**
  - **Given** khách hàng đặt lịch với địa điểm là "Tại bệnh viện",
  - **When** khách hàng bấm tạo đơn,
  - **Then** hệ thống cho phép tạo đơn chỉ với tài khoản đã xác thực Số điện thoại + OTP SMS.
  - **Given** khách hàng đặt lịch với địa điểm là "Tại nhà riêng (Home-care)" nhưng tài khoản chưa hoàn tất eKYC CCCD,
  - **When** khách hàng bấm tạo đơn,
  - **Then** hệ thống chặn tạo đơn và yêu cầu hoàn tất tải ảnh CCCD 2 mặt + selfie để bảo đảm an toàn cho điều dưỡng trước khi đến nhà riêng.

---

### US-PRIV-01: Đồng thuận Dữ liệu Sức khỏe & Thu hồi Quyền Sau 12 Giờ (NĐ 13/2023)
- **Metadata:** Mã: `US-PRIV-01` | Đối tượng: Bệnh nhân, Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-PRIV-01, NFR-PRIV-01, NFR-SEC-01.6.
- **Tiêu chí Chấp nhận:**
  - **Given** khách hàng tạo hồ sơ người bệnh,
  - **When** lưu hồ sơ,
  - **Then** bắt buộc phải tích chọn cam kết đồng thuận cho phép xử lý dữ liệu y tế nhạy cảm (ghi vết timestamp, IP và device ID).
  - **Given** điều dưỡng đã hoàn tất ca trực và bấm check-out,
  - **When** thời gian trôi qua $> 12\text{ giờ}$ kể từ thời điểm `checkout_time`,
  - **Then** quyền truy cập xem hồ sơ người bệnh và ảnh y lệnh của điều dưỡng tự động bị khóa hoàn toàn (`HTTP 403 Forbidden`).

---

# Epic 2: Danh mục Dịch vụ, Lịch rảnh & Tìm kiếm Điều dưỡng

### US-SCHED-01: Khai báo Lịch rảnh Định kỳ & Ràng buộc Đệm Di chuyển 60 Phút
- **Metadata:** Mã: `US-SCHED-01` | Đối tượng: Điều dưỡng Hạng 1 & 2 | Giai đoạn: **MVP** | Truy vết: FR-SCHED-01, CT-10.
- **Tuyên ngôn Story:**
  > Là **Điều dưỡng**,  
  > tôi muốn khai báo các khung giờ rảnh cố định trong tuần và đăng ký các ngày nghỉ đột xuất,  
  > để hệ thống chỉ điều phối các ca trực phù hợp và bảo đảm thời gian di chuyển giữa các ca tối thiểu 60 phút.
- **Tiêu chí Chấp nhận:**
  - **Given** điều dưỡng cấu hình lịch rảnh trong `nurse_availabilities`,
  - **When** công cụ điều phối (Matching Engine) quét ứng viên cho một ca trực mới,
  - **Then** hệ thống chỉ chọn các điều dưỡng có lịch rảnh khớp và có khoảng cách thời gian giữa ca mới và ca liền kề $\ge 60\text{ phút}$ (đệm di chuyển bắt buộc).

---

### US-SEARCH-01: Tìm kiếm & Xem Hồ sơ Điều dưỡng Công khai
- **Metadata:** Mã: `US-SEARCH-01` | Đối tượng: Khách hàng / Gia đình | Giai đoạn: **MVP** | Truy vết: FR-SEARCH-01, CT-13.
- **Tiêu chí Chấp nhận:**
  - **Given** khách hàng tìm kiếm điều dưỡng theo bộ lọc (loại dịch vụ, khu vực địa lý, khung giờ, hạng chuyên môn, giới tính),
  - **When** hệ thống trả kết quả,
  - **Then** danh sách hiển thị các điều dưỡng đang `ACTIVE` với thẻ hồ sơ gồm: Họ tên, ảnh đại diện, hạng chuyên môn, thâm niên, huy hiệu bác sĩ/điều dưỡng nghỉ hưu, điểm đánh giá trung bình và nhận xét thực tế từ các ca trước.

---

# Epic 3: Đặt lịch, Kiểm soát Y lệnh & Điều phối Ca trực

### US-BOOK-01: Tính giá Tham số hóa Động từ Cấu hình Hệ thống
- **Metadata:** Mã: `US-BOOK-01` | Đối tượng: Khách hàng | Giai đoạn: **MVP** | Truy vết: FR-BOOK-01, CT-05, Annex A.
- **Tuyên ngôn Story:**
  > Là **Khách hàng**,  
  > tôi muốn biết trước giá tiền chính xác, minh bạch của ca chăm sóc dựa trên đơn giá và các phụ phí luật định,  
  > để tôi an tâm thanh toán mà không lo phát sinh phụ phí ẩn.
- **Tiêu chí Chấp nhận:**
  - **Given** đơn đặt lịch có thời gian làm việc rơi vào khung giờ đêm 22:00–06:00,
  - **When** hệ thống tính tổng tiền đơn,
  - **Then** hệ thống tự động cộng thêm phụ phí ca đêm 20% (`SURCHARGE_NIGHT_SHIFT`) tính chính xác trên số giờ đêm; cộng phụ phí Tết 300% (`SURCHARGE_HOLIDAY_MAJOR`) hoặc ngày Lễ 200% (`SURCHARGE_HOLIDAY_MINOR`) và 15% nếu người bệnh nặng $\ge 80\text{kg}$ hoặc liệt giường. Toàn bộ surcharges cộng dồn độc lập trên giá gốc.
  - Đơn tạo ra ở trạng thái `execution_status = DRAFT`, giữ chỗ trong 15 phút (`PAYMENT_TIMEOUT_MINUTES = 15`).

---

### US-BOOK-02: Quy trình Kiểm soát Y lệnh 3 Lớp & Quyền Từ chối An toàn
- **Metadata:** Mã: `US-BOOK-02` | Đối tượng: Khách hàng, Điều dưỡng Hạng 2 | Giai đoạn: **MVP** | Truy vết: FR-BOOK-02, CT-02, RISK-01.
- **Tiêu chí Chấp nhận:**
  - **Given** khách hàng chọn dịch vụ thủ thuật xâm lấn (`is_invasive = true`),
  - **When** bấm tạo đơn,
  - **Then** bắt buộc phải đính kèm ảnh chụp y lệnh/đơn thuốc bác sĩ còn hạn trong 7 ngày.
  - **Given** điều dưỡng Hạng 2 nhận ca đến điểm hẹn và đối chiếu phát hiện đơn thuốc bị sửa chữa, hết hạn hoặc thuốc không đúng y lệnh,
  - **When** điều dưỡng bấm "Từ chối ca do sai Y lệnh" kèm ảnh chụp bằng chứng,
  - **Then** ca trực lập tức bị hủy, điều dưỡng không bị trừ tiền cọc, không bị trừ TrustScore và được nhận 50.000 VNĐ hỗ trợ xăng xe (`ICU_TRAVEL_SUPPORT`).

---

### US-MATCH-01: Ghép cặp Bắn Radar Điều phối cho Ca Gấp ($\le$ 6 Giờ)
- **Metadata:** Mã: `US-MATCH-01` | Đối tượng: Điều dưỡng, Matching Engine | Giai đoạn: **MVP** | Truy vết: FR-BOOK-03, CT-22.
- **Tiêu chí Chấp nhận:**
  - **Given** đơn đặt lịch có thời gian bắt đầu trong vòng $\le 6\text{ giờ}$ đã thanh toán xong,
  - **When** hệ thống kích hoạt Radar Dispatch,
  - **Then** Vòng 1 (phút 0–5) bắn thông báo đẩy tới điều dưỡng phù hợp trong bán kính 5 km; Vòng 2 (phút 5–15) tự động mở rộng bán kính lên 10 km.
  - **Given** có nhiều điều dưỡng cùng nhận tín hiệu,
  - **When** người đầu tiên bấm nhận ca,
  - **Then** hệ thống dùng khóa nguyên tử Redis Lock gán ca thành công, chuyển đơn sang `CONFIRMED` và chặn không cho các điều dưỡng khác nhận trùng lặp.

---

# Epic 4: Thực thi Ca trực, Chống Gian lận & Cấp cứu SOS

### US-SHIFT-01: Check-in Xác thực Kép (Chống Fake GPS & Selfie Trực tiếp)
- **Metadata:** Mã: `US-SHIFT-01` | Đối tượng: Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-SHIFT-01, CT-21, NFR-SEC-01.3.
- **Tiêu chí Chấp nhận:**
  - **Given** điều dưỡng bật ứng dụng giả lập tọa độ (`isFromMockProvider = true`),
  - **When** bấm Check-in,
  - **Then** hệ thống từ chối ngay lập tức (`HTTP 400 Bad Request`) và ghi cảnh báo an ninh vào `shift_logs`.
  - **Given** điều dưỡng có mặt tại điểm hẹn trong bán kính $\le 200\text{m}$,
  - **When** chụp ảnh selfie trực tiếp qua camera ứng dụng (chặn chọn ảnh từ thư viện),
  - **Then** ảnh được đóng dấu watermark Server Timestamp & tọa độ GPS, chuyển đơn sang `IN_PROGRESS` và bắn thông báo ảnh đến app của khách hàng.

---

### US-SHIFT-02: Báo cáo Sai lệch Tình trạng & Ghi Nhật ký Sinh hiệu
- **Metadata:** Mã: `US-SHIFT-02` | Đối tượng: Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-SHIFT-02.
- **Tiêu chí Chấp nhận:**
  - **Given** trong 30 phút đầu sau check-in, điều dưỡng phát hiện khách hàng giấu bệnh truyền nhiễm hoặc liệt giường không khai báo,
  - **When** điều dưỡng bấm báo cáo sai lệch,
  - **Then** điều dưỡng có quyền yêu cầu cập nhật phụ phí hoặc từ chối thực hiện tiếp ca trực mà không bị xử phạt.
  - **Given** ca trực đang diễn ra bình thường,
  - **When** điều dưỡng ghi nhận chỉ số Mạch, Huyết áp, Nhiệt độ, SpO2,
  - **Then** dữ liệu được lưu vào `shift_logs` và đồng bộ thời gian thực qua WebSocket đến app của gia đình.

---

### US-SHIFT-03: Kích hoạt Giao thức Cấp cứu Y tế Khẩn cấp (SOS 115)
- **Metadata:** Mã: `US-SHIFT-03` | Đối tượng: Bệnh nhân, Điều dưỡng, Admin | Giai đoạn: **MVP** | Truy vết: FR-SHIFT-05, CT-04, NFR-PERF-02.
- **Tiêu chí Chấp nhận:**
  - **Given** người bệnh có dấu hiệu nguy kịch trong ca trực,
  - **When** điều dưỡng hoặc người nhà bấm nút SOS trên ứng dụng,
  - **Then** ứng dụng lập tức mở ngay trình quay số gọi Cấp cứu 115 trên điện thoại; đồng thời hệ thống gửi cảnh báo khẩn cấp (Push + SMS dự phòng sau 60s) kèm tọa độ GPS và dấu hiệu sinh tồn mới nhất tới Gia đình và Web Admin trong thời gian $< 2\text{ giây}$.

---

### US-SHIFT-04: Check-out, Nộp Báo cáo Tổng kết & Kích hoạt 2 Bộ đếm
- **Metadata:** Mã: `US-SHIFT-04` | Đối tượng: Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-SHIFT-04, FR-PRIV-01, FR-PAY-02.
- **Tiêu chí Chấp nhận:**
  - **Given** điều dưỡng hoàn thành ca trực, ghi nhận sinh hiệu cuối ca và ghi chú bàn giao,
  - **When** bấm nút Check-out,
  - **Then** hệ thống ghi `checkout_time`, chuyển `execution_status = COMPLETED`, kích hoạt bộ đếm đối soát 24 giờ và kích hoạt bộ đếm tự động khóa quyền xem hồ sơ bệnh án sau 12 giờ.

---

# Epic 5: Thanh toán, Ví Ký quỹ Mô phỏng, Tiền cọc & Rút tiền

### US-PAY-01: Lựa chọn Phương thức Thanh toán (Chuyển khoản vs Tiền mặt)
- **Metadata:** Mã: `US-PAY-01` | Đối tượng: Khách hàng | Giai đoạn: **MVP** | Truy vết: FR-PAY-01, CT-06.
- **Tiêu chí Chấp nhận:**
  - **Given** khách hàng chọn phương thức `BANK_TRANSFER`,
  - **When** thanh toán qua cổng sandbox,
  - **Then** Webhook xác thực chữ ký HMAC-SHA256 và khóa tiền vào Sổ cái Ký quỹ Mô phỏng (`ESCROW_HELD`).
  - **Given** khách hàng chọn phương thức `CASH`,
  - **When** tạo đơn,
  - **Then** khách không cần thanh toán trước; hệ thống ghi nhận giá ca trong ứng dụng, khách trả 100% tiền mặt cho điều dưỡng khi kết thúc ca.

---

### US-PAY-02: Quyết toán Tự động Sau 24h & Nộp Hoa hồng Tiền mặt 15%
- **Metadata:** Mã: `US-PAY-02` | Đối tượng: Điều dưỡng, Hệ thống | Giai đoạn: **MVP** | Truy vết: FR-PAY-02, CT-05, CT-17.
- **Tiêu chí Chấp nhận:**
  - **Given** đơn chuyển khoản hoàn thành và hết 24 giờ đối soát không có khiếu nại,
  - **When** worker chạy quyết toán,
  - **Then** hệ thống trích 15% hoa hồng nền tảng và giải ngân 85% thù lao vào `available_balance` của điều dưỡng (`payment_status = SETTLED`).
  - **Given** đơn tiền mặt hoàn thành check-out,
  - **When** hệ thống tính 15% hoa hồng trên giá gốc ứng dụng,
  - **Then** Nurse App hiển thị mã VietQR để điều dưỡng tự chuyển khoản nộp 15% hoa hồng trong vòng 24 giờ. Tuyệt đối không trừ vào ví cọc. Nếu quá 24 giờ chưa nộp, tài khoản tự động bị chuyển sang `SUSPENDED`.

---

### US-PAY-03: Ví Tiền cọc Điều dưỡng 300.000 VNĐ Cách ly cho Phạt SLA
- **Metadata:** Mã: `US-PAY-03` | Đối tượng: Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-PAY-03, CT-07.
- **Tiêu chí Chấp nhận:**
  - **Given** điều dưỡng chưa nạp đủ 300.000 VNĐ vào `deposit_balance`,
  - **When** bấm nhận ca trực,
  - **Then** hệ thống từ chối và yêu cầu nạp đủ cọc trước.
  - **Given** điều dưỡng vi phạm chính sách SLA (hủy ca muộn hoặc no-show),
  - **When** hệ thống xử phạt,
  - **Then** tiền phạt chỉ được trừ vào `deposit_balance` (`PENALTY_DEDUCT`), không bao giờ trừ hoa hồng vào ví này. Khi số dư cọc $< 300.000\text{ VNĐ}$, điều dưỡng bị tạm khóa nhận việc mới cho đến khi nạp bù.

---

### US-PAY-04: Rút tiền Thu nhập Khả dụng về Ngân hàng
- **Metadata:** Mã: `US-PAY-04` | Đối tượng: Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-PAY-04, CT-15.
- **Tiêu chí Chấp nhận:**
  - **Given** điều dưỡng có số dư `available_balance >= số tiền muốn rút`,
  - **When** tạo lệnh rút tiền,
  - **Then** hệ thống khóa dòng dữ liệu (`SELECT FOR UPDATE`), trừ số dư khả dụng, tạo bản ghi `WITHDRAW_REQUESTED` để Admin/cổng chi hộ phê duyệt chuyển khoản (`WITHDRAWN`).

---

# Epic 6: Khiếu nại, Đánh giá Ẩn, TrustScore & Giao tiếp Nội bộ

### US-DISP-01: Mở Khiếu nại trong 24 Giờ & Đóng băng Ký quỹ
- **Metadata:** Mã: `US-DISP-01` | Đối tượng: Khách hàng, Điều dưỡng, Admin | Giai đoạn: **MVP** | Truy vết: FR-DISP-01, CT-11.
- **Tiêu chí Chấp nhận:**
  - **Given** ca trực kết thúc chưa quá 24 giờ,
  - **When** một bên bấm mở khiếu nại (`dispute_status = OPEN`) kèm tối đa 5 ảnh/video bằng chứng,
  - **Then** hệ thống lập tức đóng băng số tiền đang tạm giữ trong Escrow, chặn lệnh tự động giải ngân của cronjob.
  - Khi Admin phân xử `RESOLVED_CUSTOMER`, khách được hoàn 100% tiền, điều dưỡng bị trừ 25 điểm TrustScore và bị phạt trừ tiền cọc.

---

### US-RATE-01: Đánh giá Ẩn Hai chiều & Điểm Tín nhiệm TrustScore
- **Metadata:** Mã: `US-RATE-01` | Đối tượng: Khách hàng, Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-RATE-01, CT-12.
- **Tiêu chí Chấp nhận:**
  - **Given** ca trực kết thúc,
  - **When** hai bên đánh giá chéo 1–5 sao và viết nhận xét,
  - **Then** nội dung đánh giá được giữ ẩn cho tới khi cả hai bên cùng hoàn thành hoặc sau 7 ngày để chống trả đũa.
  - Điểm TrustScore (0–100, khởi tạo 100): Trừ 5 điểm nếu hủy ca > 12h, trừ 20 điểm nếu hủy $\le 12h$, trừ 25 điểm nếu khiếu nại thua; cộng 2 điểm cho mỗi ca hoàn tất được đánh giá $\ge 4$ sao. TrustScore < 60 tự động bị tạm khóa (`SUSPENDED`).

---

### US-COMM-01: Nhắn tin & Gọi điện Nội bộ Ẩn số Viễn thông
- **Metadata:** Mã: `US-COMM-01` | Đối tượng: Khách hàng, Điều dưỡng | Giai đoạn: **MVP** | Truy vết: FR-CHAT-01, RISK-06.
- **Tiêu chí Chấp nhận:**
  - **Given** đơn đạt trạng thái `CONFIRMED`,
  - **When** hai bên liên lạc qua tính năng chat/gọi trong app,
  - **Then** số điện thoại thật của hai bên được che giấu hoàn toàn.
  - Nếu tin nhắn chứa số điện thoại hoặc link liên hệ ngoài sàn, hệ thống hiển thị cảnh báo vi phạm và lưu log cho Admin kiểm tra.

---

# Epic 7: Quản trị Nền tảng, Cấu hình Tham số & Ma trận SLA

### US-ADM-01: Quản trị Tham số Cấu hình Động (`system_configs`)
- **Metadata:** Mã: `US-ADM-01` | Đối tượng: Admin | Giai đoạn: **MVP** | Truy vết: FR-ADMIN-01, Annex A.
- **Tiêu chí Chấp nhận:**
  - **Given** Admin thay đổi tỷ lệ hoa hồng hoặc mức phụ phí trong bảng `system_configs`,
  - **When** lưu thay đổi,
  - **Then** các đơn đặt lịch tạo mới lập tức áp dụng tỷ lệ mới mà không cần biên dịch hay deploy lại mã nguồn.

---

### US-ADM-02: Thực thi Ma trận Chính sách SLA Hủy ca & Xử lý No-Show
- **Metadata:** Mã: `US-ADM-02` | Đối tượng: Hệ thống, Admin | Giai đoạn: **MVP** | Truy vết: Annex B SLA Matrix, CT-08.
- **Tiêu chí Chấp nhận:**
  - **Given** khách hủy đơn chuyển khoản trước ca 5 tiếng (khung 2–12h),
  - **Then** phạt 20%: Hoàn 80% cho khách, cộng 15% vào ví điều dưỡng, sàn thu 5%.
  - **Given** điều dưỡng không đến sau 30 phút giờ hẹn và điều phối ca khẩn cấp thất bại,
  - **Then** tài khoản điều dưỡng bị **khóa vĩnh viễn (`BANNED`) ngay lần đầu**, phạt 50.000 VNĐ từ ví cọc tạo voucher xin lỗi khách, và hoàn tiền 100% cho khách hàng.

---

# Epic 8: Các Tính năng Mở rộng Giai đoạn 2 (Phase 2)

### US-P2-01: Đấu thầu Hợp đồng Dài hạn & Ca làm Thử (FR-BOOK-04)
- **Tiêu chí:** Khách hàng đăng tin thuê theo tuần/tháng $\rightarrow$ nhiều điều dưỡng nộp báo giá $\rightarrow$ khách hàng chọn 1 điều dưỡng và bắt buộc đặt 1 ca làm thử (4h/8h) trước khi phê duyệt hợp đồng chính thức.

### US-P2-02: Quản lý Vòng đời Hợp đồng Dài hạn (FR-BOOK-05)
- **Tiêu chí:** Hỗ trợ tính năng tạm dừng hợp đồng khi bệnh nhân nhập viện cấp cứu; đổi điều dưỡng giữa kỳ (quyết toán cho người cũ và gán người mới); kết thúc hợp đồng sớm với chính sách hoàn tiền theo SLA.

### US-P2-03: Phân xử Quyết toán Một phần khi Khiếu nại (FR-DISP-02)
- **Tiêu chí:** Khi cả hai bên cùng có lỗi hoặc ca trực bị gián đoạn do sự cố khách quan, Admin nhập tỷ lệ phân chia (VD: hoàn 40% cho khách, giải ngân 60% cho điều dưỡng) $\rightarrow$ chuyển trạng thái đơn sang `PARTIALLY_SETTLED`.

### US-P2-04: Giao diện Thân thiện Người cao tuổi cho App Bệnh nhân (NFR-UI-01.3)
- **Tiêu chí:** Áp dụng chế độ chữ lớn (16–18pt), tương phản WCAG 2.1 AA, nút bấm $\ge 48\times 48\text{dp}$ cho App Bệnh nhân để người cao tuổi có thể tự đặt lịch độc lập.

---

*Lưu ý: Mọi User Story trên tuân thủ tuyệt đối **SRS Version 2.0 (Cập nhật 28/10/2026)**. Khi có mâu thuẫn giữa tài liệu này và SRS v2.0, **SRS v2.0 là nguồn chân lý cao nhất**.*
