# Chiến lược Kiểm thử & Đảm bảo Chất lượng (Test Strategy Specification)
## Nền tảng Thuê & Điều phối Điều dưỡng Theo Yêu cầu (HealthCareSystem On-Demand Nursing)

| Thuộc tính | Chi tiết Đặc tả |
|---|---|
| **Nguồn chuẩn đặc tả** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Cập nhật 28/10/2026)**, Mục 10 (Ma trận Truy vết RTM & Tiêu chí Nghiệm thu) |
| **Mô hình Kiến trúc** | Sàn giao dịch dịch vụ điều dưỡng kết nối Bệnh nhân/Gia đình với Bác sĩ/Điều dưỡng nghỉ hưu và Sinh viên y điều dưỡng mới tốt nghiệp. **Không có mô hình bệnh viện (No hospital tenants).** |
| **Phạm vi Kiểm thử** | Trọng tâm kiểm thử chức năng MVP (Giai đoạn 1) và thiết lập ranh giới nghiệm thu Giai đoạn 2 (Phase 2). |
| **Trạng thái tài liệu** | **Chính thức — Thay thế toàn diện phiên bản cơ sở bệnh viện cũ.** |

---

## 1. Mục tiêu & Triết lý Kiểm thử

1. **Truy vết Toàn trình Bằng Mã Định danh (100% Traceability):** Mọi ca kiểm thử đều phải gắn với mã yêu cầu chính thức của SRS v2.0 (`FR-*`, `NFR-*`, hoặc `TC-*`). Không có kiểm thử mồ côi và không có yêu cầu nghiệp vụ nào bị bỏ sót.
2. **Chặn Lỗi ở Tầng Thấp Nhất (Lowest-Cost Tier Interception):**
   - *Tầng Cơ sở dữ liệu (PostgreSQL 16):* Kiểm thử tính toàn vẹn của 16 bảng dữ liệu, khóa chính UUID, các trường enum, ràng buộc duy nhất (`idempotency_key`, `booking_code`), khóa ngoại và ràng buộc CHECK.
   - *Tầng Đơn vị & Logic Nghiệp vụ (Unit Tests):* Kiểm thử công thức tính giá tham số hóa (giá gốc + đêm + Lễ/Tết + bệnh nặng), công thức khoảng cách Haversine, thuật toán phục hồi/trừ điểm TrustScore, và thời gian đệm di chuyển 60 phút.
   - *Tầng Tích hợp & API (Integration Tests):* Kiểm thử các endpoint RESTful, chữ ký số HMAC-SHA256 của webhook thanh toán, giao dịch khóa dòng (`SELECT FOR UPDATE`), và luồng chuyển trạng thái 3 trục.
   - *Tầng Đầu cuối & Nghiệm thu (E2E / UAT):* Kiểm thử trọn vẹn hành trình người dùng trên Web/App Bệnh nhân, Web Portal Điều dưỡng, Mobile App Điều dưỡng và Web Portal Quản trị.
3. **Bảo vệ Nghiêm ngặt Ba Bề mặt Trọng yếu:**
   - **Tính Toàn vẹn Tài chính & Sổ cái:** Bao phủ kiểm thử 100% cho `wallet_transactions`, ví ký quỹ mô phỏng, khấu trừ hoa hồng 15% và cách ly ví tiền cọc 300.000 VNĐ.
   - **An toàn Lâm sàng & Giới hạn Chuyên môn:** Kiểm tra chặn cứng điều dưỡng Hạng 1 nhận dịch vụ xâm lấn (`403 Forbidden`), kiểm soát y lệnh 3 lớp, và tốc độ cảnh báo SOS $< 2\text{ giây}$.
   - **Bảo vệ Quyền riêng tư & Chống Gian lận:** Kiểm thử chặn fake GPS, selfie camera trực tiếp, và tự động thu hồi quyền xem bệnh án sau 12 giờ theo Nghị định 13/2023/NĐ-CP.

---

## 2. Phạm vi Kiểm thử theo Phân kỳ Sản phẩm

