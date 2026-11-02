# Đặc tả Quy tắc Nghiệp vụ Toàn diện (Business Rules Specification)
## Nền tảng Thuê & Điều phối Điều dưỡng Theo Yêu cầu (HealthCareSystem On-Demand Nursing)

| Thuộc tính | Chi tiết Đặc tả |
|---|---|
| **Nguồn chuẩn đặc tả** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Cập nhật 28/10/2026)** — Tích hợp đầy đủ 27 hạng mục rà soát CT-01–CT-27 và toàn bộ quyết định rà soát vòng 2. |
| **Mô hình Kiến trúc** | Sàn giao dịch dịch vụ y tế & điều dưỡng theo yêu cầu (On-Demand Nursing Marketplace) kết nối Bệnh nhân/Gia đình với Bác sĩ/Điều dưỡng nghỉ hưu và Sinh viên Y Điều dưỡng mới tốt nghiệp. **Không có mô hình bệnh viện (No hospital tenants).** |
| **Trạng thái tài liệu** | **Chính thức — Thay thế toàn diện phiên bản cơ sở bệnh viện cũ.** Văn bản này là nguồn quy tắc nghiệp vụ chuẩn hóa toàn diện, đồng bộ với FRS/NFRS tiếng Anh và tài liệu kiến trúc. |
| **Căn cứ Pháp lý** | • Luật Khám bệnh, chữa bệnh số 15/2023/QH15 (hiệu lực từ 01/01/2024)<br>• Nghị định 96/2023/NĐ-CP hướng dẫn thi hành Luật Khám bệnh, chữa bệnh<br>• Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân (Dữ liệu y tế nhạy cảm) |

---