### 2.1. Trong Phạm vi Kiểm thử MVP (Giai đoạn 1)
- **Định danh & eKYC:** Đăng nhập Số điện thoại + OTP SMS; eKYC CCCD (bắt buộc đối với dịch vụ chăm sóc tại nhà); nộp và duyệt văn bằng điều dưỡng (Bằng tốt nghiệp, GPHN, Quyết định nghỉ hưu).
- **Phân hạng Chuyên môn Điều dưỡng:** Hạng 1 (chăm sóc cơ bản) vs. Hạng 2 (chuyên môn có GPHN); quy trình quét tự động giáng hạng khi hết hạn GPHN và tự động thăng hạng lại khi được duyệt gia hạn.
- **Danh mục Dịch vụ & Động cơ Tính giá:** 3 nhóm dịch vụ; công thức tính giá tham số hóa từ bảng `system_configs`.
- **Cơ chế Ghép cặp Ca trực:**
  - *Bắn Radar Điều phối:* Bán kính 5 km (0–5 phút) $\rightarrow$ 10 km (5–15 phút) cho các ca gấp ($\le 6\text{ giờ}$) với cơ chế khóa nguyên tử người đầu tiên bấm nhận.
  - *Bảng tin Việc làm:* Đăng công khai cho ca báo trước ($> 6\text{ giờ}$); đặt đích danh có 15 phút phản hồi.
  - *Ràng buộc đệm di chuyển:* Bắt buộc cách nhau tối thiểu 60 phút giữa 2 ca của cùng 1 điều dưỡng.
- **Thanh toán & Ví Đa ngăn:**
  - *Chuyển khoản:* Xác thực webhook HMAC-SHA256, chuyển tiền vào `ESCROW_HELD`, worker giải ngân tự động sau 24 giờ (15% sàn, 85% điều dưỡng).
  - *Tiền mặt:* Thu 100% tiền mặt tại chỗ, tạo mã VietQR/Link nộp 15% hoa hồng trong 24 giờ, tự động tạm khóa (`SUSPENDED`) nếu quá hạn.
  - *Ví Ký quỹ:* Yêu cầu nạp trước 300.000 VNĐ (`MIN_NURSE_DEPOSIT`), chỉ trừ khi có phạt vi phạm SLA (`PENALTY_DEDUCT`).
- **Thực thi Ca trực & Chống Gian lận:** Kiểm tra cờ Mock Location hệ điều hành, bán kính $\le 200\text{m}$, selfie live camera, nhật ký sinh hiệu thời gian thực, gia hạn ca và check-out nộp báo cáo.
- **Quy trình Khẩn cấp SOS:** Bật trình quay số gọi 115 lập tức trên máy + đồng thời gửi cảnh báo thời gian thực ($< 2\text{ giây}$) đến gia đình và quản trị viên kèm SMS dự phòng sau 60 giây.
- **Khiếu nại & Đánh giá Ẩn:** Mở khiếu nại trong 24 giờ, đóng băng giải ngân; đánh giá ẩn hai chiều (ẩn tối đa 7 ngày); trừ/cộng điểm TrustScore (0–100).
- **Giao tiếp Nội bộ:** Ẩn số điện thoại thực, quét regex nội dung tin nhắn chặn lộ thông tin liên lạc ngoài sàn.

### 2.2. Ngoài Phạm vi MVP (Chuyển sang Giai đoạn 2)
- Đấu thầu hợp đồng dài hạn theo tuần/tháng và ca làm thử (FR-BOOK-04).
- Quản lý vòng đời hợp đồng dài hạn: đổi điều dưỡng giữa kỳ, tạm dừng hợp đồng (FR-BOOK-05).
- Phân xử giải ngân/hoàn tiền chia theo tỷ lệ một phần (`PARTIALLY_SETTLED` / FR-DISP-02).
- Chế độ giao diện người cao tuổi cho App Bệnh nhân (NFR-UI-01.3).

---

## 3. Ma trận Truy vết Yêu cầu & Bộ Ca Kiểm thử Nghiệm thu (RTM Test Suites)

Các bộ kiểm thử dưới đây ánh xạ trực tiếp từ tiêu chí nghiệm thu định lượng tại Mục 10 của SRS v2.0:

| Mã Ca Kiểm thử | Yêu cầu Truy vết | Kịch bản & Thao tác Kiểm thử | Tiêu chí Nghiệm thu (Pass Criteria) |
|---|---|---|---|
| **TC-AUTH-01** | FR-AUTH-02 (Cấp bậc) | Đăng ký tài khoản tải lên 'Quyết định nghỉ hưu' nhưng không có GPHN còn hạn. | Chỉ được gán `TIER_1_BASIC`. Tuyệt đối không mở các dịch vụ xâm lấn. |
| **TC-AUTH-02** | FR-AUTH-02 (Quét hết hạn) | Kích hoạt Cronjob quét hàng ngày với điều dưỡng có `gphn_expiry_date < CURRENT_DATE`. | Tự động hạ xuống `TIER_1_BASIC`. Các ca xâm lấn đã `CONFIRMED` tương lai tự hủy và tìm người thay thế. |
| **TC-AUTH-03** | FR-AUTH-02 (Phân quyền) | Điều dưỡng Hạng 1 gọi API `POST /api/v1/bookings/:id/accept` cho đơn có `is_invasive = true`. | Hệ thống từ chối với mã lỗi `HTTP 403 Forbidden` (`TIER_INSUFFICIENT_FOR_INVASIVE`). |
| **TC-BOOK-01** | FR-BOOK-02 (Tải Y lệnh) | Khách hàng tạo đơn dịch vụ xâm lấn nhưng không tải ảnh đơn thuốc/y lệnh. | Hệ thống từ chối với mã lỗi `HTTP 400 Bad Request` (`PRESCRIPTION_REQUIRED`). |
| **TC-BOOK-02** | FR-BOOK-02 (Từ chối Y lệnh)| Điều dưỡng Hạng 2 đến nơi, phát hiện y lệnh hết hạn, bấm 'Từ chối ca do sai Y lệnh'. | Đơn chuyển sang `CANCELLED`; điều dưỡng không bị trừ cọc, không trừ điểm TrustScore, nhận 50.000 VNĐ hỗ trợ. |
| **TC-PRIV-01** | FR-PRIV-01 (Consent NĐ 13) | Tạo hồ sơ người bệnh nhưng không tích chọn checkbox cam kết đồng thuận dữ liệu sức khỏe. | Hệ thống chặn lưu hồ sơ (`HTTP 400`). Khi đồng thuận, lưu vết timestamp, IP và device ID. |
| **TC-PRIV-02** | FR-PRIV-01 (Khóa bệnh án) | Điều dưỡng đã check-out gọi API xem lại thông tin bệnh án sau thời điểm check-out $> 12\text{ giờ}$. | Hệ thống từ chối truy cập với mã `HTTP 403 Forbidden` (`DATA_ACCESS_EXPIRED`). |
| **TC-SOS-01** | FR-SHIFT-05 (Báo động SOS) | Bấm nút SOS trên ứng dụng di động trong ca trực đang diễn ra. | Mở ngay trình gọi cấp cứu 115 trên điện thoại; cảnh báo đến App gia đình và Web Admin trong $< 2\text{ giây}$. |
| **TC-PRICE-01**| FR-BOOK-01 (Tính giá) | Đặt ca 10 tiếng (20:00–06:00) ngày thường, đơn giá 50k/h với 8 tiếng đêm. | Giá gốc 500k + Phụ phí đêm (8h × 50k × 20% = 80k) = Tổng 580.000 VNĐ. |
| **TC-SETTLE-01**| FR-PAY-02 (Đối soát CK) | Đơn chuyển khoản hoàn tất ca; chờ đủ 24 giờ với `dispute_status = 'NONE'`. | Worker tự động giải ngân chính xác 85% cho điều dưỡng và trích 15% hoa hồng nền tảng. |
| **TC-SETTLE-02**| FR-PAY-02 (Hoa hồng TM) | Điều dưỡng bấm check-out đơn tiền mặt. | Hệ thống sinh mã VietQR nộp 15% hoa hồng; tuyệt đối không trừ ví cọc; đơn chuyển `SETTLED` khi webhook xác nhận. |
| **TC-PAY-01** | NFR-SEC-01.4 (Chữ ký HMAC) | Gửi webhook giả mạo sai chữ ký `X-Signature` HMAC-SHA256 đến API webhook. | Hệ thống từ chối với mã `HTTP 401 Unauthorized`; số dư các ví không thay đổi. |
| **TC-PAY-02** | NFR-SEC-01.4 (Chống lặp) | Gửi lặp lại 5 lần cùng 1 payload webhook thanh toán có chung `idempotency_key`. | Chỉ ghi nhận đúng 1 giao dịch trong `wallet_transactions`; các lần sau trả về `HTTP 200 OK`. |
| **TC-WALLET-01**| FR-PAY-03 (Chặn nhận việc)| Điều dưỡng có số dư cọc `deposit_balance = 200.000 VNĐ` bấm nhận ca. | Hệ thống từ chối (`HTTP 422`); yêu cầu nạp đủ 300.000 VNĐ trước khi nhận việc. |
| **TC-STATE-01**| FR-BOOK-01 (Quá hạn thanh toán)| Đơn nháp `DRAFT` không hoàn tất thanh toán sau 15 phút. | Hệ thống tự động chuyển `execution_status` sang `EXPIRED`. |
| **TC-CANCEL-01**| Phụ lục B (Hủy cận giờ) | Khách hủy đơn chuyển khoản trước giờ hẹn 5 tiếng (trong khung 2–12 giờ). | Phạt 20%: Hoàn 80% cho khách, cộng 15% cho điều dưỡng, nền tảng thu 5%. |
| **TC-CANCEL-02**| Phụ lục B (No-Show) | Điều dưỡng không đến sau 30 phút giờ hẹn; điều phối ca khẩn cấp thất bại. | Khóa vĩnh viễn tài khoản điều dưỡng (`BANNED`); phạt 50k cọc làm voucher cho khách; hoàn 100% tiền. |
| **TC-DISP-01** | FR-DISP-01 (Đóng băng khiếu nại)| Khách mở khiếu nại ở giờ thứ 18 sau check-out (`dispute_status = 'OPEN'`). | Cronjob chạy ở mốc 24 giờ bị chặn, tuyệt đối không giải ngân khoản tiền đang tranh chấp. |
| **TC-MATCH-01**| FR-SCHED-01 (Đệm di chuyển)| Điều dưỡng có ca kết thúc lúc 08:30 được quét cho ca mới bắt đầu lúc 09:00. | Hệ thống loại bỏ điều dưỡng khỏi danh sách do vi phạm thời gian đệm di chuyển 60 phút. |
| **TC-RATE-01** | FR-RATE-01 (Đánh giá ẩn) | Khách gửi đánh giá 5 sao; điều dưỡng chưa gửi đánh giá của mình. | Đánh giá được giữ ẩn (`is_visible = false`) cho tới khi điều dưỡng gửi hoặc sau 7 ngày. |
| **TC-KYC-01** | FR-AUTH-03 (eKYC khách) | Khách hàng chưa xác thực eKYC CCCD đặt ca chăm sóc tại nhà riêng (`HOME`). | Hệ thống chặn tạo đơn và yêu cầu hoàn tất định danh eKYC CCCD. |
| **TC-SEC-01** | FR-SHIFT-01 (Chống Fake GPS)| Điều dưỡng bật ứng dụng Fake GPS (`isFromMockProvider = true`) bấm Check-in. | Hệ thống từ chối Check-in (`HTTP 400 Bad Request`); lưu cờ cảnh báo vào `shift_logs`. |
| **TC-NFR-01** | NFR-NOTIF-01 (SMS dự phòng) | Bắn thông báo khẩn cấp qua FCM; giả lập thiết bị không phản hồi ACK sau 60 giây. | Background worker tự động kích hoạt gửi SMS / Zalo ZNS dự phòng về số điện thoại đăng ký. |