## Mục lục
1. [Sáu Tiên đề Nghiệp vụ & Kiến trúc Bất biến](#1-sáu-tiên-đề-nghiệp-vụ--kiến-trúc-bất-biến)
2. [Nhóm A: Định danh, Tài khoản, eKYC & Quyền riêng tư](#nhóm-a-định-danh-tài-khoản-ekyc--quyền-riêng-tư)
3. [Nhóm B: Danh mục Dịch vụ, Lịch rảnh & Cơ chế Ghép cặp](#nhóm-b-danh-mục-dịch-vụ-lịch-rảnh--cơ-chế-ghép-cặp)
4. [Nhóm C: Đặt lịch, Tính giá Tham số hóa & Kiểm soát Y lệnh](#nhóm-c-đặt-lịch-tính-giá-tham-số-hóa--kiểm-soát-y-lệnh)
5. [Nhóm D: Thực thi Ca trực, Chống Gian lận & Giao thức Khẩn cấp SOS](#nhóm-d-thực-thi-ca-trực-chống-gian-lận--giao-thức-khẩn-cấp-sos)
6. [Nhóm E: Thanh toán, Ví Ký quỹ, Tiền cọc & Rút tiền](#nhóm-e-thanh-toán-ví-ký-quỹ-tiền-cọc--rút-tiền)
7. [Nhóm F: Khiếu nại, Đánh giá Ẩn, TrustScore & Giao tiếp Nội bộ](#nhóm-f-khiếu-nại-đánh-giá-ẩn-trustscore--giao-tiếp-nội-bộ)
8. [Nhóm G: Ma trận Chính sách SLA, Hủy lịch & Chế tài Bồi thường](#nhóm-g-ma-trận-chính-sách-sla-hủy-lịch--chế-tài-bồi-thường)
9. [Phụ lục: Danh mục Tham số Cấu hình Hệ thống (`system_configs`)](#phụ-lục-danh-mục-tham-số-cấu-hình-hệ-thống-system_configs)

---

## 1. Sáu Tiên đề Nghiệp vụ & Kiến trúc Bất biến

Toàn bộ các quy tắc nghiệp vụ trong tài liệu này vận hành dựa trên 6 nguyên tắc kiến trúc cốt lõi:

1. **Mô hình Thanh toán Kép & Tạm giữ Ký quỹ:**
   - **Chuyển khoản Trả trước (`BANK_TRANSFER`):** Khách hàng trả trước 100% tiền đơn qua cổng thanh toán Sandbox (PayOS / VNPay / VietQR); hệ thống tạm giữ trong Sổ cái Ký quỹ Mô phỏng (`ESCROW_HELD`). Sau khi kết thúc ca và hết thời hạn 24 giờ đối soát không có khiếu nại, hệ thống tự động trích 15% hoa hồng nền tảng và giải ngân 85% vào số dư khả dụng (`available_balance`) của điều dưỡng.
   - **Tiền mặt Tại chỗ (`CASH`):** Khách hàng trả 100% tiền mặt trực tiếp cho điều dưỡng khi kết thúc ca. Khoản khách hàng bồi dưỡng thêm (tiền tip) ngoài giá hiển thị trên app không bị tính hoa hồng. Sau khi check-out, điều dưỡng có nghĩa vụ tự chuyển khoản nộp 15% hoa hồng về hệ thống trong vòng 24 giờ qua mã VietQR / Link thanh toán. Quá 24 giờ chưa nộp, tài khoản điều dưỡng tự động bị tạm khóa (`SUSPENDED`).
2. **Cách ly Tiền cọc Điều dưỡng Duy nhất cho Vi phạm SLA:**
   - Điều dưỡng bắt buộc phải nộp đủ định mức ký quỹ ban đầu là **300.000 VNĐ** (`MIN_NURSE_DEPOSIT`) vào `deposit_balance` mới được cấp quyền nhận ca.
   - Ví Ký quỹ (deposit_balance) được **sử dụng độc quyền để khấu trừ các khoản phạt vi phạm theo chính sách SLA** (`PENALTY_DEDUCT`).
   - Nền tảng **tuyệt đối không khấu trừ 15% hoa hồng của đơn tiền mặt vào ví tiền cọc**.
3. **Phân hạng Chuyên môn theo Giấy phép Hành nghề (GPHN) & Tự động Chuyển hạng:**
   - Nhân sự được phân định thành 2 hạng chuyên môn: `TIER_1_BASIC` (chăm sóc cơ bản, không xâm lấn) và `TIER_2_SPECIALIST` (thực hiện thủ thuật xâm lấn theo y lệnh bác sĩ).
   - Khi GPHN hết hạn hiệu lực mà chưa kịp cập nhật, hệ thống tự động giáng hạng điều dưỡng từ `TIER_2_SPECIALIST` xuống `TIER_1_BASIC` (hồ sơ vẫn duy trì `ACTIVE` để nhận ca cơ bản). Khi điều dưỡng tải GPHN mới và được Admin phê duyệt, hệ thống tự động thăng hạng trở lại `TIER_2_SPECIALIST`. Quyết định nghỉ hưu chỉ có giá trị cấp huy hiệu thâm niên, không thay thế được GPHN.
4. **Máy Trạng thái Đặt lịch 3 Trục Độc lập:**
   - Mỗi đơn đặt lịch được điều khiển bởi 3 trục trạng thái trực giao riêng biệt: Trục Thực thi (`execution_status`), Trục Thanh toán (`payment_status`), và Trục Khiếu nại (`dispute_status`). Không gộp chung vào một trường trạng thái đơn lẻ.
5. **Tham số hóa Động Toàn bộ Quy tắc Nghiệp vụ (`system_configs`):**
   - Mọi tỷ lệ hoa hồng (15%), mức tiền cọc (300k), các tỷ lệ phụ phí đêm (+20%), Lễ Tết (+300%/+200%), bệnh nhân nặng (+15%), và các mốc thời gian timeout đều được lưu trữ trong bảng `system_configs`. Mã nguồn không bao giờ hard-code giá trị nghiệp vụ.
6. **Bảo vệ Dữ liệu Y tế Cá nhân Nhạy cảm (Nghị định 13/2023/NĐ-CP):**
   - Dữ liệu sức khỏe và y lệnh đòi hỏi sự đồng thuận tường minh của bệnh nhân hoặc người giám hộ.
   - Quyền xem bệnh án và ảnh y lệnh của điều dưỡng **tự động đóng lại chính xác sau 12 giờ kể từ thời điểm Check-out**. Hồ sơ y tế lưu trữ tối đa 24 tháng cho mục đích tra cứu và pháp lý.

---

## Nhóm A: Định danh, Tài khoản, eKYC & Quyền riêng tư

### BR-A01: Phương thức Định danh & Xác thực Tài khoản
- **Đăng nhập bằng Số điện thoại + OTP SMS:** Tài khoản Bệnh nhân/Khách hàng và Điều dưỡng xác thực đăng ký, đăng nhập và đặt lại mật khẩu thông qua Số điện thoại + Mã OTP SMS (hiệu lực 5 phút).
- **Xác thực 2 bước bắt buộc cho Quản trị viên (Admin 2FA):** Tài khoản Admin bắt buộc kích hoạt xác thực 2 bước (TOTP App / Hardware Token) khi đăng nhập vào Web Portal Quản trị.
- *Căn cứ:* SRS §2.1, §8; FRS FR-AUTH-01.

### BR-A02: Định danh eKYC CCCD Hai chiều
- **eKYC Bắt buộc cho Điều dưỡng:** Khi nộp hồ sơ, điều dưỡng bắt buộc tải ảnh CCCD 2 mặt, ảnh chân dung selfie trực tiếp và văn bằng chuyên môn. Trạng thái khởi tạo là `PENDING_VERIFICATION`.
- **eKYC Khách hàng theo Địa điểm Chăm sóc:**
  - *Chăm sóc tại Bệnh viện:* Khách hàng chỉ cần xác thực qua Số điện thoại + OTP SMS.
  - *Chăm sóc tại Nhà riêng (Home-care):* Bắt buộc tài khoản khách hàng phải hoàn tất định danh eKYC CCCD (ảnh 2 mặt CCCD + selfie) trước khi được phép bấm tạo đơn, bảo vệ an toàn tối đa cho điều dưỡng khi đến nhà riêng.
- *Căn cứ:* SRS §4.1 (FR-AUTH-03, CT-14).

### BR-A03: Quản lý Giấy phép Hành nghề (GPHN) & Chuyển đổi Hạng Tự động
- **Tiêu chuẩn Hạng:**
  - `TIER_1_BASIC`: Sinh viên Y/Điều dưỡng mới tốt nghiệp có bằng chính quy HOẶC nhân sự chưa có GPHN hoặc GPHN đã hết hạn. Chỉ được nhận dịch vụ không xâm lấn (`is_invasive = false`).
  - `TIER_2_SPECIALIST`: Bác sĩ/Điều dưỡng có GPHN còn hiệu lực và đúng phạm vi chuyên môn. Được nhận dịch vụ xâm lấn có điều kiện và không xâm lấn.
- **Quy trình Quét hạn Tự động:**
  - Cronjob quét hàng ngày trường `gphn_expiry_date`: Nếu GPHN hết hạn, tự động chuyển hạng `TIER_2_SPECIALIST` $\rightarrow$ `TIER_1_BASIC`. Hồ sơ vẫn `ACTIVE` để nhận việc cơ bản. Các ca xâm lấn đã `CONFIRMED` diễn ra sau ngày hết hạn bị tự động hủy không phạt và chuyển sang điều phối lại.
  - Khi điều dưỡng tải GPHN gia hạn lên Nurse Web/App và được Admin duyệt (`PATCH /api/v1/admin/nurses/:id/verify`), hệ thống tự động nâng hạng trở lại `TIER_2_SPECIALIST`.
- *Căn cứ:* SRS §1.3, §2.3, §4.1 (FR-AUTH-02, CT-01).

### BR-A04: Vòng đời Đồng thuận & Bảo mật Bệnh án theo Nghị định 13/2023/NĐ-CP
- **Xác nhận Đồng thuận:** Khách hàng/Người giám hộ bắt buộc tích chọn cam kết đồng thuận xử lý dữ liệu y tế nhạy cảm trước khi lưu hồ sơ bệnh nhân. Hệ thống lưu vết `consent_timestamp`, địa chỉ IP và mã thiết bị.
- **Kiểm soát Truy cập Có thời hạn (12-Hour Cutoff):** Chỉ điều dưỡng đang nhận ca ở trạng thái `CONFIRMED` hoặc `IN_PROGRESS` của đúng đơn đó mới có quyền xem thông tin bệnh nhân và ảnh y lệnh. Quyền truy cập **tự động đóng lại chính xác sau 12 giờ kể từ thời điểm check-out** (`checkout_time`). Sau 12 giờ, nếu phát sinh khiếu nại, chỉ Admin mới có quyền mở lại quyền xem có thời hạn kèm ghi nhận vào `audit_logs`.
- **Lưu trữ & Quyền xóa Dữ liệu:** Hồ sơ y tế được lưu giữ tối đa 24 tháng. Khách hàng có quyền yêu cầu xóa/ẩn danh dữ liệu cá nhân theo Nghị định 13 (đối với các tài khoản không có tranh chấp hay khiếu nại tài chính đang mở).
- *Căn cứ:* SRS §4.1 (FR-PRIV-01, CT-04), NFR-PRIV-01.

---

## Nhóm B: Danh mục Dịch vụ, Lịch rảnh & Cơ chế Ghép cặp

### BR-B01: Phân định Danh mục Dịch vụ Ba Nhóm
- **Nhóm 1 — Chăm sóc Cơ bản & Sinh hoạt (`is_invasive = false`):** Trông bệnh nhân theo ca (4h/8h/12h/24h), tắm gội tại giường, thay tã, vệ sinh, cho ăn qua đường miệng, nhắc uống thuốc theo đơn sẵn có, theo dõi dấu hiệu sinh tồn điện tử (HA, SpO2, mạch, nhiệt độ). Cho phép cả Hạng 1 và Hạng 2 tiếp nhận.
- **Nhóm 2 — Thủ thuật Xâm lấn Có điều kiện (`is_invasive = true`):** Tiêm bắp/tiêm dưới da (insulin, thuốc duy trì đã thử liều đầu an toàn tại viện), truyền dịch duy trì (muối, ringer, glucose), thay băng rửa vết thương phức tạp, cắt chỉ, chăm sóc/thay ống thông tiểu, cho ăn qua ống thông dạ dày đặt sẵn, hút đờm dãi hô hấp trên. Bắt buộc Điều dưỡng Hạng 2 có GPHN hiệu lực và bắt buộc có y lệnh/đơn thuốc bác sĩ. Điều dưỡng Hạng 1 nhận ca sẽ nhận mã lỗi `403 Forbidden`.
- **Nhóm 3 — Danh mục Nghiêm cấm Tuyệt đối trên Nền tảng:** Truyền máu/chế phẩm máu; tiêm truyền kháng sinh/hóa chất/thuốc có nguy cơ sốc phản vệ cao chưa test tại viện; phẫu thuật/tiểu phẫu rạch áp-xe/khâu vết thương cấp cứu/gây mê gây tê tại nhà; tự ý kê đơn thuốc mới hoặc đổi phác đồ của bác sĩ. Bị chặn tuyệt đối từ danh mục tạo đơn.
- *Căn cứ:* SRS §4.2 (CT-03); Luật KBCB 15/2023/QH15; Nghị định 96/2023/NĐ-CP.

### BR-B02: Lịch rảnh & Ràng buộc Đệm Di chuyển 60 Phút
- Điều dưỡng cấu hình lịch rảnh cố định lặp lại theo tuần và đăng ký các khoảng thời gian nghỉ đột xuất trong `nurse_availabilities`.
- **Quy tắc Đệm Di chuyển:** Động cơ điều phối (Matching Engine) bắt buộc cộng thêm **60 phút đệm di chuyển** giữa hai ca làm việc liên tiếp của cùng một điều dưỡng. Hệ thống tuyệt đối không điều phối hoặc cho phép điều dưỡng nhận ca nếu khoảng cách giữa ca mới và ca đã `CONFIRMED`/`IN_PROGRESS` vi phạm khoảng đệm 60 phút này.
- *Căn cứ:* SRS §4.2 (FR-SCHED-01, CT-10).

### BR-B03: Hai Cơ chế Ghép cặp Ca trực (Matching Engine)
- **Cơ chế A — Bắn Radar Điều phối (Ca gấp / Thời gian báo trước $\le$ 6 giờ):**
  - *Vòng 1 (Phút 0–5):* Bắn thông báo đẩy đến toàn bộ điều dưỡng đạt chuẩn chuyên môn, đang rảnh trong **bán kính 5 km**.
  - *Vòng 2 (Phút 5–15):* Nếu chưa có ai nhận, tự động mở rộng bán kính lên **10 km**.
  - Áp dụng khóa phân tán Redis Distributed Lock / `SELECT FOR UPDATE` đảm bảo người đầu tiên bấm nhận sẽ được phân công ca, không trùng lặp.
- **Cơ chế B — Bảng tin Việc làm (Ca báo trước > 6 giờ):**
  - Đăng công khai trên tab "Bảng việc làm" của các điều dưỡng phù hợp trong khu vực. Khách hàng có thể gửi yêu cầu đặt đích danh 1 điều dưỡng (người này có 15 phút phản hồi trước khi đơn phát rộng).
- **Hết hạn Ghép cặp (Timeout):** Nếu đến trước giờ bắt đầu ca 30 phút (hoặc sau 30 phút đối với đơn đặt gấp) mà vẫn chưa có ai nhận, đơn tự động chuyển sang `execution_status = EXPIRED` và kích hoạt hoàn tiền 100% cho khách (`payment_status = REFUNDED`).
- *Căn cứ:* SRS §4.3 (FR-BOOK-03, CT-22).

### BR-B04: Điều kiện Tiên quyết để Nhận Ca
Điều dưỡng chỉ được hệ thống phát tín hiệu điều phối và cho phép bấm nhận việc khi thỏa mãn đồng thời 4 điều kiện:
1. Trạng thái hồ sơ `nurse_profiles.profile_status = 'ACTIVE'`.
2. Đang bật trạng thái trực tuyến `is_online = true`.
3. Số dư tiền cọc `deposit_balance >= 300.000 VNĐ` (`MIN_NURSE_DEPOSIT`).
4. Không có tranh chấp lịch trực (thỏa mãn đệm di chuyển 60 phút).
- *Căn cứ:* SRS §2.3, §4.3, §4.5.

---

## Nhóm C: Đặt lịch, Tính giá Tham số hóa & Kiểm soát Y lệnh

### BR-C01: Động cơ Tính giá Tham số hóa & Phụ phí
Giá trị ca trực được hệ thống tự động tính toán dựa trên các tham số cấu hình trong `system_configs`:
$$\text{Tổng tiền} = \text{Giá gốc} + \text{Phụ phí đêm} + \text{Phụ phí Lễ/Tết} + \text{Phụ phí bệnh nhân nặng}$$
- **Phụ phí ca đêm (`SURCHARGE_NIGHT_SHIFT = 0.20`):** Cộng thêm 20% đơn giá tính trên **số giờ thực tế làm việc rơi vào khung 22:00–06:00**.
- **Phụ phí Tết Nguyên Đán (`SURCHARGE_HOLIDAY_MAJOR = 3.00`):** Phụ phí = 300% $\times$ Giá gốc ca trực.
- **Phụ phí Ngày Lễ khác (`SURCHARGE_HOLIDAY_MINOR = 2.00`):** Phụ phí = 200% $\times$ Giá gốc ca trực.
- **Phụ phí Bệnh nhân nặng (`SURCHARGE_HEAVY_PATIENT = 0.15`):** Cộng thêm 15% khi bệnh nhân `weight_kg >= 80` HOẶC `mobility_status = 'BEDRIDDEN'`.
- *Quy tắc cộng dồn:* Toàn bộ phụ phí được tính độc lập trên giá gốc của ca, không nhân chồng lũy tiến.
- *Ví dụ:* Ca trực 20:00–06:00 (10 giờ) ngày thường, đơn giá 50.000đ/giờ $\rightarrow$ Giá gốc 500.000đ; giờ đêm (22:00–06:00) là 8 giờ $\rightarrow$ Phụ phí đêm $8 \times 50.000 \times 20\% = 80.000đ$; Tổng tiền = 580.000 VNĐ.
- *Căn cứ:* SRS §4.3 (FR-BOOK-01, CT-05), §5.1.

### BR-C02: Vòng đời Giữ chỗ Đơn Nháp (Draft Timeout)
- Đơn sau khi khởi tạo có `execution_status = DRAFT`, `payment_status = UNPAID`.
- Hệ thống giữ chỗ đơn trong thời gian tối đa **15 phút** (`PAYMENT_TIMEOUT_MINUTES = 15`). Quá thời hạn này mà khách hàng chưa hoàn tất thanh toán, đơn tự động chuyển sang `execution_status = EXPIRED` và giải phóng lịch.
- Phương thức thanh toán (`BANK_TRANSFER` hoặc `CASH`) bắt buộc phải lựa chọn ngay từ bước tạo đơn nháp.
- *Căn cứ:* SRS §2.2, §4.3, §5.1.

### BR-C03: Quy trình Kiểm soát & Đối chiếu Y lệnh Bác sĩ 3 Lớp
- **Lớp 1 (Khi tạo đơn - Khách hàng):** Khi đặt dịch vụ xâm lấn (`is_invasive = true`), khách bắt buộc tải ảnh đơn thuốc/y lệnh (thời hạn kê đơn $\le 7$ ngày, rõ tên người bệnh, tên thuốc, hàm lượng, chữ ký và con dấu bác sĩ/cơ sở y tế).
- **Lớp 2 (Trước khi nhận ca - Điều dưỡng Hạng 2):** Điều dưỡng bắt buộc mở xem ảnh y lệnh trên app trước khi bấm nút "Nhận ca".
- **Lớp 3 (Tại điểm hẹn - Check-in):** Khi đến nơi, điều dưỡng đối chiếu y lệnh giấy bản gốc và nhãn thuốc thực tế.
  - Nếu y lệnh giả mạo, hết hạn, bị tẩy xóa hoặc thuốc không đúng chỉ định: Điều dưỡng có quyền bấm **"Từ chối ca do Y lệnh không hợp lệ"** kèm ảnh chụp bằng chứng.
  - Ca trực lập tức bị hủy, điều dưỡng **không bị trừ tiền cọc, không bị trừ TrustScore** và được nhận **50.000 VNĐ hỗ trợ xăng xe** (`ICU_TRAVEL_SUPPORT`) từ quỹ vận hành của hệ thống.
- *Căn cứ:* SRS §3 (RISK-01), §4.3 (FR-BOOK-02, CT-02).

---

## Nhóm D: Thực thi Ca trực, Chống Gian lận & Giao thức Khẩn cấp SOS

### BR-D01: Check-in Xác thực Kép & Chống Giả lập GPS/Selfie
- Điều dưỡng thực hiện Check-in tại điểm hẹn qua ứng dụng di động Nurse Mobile App.
- **Chặn Fake GPS:** Đọc cờ phần cứng hệ điều hành (`isFromMockProvider` trên Android / `isSimulatedBySoftware` trên iOS). Nếu phát hiện ứng dụng giả lập tọa độ, từ chối check-in ngay lập tức và ghi log an ninh.
- **Bán kính Cho phép:** Khoảng cách GPS thực tế so với tọa độ đặt hẹn phải $\le$ **200 mét** (`CHECKIN_MAX_RADIUS_METERS`) tính theo công thức Haversine.
- **Live Selfie:** Bắt buộc chụp ảnh khuôn mặt trực tiếp qua camera ứng dụng (vô hiệu hóa tính năng tải ảnh từ bộ sưu tập điện thoại). Ảnh chụp được gắn watermark tọa độ GPS và dấu thời gian UTC của server, đồng thời truyền đến app của khách hàng.
- Check-in thành công chuyển `execution_status` $\rightarrow$ `IN_PROGRESS`.
- *Căn cứ:* SRS §3 (RISK-05), §4.4 (FR-SHIFT-01, CT-21).

### BR-D02: Báo cáo Lệch Tình trạng & Nhật ký Lâm sàng Thời gian thực
- **Báo cáo Lệch Tình trạng (30 phút đầu ca):** Trong 30 phút đầu sau check-in, nếu điều dưỡng phát hiện thực tế người bệnh khác biệt nghiêm trọng so với khai báo (nằm liệt giường không báo trước, mắc bệnh truyền nhiễm nguy hiểm, môi trường uy hiếp an toàn), điều dưỡng có quyền yêu cầu cập nhật phụ phí hoặc từ chối thực hiện tiếp mà không bị xử phạt.
- **Nhật ký Y khoa Liên tục:** Trong suốt ca, điều dưỡng ghi nhận các chỉ số sinh tồn (Huyết áp, Mạch, Nhiệt độ, SpO2) và đầu mục chăm sóc vào `shift_logs`, đồng bộ thời gian thực qua WebSocket.
- *Căn cứ:* SRS §4.4 (FR-SHIFT-02).

### BR-D03: Gia hạn Ca trực (Overtime)
- Khách hàng có quyền gửi yêu cầu gia hạn ca trước khi kết thúc ca ít nhất 30 phút.
- Gia hạn theo bội số của 1 giờ (`POST /api/v1/bookings/:id/extend`).
- Chỉ được chấp thuận khi điều dưỡng bấm đồng ý và không xung đột với ca làm việc tiếp theo. Phí gia hạn được thanh toán bổ sung qua ký quỹ (với đơn chuyển khoản) hoặc cộng vào tổng tiền thanh toán cuối ca (với đơn tiền mặt).
- *Căn cứ:* SRS §4.4 (FR-SHIFT-03).

### BR-D04: Check-out, Quyết toán Theo Việc & Hai Bộ đếm Tự động
- Kết thúc ca, điều dưỡng cập nhật sinh hiệu cuối ca, tóm tắt các hoạt động chăm sóc, ghi chú bàn giao và bấm Check-out (`POST /api/v1/bookings/:id/check-out`).
- Hệ thống ghi nhận `checkout_time` và chuyển `execution_status` $\rightarrow$ `COMPLETED`.
- **Dịch vụ Theo Việc (Task-based):** Hoàn thành đầy đủ các đầu việc trong danh mục thì được tính trọn vẹn 100% giá dịch vụ ngay cả khi kết thúc sớm hơn thời lượng dự kiến.
- **Kích hoạt Hai Bộ đếm Tự động:**
  1. Kích hoạt bộ đếm **24 giờ giải quyết khiếu nại & đối soát** (`SETTLEMENT_COOLING_HOURS = 24`).
  2. Kích hoạt bộ đếm **12 giờ tự động khóa quyền truy cập dữ liệu y tế** của điều dưỡng (BR-A04).
- *Căn cứ:* SRS §4.4 (FR-SHIFT-04).

### BR-D05: Giao thức Xử lý Khẩn cấp Y tế (SOS)
Khi người bệnh có dấu hiệu nguy kịch (ngừng thở, tím tái, sốc phản vệ, đột quỵ) trong ca:
- **Bước 1 (Hành động Tại chỗ - Ưu tiên Số 1 Tuyệt đối):** Điều dưỡng hoặc người tại chỗ phải lập tức gọi **Cấp cứu 115** và thực hiện hồi sức cấp cứu ban đầu trong phạm vi chuyên môn. Màn hình SOS trên app tự động mở ngay trình quay số 115.
- **Bước 2 (Hệ thống Hỗ trợ Cảnh báo):** Ứng dụng đồng thời phát cảnh báo khẩn cấp (Push Notification + SMS dự phòng sau 60 giây) kèm tọa độ GPS và tóm tắt chỉ số sinh tồn mới nhất tới Gia đình và Web Admin. Hệ thống chỉ đóng vai trò truyền tin hỗ trợ, tuyệt đối không thay thế tổng đài cấp cứu 115.
- *Căn cứ:* SRS §3 (RISK-03), §4.4 (FR-SHIFT-05, CT-04), NFR-PERF-02.

---

## Nhóm E: Thanh toán, Ví Ký quỹ, Tiền cọc & Rút tiền

### BR-E01: Kiến trúc Hai Phương thức Thanh toán
Mỗi đơn đặt lịch phải xác định rõ ràng phương thức thanh toán ngay từ khi khởi tạo:
- **`BANK_TRANSFER` (Chuyển khoản Trả trước):** Khách hàng thanh toán 100% tiền đơn qua cổng sandbox trước ca trực. Cổng gửi Webhook xác thực chữ ký số HMAC-SHA256 $\rightarrow$ hệ thống khóa tiền vào sổ cái tạm giữ (`ESCROW_HELD`).
- **`CASH` (Tiền mặt Tại chỗ):** Khách hàng trả 100% tiền mặt trực tiếp cho điều dưỡng khi kết thúc ca. Nền tảng không giữ khoản tiền này. Tiền bo vượt ngoài giá app thuộc trọn vẹn về điều dưỡng và không bị tính hoa hồng.
- *Căn cứ:* SRS §1.3, §4.5 (FR-PAY-01, CT-06).

### BR-E02: Quyết toán Tự động Sau 24 Giờ & Nộp Hoa hồng Tiền mặt
- **Thời hạn Nghiệm thu / Khiếu nại Chuẩn:** Đúng 24 giờ (`SETTLEMENT_COOLING_HOURS = 24`) tính từ thời điểm `checkout_time`.
- **Đối với Đơn Chuyển khoản (`BANK_TRANSFER`):**
  - Nếu khách hàng bấm "Xác nhận hoàn thành" sớm HOẶC sau đúng 24 giờ mà `dispute_status = 'NONE'`: Worker tự động khấu trừ 15% hoa hồng (`PLATFORM_COMMISSION_RATE = 0.15`), giải ngân 85% còn lại vào `available_balance` của điều dưỡng và chuyển `payment_status` $\rightarrow$ `SETTLED`.
- **Đối với Đơn Tiền mặt (`CASH`):**
  - Ngay khi Check-out (`COMPLETED`), hệ thống tính 15% hoa hồng trên giá hiển thị trong ứng dụng và sinh mã VietQR / Link thanh toán trên Nurse Web & App.
  - Điều dưỡng có nghĩa vụ tự chuyển khoản nộp 15% hoa hồng cho nền tảng trong vòng 24 giờ.
  - Khi Webhook xác nhận nhận đủ 15%, đơn chuyển sang `SETTLED` (ghi nhận giao dịch `COMMISSION_PAYMENT`).
  - **Chế tài Quá hạn:** Nếu quá 24 giờ điều dưỡng chưa nộp đủ hoa hồng, hệ thống tự động khóa quyền nhận ca mới (`SUSPENDED`) cho đến khi nộp đủ. Tuyệt đối không cấn trừ hoa hồng vào Ví Ký quỹ (`deposit_balance`).
- *Căn cứ:* SRS §2.2, §4.5 (FR-PAY-02, CT-05, CT-17).

### BR-E03: Ví Tiền cọc Điều dưỡng (`deposit_balance`)
- **Định mức Nộp trước:** Điều dưỡng phải nạp đủ 300.000 VNĐ (`MIN_NURSE_DEPOSIT`) vào `deposit_balance` trước khi nhận ca. Không áp dụng trích lũy tiến từ thu nhập và không giới hạn giá trị ca theo số dư ký quỹ.
- **Mục đích Duy nhất:** Dùng duy nhất để khấu trừ các khoản phạt vi phạm theo chính sách SLA (`PENALTY_DEDUCT`). Tuyệt đối không dùng để trừ hoa hồng ca tiền mặt.
- **Khóa Nhận Việc khi Thâm hụt:** Khi tiền phạt làm `deposit_balance < 300.000 VNĐ`, tài khoản tự động bị chuyển sang `SUSPENDED` cho đến khi nạp bù đủ định mức.
- **Hoàn trả Tiền cọc:** Tiền cọc chỉ được rút toàn bộ khi điều dưỡng gửi đơn xin ngừng hợp tác và đóng tài khoản sau 7 ngày không phát sinh khiếu nại.
- *Căn cứ:* SRS §1.3, §2.3, §4.5 (FR-PAY-03, CT-07).

### BR-E04: Sổ cái Tài chính Bất biến & Chống Xử lý Lặp (Idempotency)
- Mọi biến động số dư phải được ghi thành một dòng giao dịch mới trong `wallet_transactions` kèm theo hai trường bắt buộc `balance_before` và `balance_after`. Tuyệt đối cấm lệnh SQL `UPDATE` trực tiếp số dư ví mà không có bản ghi sổ cái.
- Mọi Webhook cổng thanh toán phải truyền kèm mã giao dịch làm `idempotency_key` (ràng buộc `UNIQUE`). Nếu cổng thanh toán gửi lại webhook trùng lặp, hệ thống trả về HTTP 200 nhưng tuyệt đối không cộng/trừ tiền lần thứ hai.
- *Căn cứ:* SRS §2.3, §7, §9 (NFR-SEC-01.4, NFR-SEC-01.5).

### BR-E05: Quản lý Thu nhập & Rút tiền về Ngân hàng
- Điều dưỡng được tạo lệnh rút tiền từ số dư khả dụng (`available_balance`) về tài khoản ngân hàng chính chủ đã liên kết (`POST /api/v1/wallets/withdraw`).
- Số tiền rút tối đa $\le$ `available_balance`. Giao dịch thực hiện dưới kiểm tra ACID Transaction kết hợp khóa dòng dữ liệu (`SELECT ... FOR UPDATE`), ghi nhận trạng thái `WITHDRAW_REQUESTED` chờ Admin hoặc cổng chi hộ phê duyệt chuyển khoản (`WITHDRAWN`).
- *Căn cứ:* SRS §4.5 (FR-PAY-04, CT-15).

---

## Nhóm F: Khiếu nại, Đánh giá Ẩn, TrustScore & Giao tiếp Nội bộ

### BR-F01: Quy trình Khiếu nại Ca trực (Dispute Workflow)
- **Thời hạn Mở khiếu nại:** Cả khách hàng và điều dưỡng đều có quyền gửi khiếu nại trong khoảng thời gian từ lúc `IN_PROGRESS` đến tối đa 24 giờ sau `checkout_time`. Cho phép đính kèm tối đa 5 ảnh/video bằng chứng.
- **Đóng băng Ký quỹ Tức thì:** Khi `dispute_status` chuyển sang `OPEN`, hệ thống lập tức đóng băng số tiền đang tạm giữ trong Escrow (chặn đứng worker giải ngân tự động 24h).
- **Phán quyết của Admin:**
  - `RESOLVED_CUSTOMER` (Khách đúng): Hoàn 100% tiền cho khách (`payment_status = REFUNDED`), trừ 25 điểm TrustScore và phạt tiền cọc điều dưỡng vi phạm. (Đối với đơn tiền mặt, khoản bồi thường cho khách được trích từ ví cọc `deposit_balance` của điều dưỡng).
  - `RESOLVED_NURSE` (Điều dưỡng đúng): Giải ngân 100% thù lao (85% sau phí) cho điều dưỡng (`payment_status = SETTLED`).
  - `RESOLVED_PARTIAL` (Phân xử chia tỷ lệ - Giai đoạn 2): Admin nhập tỷ lệ phân chia hoàn tiền/giải ngân $\rightarrow$ `payment_status = PARTIALLY_SETTLED`.
- *Căn cứ:* SRS §2.2, §4.6 (FR-DISP-01, FR-DISP-02, CT-09, CT-11).

### BR-F02: Cơ chế Đánh giá Ẩn Hai chiều
- Sau khi ca kết thúc (`execution_status = COMPLETED`, không cần chờ quyết toán tiền), khách hàng và điều dưỡng đánh giá chéo 1–5 sao và viết nhận xét.
- **Nguyên tắc Giữ bí mật Đánh giá (Blind Rating):** Nhận xét và điểm số của cả hai phía được giữ ẩn (`reviews.is_visible = false`) cho đến khi cả hai bên cùng hoàn thành đánh giá HOẶC sau 7 ngày kể từ lúc kết thúc ca, triệt tiêu hoàn toàn tình trạng đánh giá trả đũa.
- *Căn cứ:* SRS §4.6 (FR-RATE-01, CT-12).

### BR-F03: Cơ chế Điểm Tín nhiệm (TrustScore) & Phục hồi
- Điểm Tín nhiệm mặc định ban đầu: **100 điểm** (thang điểm 0–100).
- **Quy tắc Trừ điểm:**
  - Điều dưỡng hủy ca trước > 12 giờ: **Trừ 5 điểm**.
  - Điều dưỡng hủy ca gấp $\le$ 12 giờ: **Trừ 20 điểm**.
  - Vi phạm bị khách hàng khiếu nại đúng: **Trừ 25 điểm**.
- **Quy tắc Phục hồi Điểm (Recovery Rule):** Mỗi ca trực hoàn tất thành công (`SETTLED`) và được khách hàng đánh giá $\ge$ 4 sao được cộng lại **+2 điểm TrustScore** (tối đa không quá 100 điểm).
- **Ngưỡng Tự động Khóa:** Nếu TrustScore < 60 điểm, hệ thống tự động chuyển trạng thái hồ sơ sang tạm khóa (`SUSPENDED`).
- *Căn cứ:* SRS §2.3, §4.6 (FR-RATE-01, CT-12).

### BR-F04: Giao tiếp Nội bộ Ẩn số & Quét Chống Thất thoát Nền tảng
- Kênh liên lạc duy nhất giữa khách hàng và điều dưỡng là tính năng chat / gọi điện trong ứng dụng, được mở khi đơn ở trạng thái `CONFIRMED`. Số điện thoại thật của hai bên được che giấu hoàn toàn.
- **Quét Regex Nội dung:** Hệ thống quét tự động tin nhắn theo thời gian thực; khi phát hiện số điện thoại, link mạng xã hội hoặc mồi chài giao dịch ngoài sàn, hệ thống hiển thị cảnh báo vi phạm cho người gửi và lưu log an ninh.
- Toàn bộ lịch sử chat và log cuộc gọi (`conversations_messages`) được lưu trữ làm bằng chứng phân xử khiếu nại.
- *Căn cứ:* SRS §3 (RISK-06), §4.6 (FR-CHAT-01).

---

## Nhóm G: Ma trận Chính sách SLA, Hủy lịch & Chế tài Bồi thường

Chính sách SLA toàn diện thay thế hoàn toàn bảng BR-18 F1a–F9 cũ, phân định rõ ràng giữa đơn Chuyển khoản và đơn Tiền mặt:

> **Quy định Áp dụng theo Hình thức Thanh toán:**
> - Các tỷ lệ hoàn tiền bên dưới áp dụng cho đơn Chuyển khoản (khách đã trả tiền vào hệ thống).
> - Đối với đơn Tiền mặt, do khách chưa trả tiền nên không phát sinh hoàn tiền; các khoản phạt vi phạm SLA của điều dưỡng vẫn khấu trừ trực tiếp vào Ví Ký quỹ (`deposit_balance`). Tiền phạt khách hàng hủy ca không thu qua sàn mà được ghi nhận cảnh báo vào lịch sử tài khoản.

| STT | Kịch bản / Đối tượng | Điều kiện Kích hoạt | Chế tài Phạt / Hoàn tiền | Xử lý Dòng tiền & Trạng thái Hệ thống |
|---|---|---|---|---|
| **1** | **Khách hàng hủy sớm** | $\Delta t > 12\text{ giờ}$ trước giờ bắt đầu | Phạt 0%<br>Hoàn 100% | • Chuyển `CANCELLED`. Hoàn 100% tiền tạm giữ cho khách (`REFUNDED`).<br>• Giải phóng lịch rảnh cho điều dưỡng. |
| **2** | **Khách hàng hủy cận giờ** | $2\text{ giờ} \le \Delta t \le 12\text{ giờ}$ trước bắt đầu | Phạt 20%<br>Hoàn 80% | • Hoàn 80% cho khách hàng.<br>• Cộng 15% vào ví thu nhập của điều dưỡng (bồi thường giữ lịch), nền tảng thu 5%. |
| **3** | **Khách hàng hủy sát giờ** | $\Delta t < 2\text{ giờ}$ trước bắt đầu (chưa check-in) | Phạt 50%<br>Hoàn 50% | • Hoàn 50% cho khách hàng.<br>• Cộng 40% vào ví của điều dưỡng (bồi thường chi phí di chuyển & mất ca), nền tảng thu 10%. |
| **4** | **Khách hàng dừng ca sau khi đã Check-in** | Đang `IN_PROGRESS`, khách cho kết thúc sớm (không do lỗi điều dưỡng) | Tính theo giờ thực tế<br>Không phạt hủy | • Tính 100% tiền công cho số giờ thực tế đã phục vụ (tối thiểu 1 giờ). Đơn theo việc hoàn thành đủ checklist được hưởng trọn vẹn 100% giá dịch vụ.<br>• Hoàn trả 100% phần thời gian chưa sử dụng cho khách hàng (đơn chuyển khoản). Không tạo trạng thái `PARTIALLY_SETTLED`. |
| **5** | **Khách hàng hủy vì Lý do Y tế Bất khả kháng** | Bệnh nhân cấp cứu ICU hoặc tử vong (có giấy xác nhận) | Miễn phạt 100%<br>Hoàn 100% | • Hoàn 100% tiền chưa sử dụng cho gia đình bệnh nhân.<br>• Trích quỹ vận hành hỗ trợ xăng xe cố định **50.000 VNĐ** (`ICU_TRAVEL_SUPPORT`) cho điều dưỡng nếu đã xuất phát di chuyển. |
| **6** | **Điều dưỡng hủy sớm** | $\Delta t > 12\text{ giờ}$ trước giờ bắt đầu | Phạt 0 VNĐ<br>**Trừ 5 điểm TrustScore** | • Không trừ tiền cọc; trừ 5 điểm TrustScore.<br>• Đơn tự động chuyển về trạng thái `MATCHING` để tìm người khác thay thế. |
| **7** | **Điều dưỡng hủy gấp** | $\Delta t \le 12\text{ giờ}$ trước giờ bắt đầu | Phạt 20% giá ca<br>**Trừ 20 điểm TrustScore** | • Khấu trừ 20% giá trị ca từ Ví Ký Quỹ `deposit_balance` (ghi nợ nếu thiếu).<br>• Toàn bộ tiền phạt chuyển thành **"Thưởng nóng (Urgent Bonus)"** cộng vào đơn và đẩy vào Radar SOS tìm người thay thế. |
| **8** | **Điều dưỡng Bùng ca (No-Show)** | Quá 30 phút giờ hẹn không đến VÀ không tìm được người thay thế | **Khóa vĩnh viễn (BANNED)**<br>Phạt 50.000 VNĐ cọc<br>Voucher 50k cho khách | • Khóa vĩnh viễn tài khoản điều dưỡng (`BANNED`) ngay từ lần no-show đầu tiên.<br>• Phạt 50.000 VNĐ (`NO_SHOW_PENALTY`) trừ vào ví cọc; toàn bộ tiền phạt chuyển thành Voucher 50.000 VNĐ cho khách hàng.<br>• Hoàn 100% tiền đơn hàng cho khách (`REFUNDED` — đơn chuyển khoản) kèm voucher xin lỗi. |
| **9** | **Hết hạn Thanh toán / Hết hạn Ghép cặp** | Quá 15 phút khách chưa trả tiền; hoặc đến trước ca 30 phút không có ai nhận | Không phạt<br>Hoàn 100% | • Chuyển `execution_status = EXPIRED`.<br>• Nếu đơn đã thu tiền (`ESCROW_HELD`), tự động hoàn lại 100% tiền (`REFUNDED`) kèm thông báo xin lỗi khách hàng. |

---

## Phụ lục: Danh mục Tham số Cấu hình Hệ thống (`system_configs`)

| Khóa Cấu hình (config_key) | Giá trị Chuẩn | Đơn vị | Nhóm Nghiệp vụ | Mô tả & Ý nghĩa Áp dụng |
|---|---|---|---|---|
| `PLATFORM_COMMISSION_RATE` | `0.15` | Tỷ lệ (15%) | Phí nền tảng | Phí hoa hồng sàn. Đơn chuyển khoản trích 15% khi giải ngân; đơn tiền mặt điều dưỡng tự nộp 15% trong 24h. |
| `MIN_NURSE_DEPOSIT` | `300000` | VNĐ | Tiền ký quỹ | Mức tiền cọc điều dưỡng bắt buộc phải nạp trước khi nhận ca; chỉ dùng duy nhất để trừ phạt SLA. |
| `SURCHARGE_NIGHT_SHIFT` | `0.20` | Tỷ lệ (+20%) | Phụ phí ca đêm | Phụ phí ca đêm tính trên đơn giá giờ cho các giờ làm việc nằm trong khung 22:00–06:00. |
| `SURCHARGE_HOLIDAY_MAJOR` | `3.00` | Tỷ lệ (+300%) | Phụ phí Lễ Tết | Phụ phí Tết Nguyên Đán: Phụ phí = 300% $\times$ Giá gốc ca trực. |
| `SURCHARGE_HOLIDAY_MINOR` | `2.00` | Tỷ lệ (+200%) | Phụ phí ngày Lễ | Phụ phí các ngày nghỉ lễ luật định khác: Phụ phí = 200% $\times$ Giá gốc ca trực. |
| `SURCHARGE_HEAVY_PATIENT` | `0.15` | Tỷ lệ (+15%) | Phụ phí bệnh nặng | Phụ phí bệnh nhân có `weight_kg >= 80` HOẶC `mobility_status = 'BEDRIDDEN'`. |
| `PAYMENT_TIMEOUT_MINUTES` | `15` | Phút | Giữ chỗ đơn | Thời gian giữ chỗ đơn DRAFT chờ khách thanh toán; quá hạn chuyển thành EXPIRED. |
| `SETTLEMENT_COOLING_HOURS` | `24` | Giờ | Đối soát giải ngân | Cửa sổ chờ khiếu nại sau check-out trước khi worker tự động giải ngân cho điều dưỡng. |
| `CHECKIN_MAX_RADIUS_METERS` | `200` | Mét | Định vị GPS | Bán kính khoảng cách tối đa cho phép điều dưỡng thực hiện Check-in tại điểm hẹn. |
| `ICU_TRAVEL_SUPPORT` | `50000` | VNĐ | Hỗ trợ vận hành | Hỗ trợ xăng xe cho điều dưỡng khi khách hủy vì cấp cứu ICU sau khi điều dưỡng đã xuất phát. |
| `NO_SHOW_PENALTY` | `50000` | VNĐ | Phạt vi phạm | Tiền phạt điều dưỡng bùng ca; chuyển toàn bộ thành voucher bồi thường cho khách hàng. |

---

*Lưu ý: Mọi quyết định và quy tắc trong tài liệu này tuân thủ tuyệt đối **SRS Version 2.0 (Cập nhật 28/10/2026)**. Khi có bất kỳ sự khác biệt nào giữa tài liệu này và SRS v2.0, **SRS v2.0 là nguồn chân lý cao nhất**.*