---

## 4. Tự động hóa Kiểm thử & Tiêu chuẩn Cổng Duyệt CI/CD

1. **Tầng Kiểm thử Đơn vị & Cục bộ (Local / Pre-commit):**
   - Kiểm tra cú pháp (ESLint), biên dịch kiểu tĩnh (TypeScript strict mode), định dạng mã nguồn (Prettier).
   - Kiểm thử đơn vị các hàm tính toán giá, phụ phí, công thức Haversine và thuật toán TrustScore.
2. **Tầng Kiểm thử Tích hợp (Pull Request CI Pipeline):**
   - Kiểm thử chạy các tệp di chuyển lược đồ CSDL (Database Migrations) trên PostgreSQL 16.
   - Kiểm thử tích hợp toàn bộ các API Auth OTP, máy trạng thái 3 trục của đơn đặt lịch, giao dịch ví ký quỹ và webhook HMAC.
   - **Tiêu chuẩn Cổng Duyệt:** Độ bao phủ kiểm thử (Test Coverage) đạt tối thiểu **80% dòng lệnh và nhánh rẽ** đối với các module tài chính, phân quyền và điều phối.
3. **Tầng Kiểm thử Đầu cuối & Hiệu năng (Staging / Nightly):**
   - Tự động hóa luồng E2E qua Cypress / Playwright: Tạo đơn $\rightarrow$ Điều phối Radar $\rightarrow$ Check-in GPS/Selfie $\rightarrow$ Nhật ký ca $\rightarrow$ Check-out $\rightarrow$ Đối soát 24h.
   - Kiểm thử tải: Truy vấn ghép cặp không gian PostGIS phải phản hồi dưới 500 mili-giây với 50 người dùng đồng thời.

---

*Lưu ý: Mọi chiến lược kiểm thử trên tuân thủ tuyệt đối **SRS Version 2.0 (Cập nhật 28/10/2026)**. Khi có mâu thuẫn giữa tài liệu này và SRS v2.0, **SRS v2.0 là nguồn chân lý cao nhất**.*
