# Đặc tả Yêu cầu Chức năng (FR) & Phi chức năng (NFR)
## Nền tảng Thuê & Điều phối Điều dưỡng Theo Yêu cầu (HealthCareSystem On-Demand Nursing)

| Thuộc tính | Chi tiết Đặc tả |
|---|---|
| **Nguồn chuẩn đặc tả** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Cập nhật 28/10/2026)** — Tích hợp đầy đủ 27 hạng mục rà soát CT-01–CT-27 và toàn bộ quyết định rà soát vòng 2. |
| **Mô hình Kiến trúc** | Sàn giao dịch dịch vụ điều dưỡng kết nối Bệnh nhân/Gia đình với Bác sĩ/Điều dưỡng nghỉ hưu và Sinh viên y điều dưỡng mới tốt nghiệp. **Không có mô hình bệnh viện (No hospital tenants).** |
| **Công nghệ đã chốt** | • **Giao diện Web:** React (Web Bệnh nhân, Web Portal Điều dưỡng, Web Portal Quản trị)<br>• **Giao diện Mobile:** App Điều dưỡng (React Native)<br>• **Backend:** Node.js + TypeScript, Express/NestJS, PostgreSQL 16 (16 bảng cốt lõi)<br>• **Lưu trữ & Đa phương tiện:** Cloud Object Storage riêng tư (S3/MinIO) kèm URL ký trước (Presigned URL) hiệu lực 10 phút<br>• **Thông báo & Cảnh báo:** FCM Push Notification + SMS / Zalo ZNS dự phòng + WebSocket thời gian thực<br>• **Cổng thanh toán:** PayOS / VNPay / VietQR sandbox (Webhook xác thực HMAC-SHA256)<br>• **Bản đồ & Định vị:** Google Maps / Goong Geocoding API |
| **Trạng thái tài liệu** | **Chính thức — Thay thế toàn diện phiên bản cơ sở bệnh viện cũ.** Đồng bộ 100% với FRS và NFRS tiếng Anh. |
| **Căn cứ Pháp lý** | • Luật Khám bệnh, chữa bệnh số 15/2023/QH15 (hiệu lực từ 01/01/2024)<br>• Nghị định 96/2023/NĐ-CP quy định chi tiết một số điều của Luật Khám bệnh, chữa bệnh<br>• Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân (Dữ liệu sức khỏe nhạy cảm) |

---

## Mục lục
1. [Quy ước Phạm vi & Mức độ Ưu tiên](#1-quy-ước-phạm-vi--mức-độ-ưu-tiên)
2. [Các Tác nhân Hệ thống & Bề mặt Ứng dụng](#2-các-tác-nhân-hệ-thống--bề-mặt-ứng-dụng)
3. [Mô hình Trạng thái Đặt lịch 3 Trục Độc lập](#3-mô-hình-trạng-thái-đặt-lịch-3-trục-độc-lập)
4. [Danh mục Dịch vụ & Phân hạng Điều dưỡng](#4-danh-mục-dịch-vụ--phân-hạng-điều-dưỡng)
5. [PHẦN 1: YÊU CẦU CHỨC NĂNG (FR)](#phần-1-yêu-cầu-chức-năng-fr)
   - [FR-AUTH & FR-PRIV: Định danh, eKYC & Quyền riêng tư](#fr-auth--fr-priv-định-danh-ekyc--quyền-riêng-tư)
   - [FR-SCHED & FR-SEARCH: Lịch rảnh & Tìm kiếm Điều dưỡng](#fr-sched--fr-search-lịch-rảnh--tìm-kiếm-điều-dưỡng)
   - [FR-BOOK: Đặt lịch, Kiểm soát Y lệnh & Điều phối Ca trực](#fr-book-đặt-lịch-kiểm-soát-y-lệnh--điều-phối-ca-trực)
   - [FR-SHIFT: Thực thi Ca, Chống Gian lận & Cấp cứu SOS](#fr-shift-thực-thi-ca-chống-gian-lận--cấp-cứu-sos)
   - [FR-PAY: Thanh toán, Ví Ký quỹ Mô phỏng, Tiền cọc & Rút tiền](#fr-pay-thanh-toán-ví-ký-quỹ-mô-phỏng-tiền-cọc--rút-tiền)
   - [FR-DISP, FR-RATE, FR-NOTIF & FR-CHAT: Vận hành & Giao tiếp](#fr-disp-fr-rate-fr-notif--fr-chat-vận-hành--giao-tiếp)
   - [FR-ADMIN: Quản trị Nền tảng & Đối soát](#fr-admin-quản-trị-nền-tảng--đối-soát)
   - [Phụ lục A: Danh mục Tham số Cấu hình Hệ thống (`system_configs`)](#phụ-lục-a-danh-mục-tham-số-cấu-hình-hệ-thống-system_configs)
   - [Phụ lục B: Ma trận Chính sách SLA Hủy lịch, Quá hạn & Bồi thường](#phụ-lục-b-ma-trận-chính-sách-sla-hủy-lịch-quá-hạn--bồi-thường)
6. [PHẦN 2: YÊU CẦU PHI CHỨC NĂNG (NFR)](#phần-2-yêu-cầu-phi-chức-năng-nfr)
   - [NFR-UI: Chuẩn Giao diện Thân thiện Người cao tuổi](#nfr-ui-chuẩn-giao-diện-thân-thiện-người-cao-tuổi)
   - [NFR-COMP: Tương thích Đa nền tảng & Thiết bị Đời cũ](#nfr-comp-tương-thích-đa-nền-tảng--thiết-bị-đời-cũ)
   - [NFR-AVAIL: Tính Sẵn sàng, Sao lưu & Khôi phục Thảm họa](#nfr-avail-tính-sẵn-sàng-sao-lưu--khôi-phục-thảm-họa)
   - [NFR-SEC: An toàn, Chống Gian lận & Toàn vẹn Tài chính](#nfr-sec-an-toàn-chống-gian-lận--toàn-vẹn-tài-chính)
   - [NFR-PERF: Các Chỉ tiêu Hiệu năng Định lượng](#nfr-perf-các-chỉ-tiêu-hiệu-năng-định-lượng)
   - [NFR-PRIV: Quyền Riêng tư & Tuân thủ Pháp lý](#nfr-priv-quyền-riêng-tư--tuân-thủ-pháp-lý)
   - [Danh mục Hạng mục Mở (Chờ Quyết định)](#danh-mục-hạng-mục-mở-chờ-quyết-định)

---

## 1. Quy ước Phạm vi & Mức độ Ưu tiên

### Mức độ Ưu tiên (SRS v2.0 §1.2, §4.0)
* **`Bắt buộc (MVP)`**: Tính năng cốt lõi không thể thiếu; nền tảng không thể vận hành thương mại hoặc hợp pháp nếu thiếu các tính năng này.
* **`MVP`**: Nằm trong phạm vi phát hành Giai đoạn 1 (Phase 1 MVP).
* **`Phase 2`**: Hoãn lại để triển khai trong đợt mở rộng Giai đoạn 2 (hợp đồng dài hạn, phân xử quyết toán một phần, App Bệnh nhân giao diện người cao tuổi).

### Ranh giới Phạm vi Triển khai
* **Phạm vi MVP (Giai đoạn 1):**
  * Đặt lịch theo đầu việc (task-based) và ca ngắn hạn (4h, 8h, 12h, 24h).
  * Hai bề mặt cho điều dưỡng: Web Portal Điều dưỡng **và** Mobile App Điều dưỡng.
  * Hai cơ chế ghép nối ca: Bắn Radar Điều phối (Radar Dispatch - ca gấp) và Bảng tin Việc làm (Job Board - ca báo trước).
  * Hai phương thức thanh toán: Chuyển khoản trả trước do nền tảng tạm giữ (Ký quỹ mô phỏng - Simulated Escrow) và Tiền mặt tại chỗ (Điều dưỡng tự nộp 15% hoa hồng cho hệ thống).
  * Tiền cọc điều dưỡng 300.000 VNĐ nộp trước (chỉ dùng duy nhất cho việc khấu trừ phạt vi phạm SLA).
  * Tự động giáng hạng / thăng hạng Hạng điều dưỡng dựa trên thời hạn Giấy phép hành nghề (GPHN).
  * Check-in xác thực kép (Chống giả mạo GPS + Chụp ảnh selfie trực tiếp từ camera ứng dụng).
  * Nhật ký ca lâm sàng thời gian thực và quy trình khẩn cấp SOS 115.
  * Đánh giá ẩn hai chiều và quy trình xử lý khiếu nại.
* **Phạm vi Giai đoạn 2 (Phase 2):**
  * Hợp đồng dài hạn theo tuần/tháng (đấu thầu nhận ca, ca thử việc, thay thế điều dưỡng giữa kỳ).
  * Phân xử quyết toán thanh toán một phần (`PARTIALLY_SETTLED`).
  * Mở rộng giao diện người cao tuổi (Elder-Friendly UI) sang App Mobile Bệnh nhân.

---

## 2. Các Tác nhân Hệ thống & Bề mặt Ứng dụng

```
+--------------------------------------------------------------------------------+
|                              TÁC NHÂN HỆ THỐNG                                 |
+----------------------+--------------------------+------------------------------+
| Bệnh nhân / Gia đình | Điều dưỡng Hạng 1 & 2    | Quản trị Y tế / Vận hành     |
| (Khách hàng)         | (Nhân sự chuyên môn)     | (Admin Nền tảng)             |
| - Web Bệnh nhân      | - Web Portal Điều dưỡng  | - Web Portal Quản trị        |
| - App Bệnh nhân      | - App Mobile Điều dưỡng  | (Bắt buộc xác thực 2FA)      |
+----------------------+--------------------------+------------------------------+
```

| Tác nhân | Bề mặt Ứng dụng | Trách nhiệm & Quyền hạn Cốt lõi |
|---|---|---|
| **Bệnh nhân / Gia đình**<br>*(Khách hàng)* | • Web Bệnh nhân<br>• App Mobile Bệnh nhân | • Xác thực tài khoản qua Số điện thoại + OTP SMS.<br>• Định danh eKYC CCCD (bắt buộc đối với dịch vụ chăm sóc tại nhà riêng).<br>• Khai báo hồ sơ bệnh nhân; xác nhận đồng thuận xử lý dữ liệu y tế nhạy cảm (Nghị định 13).<br>• Tìm kiếm điều dưỡng, đặt lịch hẹn, tải ảnh đơn thuốc/y lệnh.<br>• Thanh toán qua Cổng thanh toán Sandbox hoặc Tiền mặt tại chỗ.<br>• Giám sát ca chăm sóc, xác nhận hoàn tất, gửi khiếu nại và đánh giá. |
| **Điều dưỡng Hạng 1**<br>*(TIER_1_BASIC)* | • Web Portal Điều dưỡng<br>• App Mobile Điều dưỡng | • Đối tượng: Sinh viên tốt nghiệp y tế/điều dưỡng hoặc nhân sự chưa có GPHN hiệu lực.<br>• Phạm vi: **Chỉ phục vụ các dịch vụ không xâm lấn** (`is_invasive = false`).<br>• Đăng ký eKYC CCCD, bằng cấp chuyên môn; khai báo lịch rảnh hàng tuần.<br>• Nhận việc qua Bảng tin Việc làm; thực hiện check-in và ghi chép nhật ký ca trên Mobile App.<br>• Duy trì số dư ký quỹ 300.000 VNĐ; tự nộp 15% hoa hồng đối với ca tiền mặt; rút tiền thu nhập. |
| **Điều dưỡng Hạng 2**<br>*(TIER_2_SPECIALIST)* | • Web Portal Điều dưỡng<br>• App Mobile Điều dưỡng<br>*(Giao diện Người cao tuổi)* | • Đối tượng: Bác sĩ, điều dưỡng có GPHN còn hiệu lực (bao gồm cán bộ y tế đã nghỉ hưu).<br>• Phạm vi: **Được thực hiện cả thủ thuật xâm lấn có điều kiện và không xâm lấn** theo y lệnh.<br>• Tải ảnh GPHN; tự động phục hồi hạng chuyên môn khi được duyệt gia hạn GPHN.<br>• Kiểm tra y lệnh bác sĩ trước khi nhận ca; đối chiếu y lệnh gốc tại nhà; quyền từ chối ca không phạt nếu y lệnh sai.<br>• Được hỗ trợ chế độ màn hình chữ lớn, độ tương phản cao trên Web và App. |
| **Quản trị Y tế / Vận hành**<br>*(Admin Hệ thống)* | • Web Portal Quản trị<br>*(Bắt buộc 2FA)* | • Duyệt hồ sơ eKYC, xác thực GPHN và phân bổ/chuyển đổi Hạng điều dưỡng.<br>• Quản lý danh mục dịch vụ, giá trần/giá sàn và tham số `system_configs`.<br>• Tiếp nhận, điều tra và phân xử các vụ khiếu nại ca trực; tra soát audit log.<br>• Đối soát dòng tiền ký quỹ, hoa hồng 15%, phạt vi phạm và phê duyệt yêu cầu rút tiền. |

---

## 3. Mô hình Trạng thái Đặt lịch 3 Trục Độc lập

Mỗi đơn đặt lịch được kiểm soát bởi **ba trục trạng thái trực giao độc lập**. Hệ thống tuyệt đối không gộp chung trạng thái thực thi, thanh toán và khiếu nại vào một cột đơn lẻ.

```
       [Trục Thực thi]                     [Trục Thanh toán]                  [Trục Khiếu nại]
            DRAFT                               UNPAID                              NONE
              |                                   |                                   |
              v                                   v                                   v
          MATCHING                        ESCROW_HELD (Chuyển khoản)                OPEN
              |                                   |                                   |
              v                                   v                                   v
          CONFIRMED                            SETTLED                          UNDER_REVIEW
              |                                   |                                   |
              v                                   v                                   v
         IN_PROGRESS                       PARTIALLY_SETTLED                    RESOLVED_...
              |                            (Chỉ ở Phase 2)
              v
          COMPLETED
   (Nhánh dừng: CANCELLED, EXPIRED)
```

| Trục Trạng thái | Cột Dữ liệu Database | Các Giá trị Hợp lệ | Ý nghĩa & Quy tắc Chuyển trạng thái |
|---|---|---|---|
| **Thực thi** | `bookings.execution_status` | `DRAFT`<br>`MATCHING`<br>`CONFIRMED`<br>`IN_PROGRESS`<br>`COMPLETED`<br>`CANCELLED`<br>`EXPIRED` | • `DRAFT`: Đơn nháp được giữ chỗ 15 phút để chờ thanh toán; quá hạn chuyển sang `EXPIRED`.<br>• `MATCHING`: Đang phát tín hiệu điều phối (Radar) hoặc hiển thị trên Bảng tin.<br>• `CONFIRMED`: Đã có điều dưỡng hợp lệ tiếp nhận ca.<br>• `IN_PROGRESS`: Điều dưỡng đã hoàn tất check-in xác thực kép tại điểm hẹn.<br>• `COMPLETED`: Điều dưỡng đã thực hiện check-out và nộp báo cáo ca chăm sóc.<br>• `EXPIRED`: Hết hạn tìm điều dưỡng trước giờ bắt đầu 30 phút (kích hoạt hoàn tiền 100%). |
| **Thanh toán** | `bookings.payment_status` | `UNPAID`<br>`ESCROW_HELD`<br>`SETTLED`<br>`REFUNDED`<br>`PARTIALLY_SETTLED` | • `UNPAID`: Khởi tạo mặc định. Đơn tiền mặt duy trì `UNPAID` sau khi hoàn thành cho đến khi điều dưỡng tự nộp 15% hoa hồng.<br>• `ESCROW_HELD`: Đơn chuyển khoản sau khi nhận được webhook xác nhận thanh toán.<br>• `SETTLED`: Đã giải ngân 85% cho điều dưỡng (chuyển khoản) HOẶC điều dưỡng đã hoàn tất nộp 15% hoa hồng (tiền mặt).<br>• `REFUNDED`: Đã hoàn lại 100% hoặc một phần cho khách hàng qua cổng.<br>• `PARTIALLY_SETTLED`: Chỉ dùng ở Phase 2 — quyết toán chia tỷ lệ khi phân xử khiếu nại. |
| **Khiếu nại** | `bookings.dispute_status` | `NONE`<br>`OPEN`<br>`UNDER_REVIEW`<br>`RESOLVED_CUSTOMER`<br>`RESOLVED_NURSE`<br>`RESOLVED_PARTIAL` | • `NONE`: Hoạt động bình thường.<br>• `OPEN`: Khiếu nại được tạo bởi khách hàng hoặc điều dưỡng (trong ca hoặc trong 24h sau check-out). Lệnh giải ngân tự động bị đóng băng ngay lập tức.<br>• `UNDER_REVIEW`: Admin tiếp nhận hồ sơ và bắt đầu tra soát chứng cứ.<br>• `RESOLVED_*`: Phán quyết cuối cùng của Admin. |

> **Thẩm quyền Duyệt Nhận Việc:** `nurse_profiles.profile_status` (`PENDING_VERIFICATION | ACTIVE | SUSPENDED | BANNED`) là nguồn dữ liệu chân lý duy nhất xác định điều dưỡng có đủ điều kiện nhận việc hay không.

---

## 4. Danh mục Dịch vụ & Phân hạng Điều dưỡng

Các dịch vụ được phân loại chặt chẽ thành ba nhóm chuyên môn căn cứ theo Luật Khám bệnh, chữa bệnh 15/2023/QH15 và Nghị định 96/2023/NĐ-CP:

| Nhóm Dịch vụ | Cờ Xâm lấn & Yêu cầu Hạng | Quy trình & Danh mục Chuyên môn Cho phép | Quy tắc Kiểm soát trên Nền tảng |
|---|---|---|---|
| **Nhóm 1: Chăm sóc Cơ bản & Hỗ trợ Sinh hoạt** | • `is_invasive = false`<br>• **Hạng 1 (Cơ bản)** & **Hạng 2 (Chuyên môn)** | • Chăm sóc theo ca (4h, 8h, 12h, 24h) tại nhà hoặc bệnh viện.<br>• Vệ sinh cá nhân, tắm tại giường, thay bỉm/tã, lăn trở chống loét tì đè.<br>• Hỗ trợ ăn qua đường miệng, nhắc uống thuốc theo đơn sẵn có.<br>• Theo dõi dấu hiệu sinh tồn không xâm lấn (huyết áp điện tử, SpO2, mạch, nhiệt độ).<br>• Hỗ trợ vận động, tập đi nhẹ nhàng, trò chuyện bầu bạn với người già. | Cho phép toàn bộ điều dưỡng có trạng thái `ACTIVE` tiếp nhận. Không bắt buộc tải ảnh đơn thuốc. |
| **Nhóm 2: Thủ thuật Điều dưỡng Xâm lấn Có điều kiện** | • `is_invasive = true`<br>• **Chỉ Hạng 2 (Chuyên môn)**<br>• Bắt buộc GPHN còn hiệu lực<br>• Bắt buộc có y lệnh/đơn thuốc bác sĩ | • Tiêm dưới da, tiêm bắp (insulin, thuốc duy trì đã được kê đơn và đã tiêm mũi đầu an toàn tại cơ sở y tế).<br>• Truyền dịch duy trì (muối, Ringer, Glucose) tuyệt đối tuân thủ y lệnh.<br>• Thay băng, chăm sóc vết thương hở phức tạp, vết mổ, cắt chỉ.<br>• Chăm sóc/thay ống thông tiểu; cho ăn qua ống thông dạ dày đặt sẵn.<br>• Hút đờm dãi đường hô hấp trên bằng máy hút cá nhân. | Bắt buộc khách hàng tải ảnh y lệnh/đơn thuốc bác sĩ (thời hạn $\le$ 7 ngày). Điều dưỡng Hạng 1 bị chặn ở mức database (`403 Forbidden`). |
| **Nhóm 3: Danh mục Nghiêm cấm Thực hiện** | • `is_prohibited = true`<br>• **Bị Chặn Tuyệt đối** | • Truyền máu, huyết tương, chế phẩm máu tại nhà.<br>• Tiêm truyền tĩnh mạch kháng sinh, thuốc cản quang, hóa chất ung thư hoặc thuốc có nguy cơ sốc phản vệ cao chưa qua thử test tại viện.<br>• Phẫu thuật, tiểu phẫu, chích rạch áp xe, khâu vết thương cấp cứu, gây tê/gây mê.<br>• Tự ý kê đơn thuốc mới hoặc tự ý sửa đổi phác đồ điều trị của bác sĩ. | Không đưa vào danh mục chọn. Bộ lọc từ khóa chặn các yêu cầu tự tạo chứa dịch vụ nghiêm cấm. |

---

# PHẦN 1: YÊU CẦU CHỨC NĂNG (FR)

## FR-AUTH & FR-PRIV: Định danh, eKYC & Quyền riêng tư

### Bảng Tổng hợp
| Mã Yêu cầu | Tên Yêu cầu | Bề mặt Thực thi | Mức Ưu tiên |
|---|---|---|---|
| **FR-AUTH-01** | Đăng ký eKYC Điều dưỡng & Cập nhật Hồ sơ GPHN | Web Portal / App Mobile Điều dưỡng | Bắt buộc (MVP) |
| **FR-AUTH-02** | Xác minh GPHN & Tự động Chuyển đổi Hạng Chuyên môn | Web Portal Quản trị, Cron Job Hệ thống | Bắt buộc (MVP) |
| **FR-AUTH-03** | Quản lý Hồ sơ Bệnh nhân & eKYC Khách hàng | Web / App Mobile Bệnh nhân | Bắt buộc (MVP) |
| **FR-PRIV-01** | Đồng thuận Dữ liệu Y tế & Vòng đời Truy cập (Nghị định 13) | Toàn bộ các bề mặt | Bắt buộc (MVP) |

### Đặc tả Chi tiết

#### FR-AUTH-01: Đăng ký eKYC Điều dưỡng & Cập nhật Hồ sơ GPHN
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.1
* **Quy trình & Nghiệp vụ:**
  1. Điều dưỡng đăng ký/đăng nhập bằng Số điện thoại + OTP SMS.
  2. Điều dưỡng tải hồ sơ định danh: CCCD 2 mặt và ảnh chân dung chụp trực tiếp.
  3. Điều dưỡng tải hồ sơ chuyên môn:
     * Bằng tốt nghiệp Y/Điều dưỡng (bắt buộc cho mọi ứng viên).
     * Giấy phép hành nghề - GPHN (không bắt buộc với Hạng 1, bắt buộc với Hạng 2): Số GPHN, ngày cấp, ngày hết hạn (`gphn_expiry_date`), nơi cấp, phạm vi hoạt động chuyên môn.
     * Quyết định nghỉ hưu (tùy chọn): Tài liệu chứng minh để gắn huy hiệu "Bác sĩ/Điều dưỡng hưu trí giàu kinh nghiệm".
  4. Trạng thái khởi tạo: `PENDING_VERIFICATION`. Điều dưỡng chưa được xem số điện thoại hay nhận ca cho đến khi Admin phê duyệt.
  5. Đối với điều dưỡng đang hoạt động nộp GPHN gia hạn: Chứng chỉ mới được ghi nhận ở trạng thái `PENDING` và không làm gián đoạn quyền nhận ca chăm sóc cơ bản (Hạng 1) hiện tại.

#### FR-AUTH-02: Xác minh GPHN & Tự động Chuyển đổi Hạng Chuyên môn
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.1, §2.3
* **Quy trình & Nghiệp vụ:**
  1. **Admin Thẩm định:** Quản trị viên đối chiếu hồ sơ trên Web Admin; hệ thống lưu vết `reviewed_by = admin.id` kèm dấu thời gian:
     * Có bằng hợp lệ nhưng không có GPHN $\rightarrow$ Phê duyệt `TIER_1_BASIC`.
     * Có GPHN hợp lệ còn hạn $\rightarrow$ Phê duyệt `TIER_2_SPECIALIST`.
     * Quyết định nghỉ hưu chỉ có giá trị cấp huy hiệu nhận diện, tuyệt đối không thay thế được GPHN để mở khóa làm thủ thuật xâm lấn.
  2. **Tự động Giáng hạng khi hết hạn:** Cron job chạy quét hàng ngày trường `gphn_expiry_date`. Khi GPHN hết hạn:
     * Tự động giáng hạng điều dưỡng từ `TIER_2_SPECIALIST` xuống `TIER_1_BASIC`.
     * Trạng thái hồ sơ giữ nguyên `ACTIVE` để tiếp tục nhận ca không xâm lấn.
     * Các ca xâm lấn đã ở trạng thái `CONFIRMED` có lịch diễn ra sau ngày hết hạn sẽ bị hệ thống tự động hủy không phạt và chuyển sang điều phối lại cho điều dưỡng Hạng 2 khác.
  3. **Tự động Thăng hạng lại:** Ngay khi điều dưỡng tải GPHN mới và được Admin phê duyệt, hệ thống tự động thăng hạng trở lại `TIER_2_SPECIALIST`.

#### FR-AUTH-03: Quản lý Hồ sơ Bệnh nhân & eKYC Khách hàng
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.1
* **Quy trình & Nghiệp vụ:**
  1. Khách hàng tạo hồ sơ người bệnh: Họ tên, năm sinh, cân nặng (kg), tình trạng vận động (`WALKING` - đi lại được, `LIMITED` - yếu, `BEDRIDDEN` - nằm liệt giường), tiền sử bệnh, bệnh truyền nhiễm và tọa độ địa chỉ.
  2. **Quy định eKYC theo địa điểm chăm sóc:**
     * **Tại Bệnh viện:** Khách hàng chỉ cần xác thực qua Số điện thoại + OTP SMS.
     * **Tại Nhà riêng (Chăm sóc tại nhà):** Tài khoản khách hàng bắt buộc phải hoàn tất eKYC CCCD (ảnh 2 mặt CCCD + ảnh selfie) trước khi được phép bấm tạo lịch, nhằm đảm bảo an toàn tối đa cho điều dưỡng khi đến nhà riêng.

#### FR-PRIV-01: Đồng thuận Dữ liệu Y tế & Vòng đời Truy cập (Nghị định 13/2023/NĐ-CP)
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.1, §6
* **Quy trình & Nghiệp vụ:**
  1. **Đồng thuận rõ ràng:** Bệnh nhân hoặc người giám hộ hợp pháp phải tích chọn cam kết đồng thuận cho phép xử lý dữ liệu y tế nhạy cảm trước khi lưu hồ sơ đặt lịch; hệ thống ghi nhận `consent_timestamp`, địa chỉ IP và mã nhận dạng thiết bị.
  2. **Kiểm soát truy cập theo ca:** Chỉ duy nhất điều dưỡng đang nhận ca ở trạng thái `CONFIRMED` hoặc `IN_PROGRESS` của đúng đơn đặt lịch đó mới có quyền xem thông tin bệnh nhân và ảnh chụp đơn thuốc.
  3. **Tự động Thu hồi Quyền sau 12 Giờ:** Quyền truy cập hồ sơ bệnh nhân của điều dưỡng **tự động đóng lại chính xác sau 12 giờ kể từ thời điểm check-out** (`checkout_time`). Trong thời gian 24 giờ giải quyết khiếu nại còn lại, chứng cứ được trích xuất từ nhật ký hệ thống; Admin chỉ được cấp quyền xem lại khi có sự kiện mở khiếu nại và được ghi nhận đầy đủ vào audit log.
  4. **Lưu trữ & Quyền xóa dữ liệu:** Hồ sơ bệnh án được lưu trữ tối đa 24 tháng cho mục đích tra cứu và pháp lý; cung cấp tính năng tiếp nhận "Yêu cầu xóa / ẩn danh hóa dữ liệu cá nhân" theo đúng Nghị định 13/2023/NĐ-CP.

---

## FR-SCHED & FR-SEARCH: Lịch rảnh & Tìm kiếm Điều dưỡng

### Bảng Tổng hợp
| Mã Yêu cầu | Tên Yêu cầu | Bề mặt Thực thi | Mức Ưu tiên |
|---|---|---|---|
| **FR-SCHED-01** | Khai báo Lịch rảnh & Quản lý Nghỉ phép | Web Portal / App Mobile Điều dưỡng | Bắt buộc (MVP) |
| **FR-SEARCH-01** | Tìm kiếm & Xem Hồ sơ Điều dưỡng | Web / App Mobile Bệnh nhân | MVP |

### Đặc tả Chi tiết

#### FR-SCHED-01: Khai báo Lịch rảnh & Quản lý Nghỉ phép
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.2
* **Quy trình & Nghiệp vụ:**
  1. Điều dưỡng thiết lập các khung giờ rảnh cố định lặp lại theo tuần (ví dụ: Thứ 2/4/6 từ 08:00–16:00) và đăng ký các khoảng thời gian bận đột xuất vào bảng `nurse_availabilities`.
  2. **Bộ đệm Di chuyển 60 Phút:** Công cụ Điều phối (Matching Engine) tính toán lịch rảnh thực tế bằng cách đối chiếu lịch rảnh đã đăng ký với các ca đã `CONFIRMED` hoặc `IN_PROGRESS`, tự động cộng thêm **60 phút đệm di chuyển** giữa hai ca làm việc liên tiếp. Ca làm việc không bao giờ được phân bổ cho điều dưỡng nếu vi phạm khoảng đệm 60 phút này.

#### FR-SEARCH-01: Tìm kiếm & Xem Hồ sơ Điều dưỡng
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.2
* **Quy trình & Nghiệp vụ:**
  1. Bộ lọc tìm kiếm: Loại dịch vụ, vị trí địa lý / bán kính khoảng cách, khung thời gian cần phục vụ, hạng điều dưỡng (Hạng 1 / Hạng 2) và giới tính.
  2. Thẻ hồ sơ điều dưỡng hiển thị: Họ tên, ảnh đại diện, hạng chuyên môn, số năm kinh nghiệm, huy hiệu bác sĩ/điều dưỡng nghỉ hưu, điểm đánh giá trung bình (`rating_avg`) và nhận xét thực tế từ các ca đã hoàn tất.
  3. Khách hàng có thể gửi yêu cầu đặt đích danh một điều dưỡng hoặc đưa lên sàn chung.

---

## FR-BOOK: Đặt lịch, Kiểm soát Y lệnh & Điều phối Ca trực

### Bảng Tổng hợp
| Mã Yêu cầu | Tên Yêu cầu | Bề mặt Thực thi | Mức Ưu tiên |
|---|---|---|---|
| **FR-BOOK-01** | Đặt lịch Ca / Đầu việc & Động cơ Tính giá Tham số hóa | Web / App Mobile Bệnh nhân | Bắt buộc (MVP) |
| **FR-BOOK-02** | Quy trình Kiểm soát Y lệnh Bác sĩ 3 Lớp | Toàn bộ bề mặt | Bắt buộc (MVP) |
| **FR-BOOK-03** | Động cơ Ghép nối Ca Kép (Bắn Radar & Bảng tin Việc làm) | Backend / Toàn bộ bề mặt | MVP |
| **FR-BOOK-04** | Đấu thầu Hợp đồng Dài hạn & Ca Thử việc | Bệnh nhân & Điều dưỡng | Phase 2 |
| **FR-BOOK-05** | Quản lý Vòng đời Hợp đồng Dài hạn | Toàn bộ bề mặt | Phase 2 |

### Đặc tả Chi tiết

#### FR-BOOK-01: Đặt lịch Ca / Đầu việc & Động cơ Tính giá Tham số hóa
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.3, §5.1
* **Công thức Tính giá:** Giá dịch vụ được tính toán hoàn toàn tự động từ bảng cấu hình `system_configs`:
  $$\text{Tổng tiền} = \text{Giá gốc} + \text{Phụ phí đêm} + \text{Phụ phí ngày Lễ} + \text{Phụ phí bệnh nhân nặng}$$
  * *Phụ phí ca đêm:* Cộng thêm 20% (`SURCHARGE_NIGHT_SHIFT`) tính **chính xác trên số giờ làm việc nằm trong khung 22:00–06:00**.
  * *Phụ phí Lễ/Tết:* Cộng thêm 300% (`SURCHARGE_HOLIDAY_MAJOR`) cho Tết Nguyên Đán; cộng thêm 200% (`SURCHARGE_HOLIDAY_MINOR`) cho các ngày nghỉ lễ luật định khác. Phụ phí tính cộng dồn trên giá gốc.
  * *Phụ phí bệnh nhân nặng:* Cộng thêm 15% (`SURCHARGE_HEAVY_PATIENT`) khi `weight_kg >= 80` hoặc `mobility_status = 'BEDRIDDEN'`.
* **Ví dụ Điển hình (trích xuất từ SRS):**
  * Ca làm từ 20:00 đến 06:00 sáng hôm sau (10 tiếng) ngày thường, đơn giá 50.000 VNĐ/giờ $\rightarrow$ Giá gốc = 500.000 VNĐ.
  * Giờ đêm (22:00–06:00) = 8 tiếng $\rightarrow$ Phụ phí đêm = $8 \times 50.000 \times 20\% = 80.000\text{ VNĐ}$.
  * Tổng giá trị đơn đặt = 580.000 VNĐ.
* **Vòng đời sau khởi tạo:** Đơn khởi tạo có `execution_status = DRAFT`, `payment_status = UNPAID`. Đơn được giữ chỗ trong 15 phút (`PAYMENT_TIMEOUT_MINUTES`), quá thời gian này sẽ tự động chuyển thành `EXPIRED`. Khách hàng bắt buộc phải lựa chọn phương thức thanh toán (`BANK_TRANSFER` hoặc `CASH`) ngay từ bước này.

#### FR-BOOK-02: Quy trình Kiểm soát Y lệnh Bác sĩ 3 Lớp
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.3
* **Cơ chế 3 Lớp Kiểm soát:**
  1. **Lớp 1 (Lúc tạo đơn - Khách hàng):** Khi chọn dịch vụ có `is_invasive = true`, bắt buộc phải chụp ảnh đơn thuốc / phiếu y lệnh của bác sĩ (ngày kê $\le$ 7 ngày, rõ họ tên bệnh nhân, tên thuốc, liều dùng, chữ ký/con dấu cơ sở y tế).
  2. **Lớp 2 (Trước khi nhận ca - Điều dưỡng Hạng 2):** Điều dưỡng phải xem ảnh chụp đơn thuốc đính kèm trực tiếp trong app trước khi bấm nút "Nhận ca".
  3. **Lớp 3 (Tại chỗ - Check-in):** Khi đến nơi, điều dưỡng đối chiếu đơn giấy gốc và thuốc thực tế. Nếu phát hiện đơn giả mạo, hết hạn, bị sửa chữa hoặc sai lệch thuốc:
     * Điều dưỡng bấm "Từ chối thực hiện ca — Y lệnh không hợp lệ" kèm ảnh chụp bằng chứng.
     * Ca trực bị hủy ngay lập tức, điều dưỡng **không bị phạt** và được nhận 50.000 VNĐ hỗ trợ xăng xe từ quỹ vận hành của hệ thống.

#### FR-BOOK-03: Động cơ Ghép nối Ca Kép (Bắn Radar & Bảng tin Việc làm)
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.3

```
                                  ĐIỀU HƯỚNG GHÉP NỐI CA TRỰC
                                               |
                  +----------------------------+----------------------------+
                  |                                                         |
         Thời gian báo trước <= 6 Giờ                               Thời gian báo trước > 6 Giờ
                  |                                                         |
                  v                                                         v
         [BẮN RADAR ĐIỀU PHỐI]                                     [BẢNG TIN VIỆC LÀM]
       • Phút 0-5:   Bán kính 5 km                               • Mở trên Bảng tin cho điều
       • Phút 5-15:  Bán kính 10 km                                dưỡng hợp lệ trong quận/huyện.
       • Ai bấm nhận trước được việc.                            • Đặt đích danh: Điều dưỡng có 15 phút.
```

* **Cơ chế A: Bắn Radar Điều phối (Ca gấp / Thời gian báo trước $\le$ 6 giờ):**
  * *Vòng 1 (Phút 0–5):* Bắn thông báo đẩy đến các điều dưỡng đạt chuẩn chuyên môn, đang rảnh trong **bán kính 5 km**.
  * *Vòng 2 (Phút 5–15):* Nếu chưa có ai nhận, tự động mở rộng bán kính lên **10 km**.
  * Kiểm soát đồng thời: Sử dụng khóa phân tán Redis Distributed Lock / `SELECT FOR UPDATE` đảm bảo người đầu tiên bấm nhận sẽ được phân công ca, không bị trùng lặp.
* **Cơ chế B: Bảng tin Việc làm (Ca đặt trước > 6 giờ):**
  * Đăng công khai trên tab "Bảng việc làm" của các điều dưỡng phù hợp.
  * Nếu khách hàng đặt đích danh một điều dưỡng qua FR-SEARCH-01, điều dưỡng đó có 15 phút phản hồi trước khi đơn được phát lên sàn chung.
* **Điều kiện Tiên quyết:** Điều dưỡng bắt buộc phải có số dư tiền cọc `deposit_balance >= 300.000 VNĐ` mới được nhận tín hiệu điều phối hoặc bấm nhận việc.
* **Hết hạn Ghép nối:** Nếu trước giờ bắt đầu ca 30 phút (hoặc sau 30 phút đối với ca gấp) mà vẫn chưa có điều dưỡng nhận, đơn chuyển sang `EXPIRED` và hoàn lại 100% tiền trả trước (`payment_status = REFUNDED`).

#### FR-BOOK-04 & FR-BOOK-05: Hợp đồng Chăm sóc Dài hạn (Phase 2)
* **FR-BOOK-04 (Đấu thầu & Ca thử việc):** Đăng nhu cầu chăm sóc định kỳ hàng tuần/tháng $\rightarrow$ điều dưỡng nộp báo giá $\rightarrow$ gia đình đặt 1 ca thử việc (4h/8h) trước khi phê duyệt hợp đồng chính thức.
* **FR-BOOK-05 (Vòng đời Hợp đồng):** Tạm dừng hợp đồng (khi bệnh nhân nhập viện cấp cứu), thay thế điều dưỡng giữa kỳ (quyết toán các ca đã làm cho điều dưỡng cũ và phân bổ điều dưỡng mới), chấm dứt sớm theo chính sách SLA.

---

## FR-SHIFT: Thực thi Ca, Chống Gian lận & Cấp cứu SOS

### Bảng Tổng hợp
| Mã Yêu cầu | Tên Yêu cầu | Bề mặt Thực thi | Mức Ưu tiên |
|---|---|---|---|
| **FR-SHIFT-01** | Check-in Xác thực Kép Chống gian lận (GPS & Selfie) | App Mobile Điều dưỡng | MVP |
| **FR-SHIFT-02** | Nhật ký Ca Lâm sàng Thời gian thực & Báo cáo Lệch tình trạng | App Mobile Điều dưỡng | Bắt buộc (MVP) |
| **FR-SHIFT-03** | Gia hạn Ca trong khi Đang thực hiện (Tăng ca) | Bệnh nhân & Điều dưỡng | MVP |
| **FR-SHIFT-04** | Check-out & Nộp Báo cáo Tổng kết Ca | App Mobile Điều dưỡng | Bắt buộc (MVP) |
| **FR-SHIFT-05** | Quy trình Xử lý Khẩn cấp Y tế (SOS) | App Điều dưỡng & Admin | Bắt buộc (MVP) |

### Đặc tả Chi tiết

#### FR-SHIFT-01: Check-in Xác thực Kép Chống gian lận (GPS & Selfie)
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.4
* **Quy trình Kiểm soát:**
  1. **Chặn Giả mạo Tọa độ:** Ứng dụng đọc cờ từ hệ điều hành (`isFromMockProvider` trên Android / `isSimulatedBySoftware` trên iOS); nếu phát hiện gian lận vị trí, lập tức từ chối check-in và ghi log cảnh báo an ninh.
  2. **Bán kính Cho phép:** Tọa độ GPS thực tế của điều dưỡng phải cách tọa độ điểm hẹn $\le$ **200 mét** (`CHECKIN_MAX_RADIUS_METERS`) tính theo công thức Haversine.
  3. **Chụp ảnh Khuôn mặt Trực tiếp:** Chụp ảnh chân dung selfie trực tiếp qua camera của ứng dụng (chặn hoàn toàn việc chọn ảnh từ thư viện thiết bị). Ảnh được gắn watermark dấu thời gian UTC và tọa độ GPS, đồng thời gửi thông báo kèm ảnh đến app của khách hàng.
  4. Sau khi hoàn tất kiểm tra, `execution_status` chuyển thành `IN_PROGRESS`.

#### FR-SHIFT-02: Nhật ký Ca Lâm sàng Thời gian thực & Báo cáo Lệch tình trạng
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.4
* **Quy trình & Nghiệp vụ:**
  1. **Báo cáo Lệch Tình trạng (30 Phút đầu ca):** Nếu tình trạng bệnh nhân thực tế khác biệt nghiêm trọng so với khai báo (nằm liệt giường không báo trước, mắc bệnh truyền nhiễm giấu kín, môi trường nguy hiểm), điều dưỡng có quyền yêu cầu cập nhật phụ phí hoặc từ chối thực hiện tiếp ca trực mà không bị xử phạt.
  2. **Nhật ký Chăm sóc Liên tục:** Trong suốt ca trực, điều dưỡng ghi nhận các chỉ số sinh tồn (Mạch, Nhiệt độ, Huyết áp, SpO2) và các đầu việc chăm sóc vào bảng `shift_logs`, đồng bộ hóa thời gian thực qua WebSocket.

#### FR-SHIFT-03: Gia hạn Ca trong khi Đang thực hiện (Tăng ca)
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.4
* **Quy trình & Nghiệp vụ:**
  1. Cho phép yêu cầu gia hạn trước khi kết thúc ca ít nhất 30 phút.
  2. Gia hạn theo bội số của 1 giờ (`POST /api/v1/bookings/:id/extend`).
  3. Chỉ được chấp thuận khi điều dưỡng xác nhận đồng ý và không vướng ca làm việc kế tiếp.
  4. Tiền tăng ca được thanh toán bổ sung qua ký quỹ (nếu là đơn chuyển khoản) hoặc cộng vào tổng tiền thanh toán cuối ca (nếu là đơn tiền mặt).

#### FR-SHIFT-04: Check-out & Nộp Báo cáo Tổng kết Ca
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.4
* **Quy trình & Nghiệp vụ:**
  1. Điều dưỡng cập nhật chỉ số sinh tồn cuối ca, tóm tắt các hoạt động chăm sóc đã thực hiện và ghi chú bàn giao trước khi bấm Check-out (`POST /api/v1/bookings/:id/check-out`).
  2. Hệ thống lưu vết `checkout_time` và chuyển trạng thái `execution_status` $\rightarrow$ `COMPLETED`.
  3. Đối với dịch vụ làm theo đầu việc (task-based), việc hoàn thành toàn bộ các đầu mục việc cho phép hưởng 100% giá dịch vụ ngay cả khi kết thúc sớm hơn giờ dự kiến.
  4. Kích hoạt hai bộ đếm tự động:
     * Bộ đếm **24 giờ giải quyết khiếu nại & đối soát thanh toán** (`SETTLEMENT_COOLING_HOURS = 24`).
     * Bộ đếm **12 giờ tự động khóa quyền truy cập dữ liệu y tế** (FR-PRIV-01).

#### FR-SHIFT-05: Quy trình Xử lý Khẩn cấp Y tế (SOS)
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.4
* **Quy trình 2 Bước Khẩn cấp:**
  1. **Bước 1 (Hành động Tại chỗ - Ưu tiên Tuyệt đối):**
     * Điều dưỡng hoặc người có mặt bấm nút SOS trên app $\rightarrow$ Màn hình lập tức kích hoạt gọi ngay **Cấp cứu 115** và thực hiện sơ cấp cứu trong phạm vi chuyên môn.
  2. **Bước 2 (Hệ thống Phát tín hiệu Cảnh báo):**
     * Đồng thời, hệ thống tự động bắn thông báo đẩy và gửi SMS khẩn cấp (kèm tọa độ GPS và dấu hiệu sinh tồn mới nhất) đến Gia đình bệnh nhân và Web Portal của Ban Quản trị.
     * Hệ thống đóng vai trò thông tin và điều phối hỗ trợ, tuyệt đối không thay thế cuộc gọi cấp cứu y tế 115.

---

## FR-PAY: Thanh toán, Ví Ký quỹ Mô phỏng, Tiền cọc & Rút tiền

### Kiến trúc Tài chính Cốt lõi (SRS §4.5, §2.3)
Nền tảng vận hành mô hình **Sổ cái Ký quỹ Mô phỏng (Simulated Escrow Ledger)** với các số dư tách bạch tuyệt đối:
* `available_balance`: Số dư khả dụng (thù lao đã đối soát xong, có thể rút về ngân hàng).
* `deposit_balance`: Số dư tiền cọc 300.000 VNĐ; **dùng duy nhất cho việc trừ phạt vi phạm SLA**, tuyệt đối **không** dùng để trừ hoa hồng.
* `escrow_balance`: Số dư tiền đang bị tạm khóa chờ hoàn tất ca và hết thời hạn khiếu nại.

```
+------------------------------------------------------------------------------------------------+
|                             QUY TRÌNH HAI PHƯƠNG THỨC THANH TOÁN                               |
+------------------------------------------------------------------------------------------------+
| [CHUYỂN KHOẢN TRẢ TRƯỚC - SIMULATED ESCROW]                                                    |
| Khách trả trước 100% -> Webhook cổng xác thực -> Tiền khóa tại ESCROW_HELD                      |
| Check-out ca -> Hết 24h đối soát -> Hệ thống tự trích 15% hoa hồng nền tảng                     |
| -> 85% còn lại chuyển vào available_balance của Điều dưỡng -> Chuyển SETTLED.                  |
+------------------------------------------------------------------------------------------------+
| [TIỀN MẶT TẠI CHỖ - CASH ON SITE]                                                              |
| Khách trả 100% Tiền mặt cho Điều dưỡng khi kết thúc ca (Nền tảng không giữ tiền khách). Tiền bo |
| không tính hoa hồng. Sau khi check-out -> App hiện mã VietQR thu 15% hoa hồng -> Điều dưỡng tự  |
| chuyển khoản nộp 15% cho nền tảng trong 24h -> Cổng báo nhận đủ -> Chuyển SETTLED.             |
| (Nếu quá 24h chưa nộp hoa hồng -> Khóa tài khoản SUSPENDED).                                   |
+------------------------------------------------------------------------------------------------+
```

### Bảng Tổng hợp
| Mã Yêu cầu | Tên Yêu cầu | Bề mặt Thực thi | Mức Ưu tiên |
|---|---|---|---|
| **FR-PAY-01** | Hai Phương thức Thanh toán (Chuyển khoản Trả trước & Tiền mặt) | Toàn bộ bề mặt | Bắt buộc (MVP) |
| **FR-PAY-02** | Quyết toán Tự động Sau 24h & Điều dưỡng Tự nộp 15% Hoa hồng | Backend / App Điều dưỡng | Bắt buộc (MVP) |
| **FR-PAY-03** | Ví Tiền cọc Điều dưỡng (Cách ly Phạt vi phạm Độc quyền) | App Điều dưỡng / Admin | MVP |
| **FR-PAY-04** | Quản lý Thu nhập & Rút tiền về Tài khoản Ngân hàng | App Điều dưỡng / Admin | MVP |

### Đặc tả Chi tiết

#### FR-PAY-01: Hai Phương thức Thanh toán (Chuyển khoản Trả trước & Tiền mặt)
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.5
* **Phương thức 1: Chuyển khoản (Trả trước giữ qua nền tảng):**
  * Khách hàng thanh toán 100% tiền đơn qua cổng sandbox (PayOS / VNPay / VietQR) trước ca trực.
  * Webhook xác thực chữ ký số HMAC-SHA256, chuyển trạng thái tiền thành `ESCROW_HELD`.
* **Phương thức 2: Tiền mặt (Thanh toán trực tiếp tại chỗ):**
  * Khách hàng đưa 100% tiền mặt trực tiếp cho điều dưỡng sau khi kết thúc ca.
  * Tiền bồi dưỡng (tiền bo) vượt ngoài đơn giá hiển thị trên ứng dụng thuộc trọn vẹn về điều dưỡng và hoàn toàn không bị tính hoa hồng.
  * Nền tảng ghi nhận doanh thu ca trực theo đúng giá trên ứng dụng. Nền tảng không cầm tiền mặt của khách.
  * Phương thức thanh toán (`BANK_TRANSFER` hoặc `CASH`) bắt buộc phải chốt ngay lúc tạo đơn.

#### FR-PAY-02: Quyết toán Tự động Sau 24h & Điều dưỡng Tự nộp 15% Hoa hồng
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.5
* **Khung thời gian Đối soát:** Đúng 24 giờ (`SETTLEMENT_COOLING_HOURS = 24`) tính từ thời điểm `checkout_time`.
* **Đối với đơn Chuyển khoản:**
  * Nếu khách hàng bấm "Xác nhận hoàn thành" sớm hoặc sau 24 giờ không có khiếu nại (`dispute_status = 'NONE'`):
  * Hệ thống tự động trích 15% hoa hồng (`PLATFORM_COMMISSION_RATE = 0.15`).
  * Giải ngân 85% còn lại vào `available_balance` của điều dưỡng (`payment_status` $\rightarrow$ `SETTLED`).
* **Đối với đơn Tiền mặt:**
  * Ngay khi check-out, hệ thống tính 15% hoa hồng trên giá gốc của ca và tạo mã VietQR / Link thanh toán trên app điều dưỡng (`POST /api/v1/bookings/:id/commission-payment-link`).
  * Điều dưỡng phải tự chuyển khoản nộp 15% hoa hồng cho nền tảng trong vòng 24 giờ.
  * Tiền hoa hồng **tuyệt đối không bị trừ vào ví tiền cọc `deposit_balance`**.
  * Khi webhook cổng thanh toán xác nhận đã thu đủ 15%, đơn chuyển sang trạng thái `SETTLED`.
  * Nếu sau 24 giờ điều dưỡng vẫn chưa nộp đủ hoa hồng, tài khoản điều dưỡng sẽ tự động bị chuyển sang trạng thái tạm khóa (`SUSPENDED`) cho đến khi hoàn tất nghĩa vụ nộp tiền.

#### FR-PAY-03: Ví Tiền cọc Điều dưỡng (Cách ly Phạt vi phạm Độc quyền)
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.5, §2.3
* **Quy tắc Quản lý Tiền cọc:**
  1. Điều dưỡng bắt buộc phải nộp đủ hạn mức tiền cọc ban đầu là **300.000 VNĐ** (`MIN_NURSE_DEPOSIT`) vào `deposit_balance` trước khi được phép nhận ca.
  2. **Mục đích Duy nhất:** Dùng độc quyền để khấu trừ tiền phạt vi phạm SLA (hủy ca muộn, bỏ ca, vi phạm quy trình bị xử phạt khi khiếu nại) với loại giao dịch `PENALTY_DEDUCT`.
  3. Tuyệt đối không dùng tiền cọc để trừ tiền hoa hồng ca tiền mặt hay phí vận hành.
  4. Nếu bị phạt khiến `deposit_balance` tụt dưới 300.000 VNĐ, tài khoản tự động bị khóa nhận việc mới (`SUSPENDED`) cho đến khi nộp bù đủ định mức.
  5. Tiền cọc chỉ được hoàn trả 100% khi điều dưỡng yêu cầu đóng tài khoản ngừng hợp tác sau 7 ngày không phát sinh khiếu nại.

#### FR-PAY-04: Quản lý Thu nhập & Rút tiền về Tài khoản Ngân hàng
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.5
* **Quy trình & Nghiệp vụ:**
  1. Điều dưỡng theo dõi biểu đồ thu nhập và lịch sử biến động số dư chi tiết.
  2. Tạo yêu cầu rút tiền (`POST /api/v1/wallets/withdraw`) với số tiền $\le$ `available_balance`.
  3. Hệ thống khóa dòng dữ liệu (`SELECT FOR UPDATE`), trừ số dư khả dụng và tạo bản ghi trạng thái `WITHDRAW_REQUESTED`.
  4. Admin phê duyệt và giải ngân qua cổng chi hộ $\rightarrow$ trạng thái cập nhật thành `WITHDRAWN`.

---

## FR-DISP, FR-RATE, FR-NOTIF & FR-CHAT: Vận hành & Giao tiếp

### Bảng Tổng hợp
| Mã Yêu cầu | Tên Yêu cầu | Bề mặt Thực thi | Mức Ưu tiên |
|---|---|---|---|
| **FR-DISP-01** | Quy trình Tiếp nhận & Phân xử Khiếu nại Ca trực | Toàn bộ bề mặt / Admin | Bắt buộc (MVP) |
| **FR-DISP-02** | Phân xử Quyết toán Một phần | Web Portal Quản trị | Phase 2 |
| **FR-RATE-01** | Đánh giá Ẩn Hai chiều & Điểm Uy tín TrustScore | Bệnh nhân & Điều dưỡng | MVP |
| **FR-NOTIF-01** | Thông báo Đa kênh & Dự phòng SMS Tự động | Toàn bộ bề mặt / Backend | MVP |
| **FR-CHAT-01** | Nhắn tin & Gọi điện Nội bộ Ẩn số Viễn thông | Mobile Bệnh nhân & Điều dưỡng | MVP |

### Đặc tả Chi tiết

#### FR-DISP-01: Quy trình Tiếp nhận & Phân xử Khiếu nại Ca trực
* **Mức ưu tiên:** `Bắt buộc (MVP)` | **Nguồn:** SRS §4.6
* **Mở khiếu nại:** Khách hàng hoặc điều dưỡng có thể gửi khiếu nại từ lúc `IN_PROGRESS` đến tối đa 24 giờ sau check-out. Các lý do: bỏ về sớm, vi phạm kỹ thuật điều dưỡng, thái độ không chuẩn mực, khách khai báo sai tình trạng bệnh. Cho phép đính kèm tối đa 5 ảnh/video bằng chứng.
* **Đóng băng Ký quỹ:** `dispute_status` chuyển thành `OPEN` sẽ lập tức tạm dừng mọi tác vụ giải ngân tự động.
* **Kết quả Phán quyết của Admin:**
  * `RESOLVED_CUSTOMER`: Hoàn 100% tiền cho khách (`REFUNDED`), trừ điểm TrustScore (−25 điểm) và phạt trừ tiền cọc của điều dưỡng. (Đối với đơn tiền mặt, khoản phạt bồi thường cho khách được trích từ ví cọc của điều dưỡng).
  * `RESOLVED_NURSE`: Giải ngân đủ 85% tiền ca trực vào ví của điều dưỡng (`SETTLED`).

#### FR-DISP-02: Phân xử Quyết toán Một phần (Phase 2)
* **Mức ưu tiên:** `Phase 2` | **Nguồn:** SRS §4.6, §2.2
* Áp dụng khi cả hai bên cùng có lỗi hoặc ca trực bị dừng giữa chừng do sự cố khách quan. Admin nhập tỷ lệ phân chia (ví dụ: hoàn 40% cho khách, trả 60% cho điều dưỡng) $\rightarrow$ trạng thái chuyển thành `PARTIALLY_SETTLED`.

#### FR-RATE-01: Đánh giá Ẩn Hai chiều & Điểm Uy tín TrustScore
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.6
* **Cơ chế Đánh giá Ẩn:** Sau khi check-out, hai bên đánh giá chéo 1–5 sao và viết nhận xét. Đánh giá được giữ kín cho đến khi cả hai bên cùng hoàn thành hoặc sau 7 ngày (`reviews.is_visible = true`), triệt tiêu tâm lý đánh giá trả đũa.
* **Điểm Uy tín TrustScore (Thang điểm 0–100, Mặc định 100):**
  * Hủy ca trước > 12 giờ: **−5 điểm**.
  * Hủy ca muộn $\le$ 12 giờ: **−20 điểm**.
  * Vi phạm bị xử thua trong khiếu nại: **−25 điểm**.
  * Điểm cộng: Mỗi ca hoàn tất (`SETTLED`) được đánh giá $\ge$ 4 sao được cộng **+2 điểm** (tối đa 100).
  * Tự động Khóa tài khoản: TrustScore < 60 tự động chuyển hồ sơ sang trạng thái tạm ngưng (`SUSPENDED`).

#### FR-NOTIF-01: Thông báo Đa kênh & Dự phòng SMS Tự động
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.6, §9
* Kênh chính: Push Notification (Firebase Cloud Messaging) + WebSocket + Trung tâm thông báo trong app.
* **Dự phòng SMS:** Nếu FCM gửi lỗi hoặc thông báo khẩn cấp (báo động SOS, ca bị hủy sát giờ trong vòng 2 tiếng, việc khẩn mới) không được thiết bị của điều dưỡng phản hồi xác nhận trong vòng **60 giây**, hệ thống tự động bắn SMS / Zalo ZNS dự phòng.

#### FR-CHAT-01: Nhắn tin & Gọi điện Nội bộ Ẩn số Viễn thông
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.6, §3
* Kênh giao tiếp mở ra khi đơn đạt trạng thái `CONFIRMED`. Số điện thoại thật của hai bên được che giấu hoàn toàn.
* Hệ thống quét tự động nội dung tin nhắn: Nếu phát hiện số điện thoại, link mạng xã hội hoặc mồi chài giao dịch ngoài sàn, hệ thống hiển thị cảnh báo vi phạm và lưu log cho Admin kiểm tra.

---

## FR-ADMIN: Quản trị Nền tảng & Đối soát

#### FR-ADMIN-01: Quản lý Dịch vụ, Cấu hình & Báo cáo Đối soát
* **Mức ưu tiên:** `MVP` | **Nguồn:** SRS §4.6
* **Quản trị Dịch vụ & Cấu hình:** Admin thêm/sửa dịch vụ, bật/tắt cờ `is_invasive` và điều chỉnh các tham số cấu hình trong bảng `system_configs` mà không cần viết lại mã nguồn.
* **Quản lý Tài khoản:** Tìm kiếm, tra soát lịch sử, khóa/mở khóa (`ACTIVE` / `SUSPENDED` / `BANNED`) tài khoản khách hàng và điều dưỡng.
* **Đối soát Tài chính:** Xuất báo cáo tổng tiền ký quỹ nhận vào, tổng hoa hồng nền tảng (15%), tổng tiền giải ngân, tổng tiền bồi hoàn và danh sách các lệnh rút tiền chờ duyệt.

---

## Phụ lục A: Danh mục Tham số Cấu hình Hệ thống (`system_configs`)

Toàn bộ các hằng số về tài chính, thời gian và tỷ lệ phụ phí được lưu trữ tại bảng `system_configs`:

| Khóa Cấu hình | Giá trị | Đơn vị | Nhóm | Ý nghĩa Nghiệp vụ & Tác động |
|---|---|---|---|---|
| `PLATFORM_COMMISSION_RATE` | `0.15` | Tỷ lệ (15%) | Tài chính | Tỷ lệ hoa hồng nền tảng. Chuyển khoản: Trích 15%, trả 85%. Tiền mặt: Điều dưỡng tự nộp 15% cho nền tảng. |
| `MIN_NURSE_DEPOSIT` | `300000` | VNĐ | Tiền cọc | Định mức tiền cọc bắt buộc phải có để được nhận ca. Dùng duy nhất cho việc trừ phạt vi phạm SLA. |
| `SURCHARGE_NIGHT_SHIFT` | `0.20` | Tỷ lệ (+20%) | Phụ phí | Tính trên đơn giá giờ cho các giờ làm việc nằm trong khoảng 22:00–06:00. |
| `SURCHARGE_HOLIDAY_MAJOR` | `3.00` | Tỷ lệ (+300%) | Phụ phí | Phụ phí Tết Nguyên Đán: Phụ phí = 300% $\times$ Giá gốc ca trực. |
| `SURCHARGE_HOLIDAY_MINOR` | `2.00` | Tỷ lệ (+200%) | Phụ phí | Phụ phí các ngày nghỉ lễ luật định: Phụ phí = 200% $\times$ Giá gốc ca trực. |
| `SURCHARGE_HEAVY_PATIENT` | `0.15` | Tỷ lệ (+15%) | Phụ phí | Áp dụng khi người bệnh có `weight_kg >= 80` HOẶC `mobility_status = 'BEDRIDDEN'`. |
| `PAYMENT_TIMEOUT_MINUTES` | `15` | Phút | Giữ chỗ | Thời gian giữ đơn nháp chờ khách trả tiền; quá hạn chuyển thành `EXPIRED`. |
| `SETTLEMENT_COOLING_HOURS` | `24` | Giờ | Đối soát SLA | Thời gian chờ khiếu nại sau check-out trước khi hệ thống tự động giải ngân. |
| `CHECKIN_MAX_RADIUS_METERS` | `200` | Mét | Định vị GPS | Bán kính khoảng cách tối đa cho phép điều dưỡng thực hiện check-in tại điểm hẹn. |
| `ICU_TRAVEL_SUPPORT` | `50000` | VNĐ | Hỗ trợ vận hành | Hỗ trợ xăng xe cho điều dưỡng khi khách hủy vì bệnh nhân phải cấp cứu ICU sau khi điều dưỡng đã xuất phát. |
| `NO_SHOW_PENALTY` | `50000` | VNĐ | Tiền phạt | Phạt điều dưỡng bùng ca không đến; toàn bộ số tiền phạt chuyển thành voucher đền bù cho khách hàng. |

---

## Phụ lục B: Ma trận Chính sách SLA Hủy lịch, Quá hạn & Bồi thường

> **Quy định Áp dụng theo Phương thức Thanh toán:**
> * **Đơn Chuyển khoản:** Tỷ lệ hoàn tiền được tự động hoàn trả về tài khoản của khách hàng qua cổng thanh toán.
> * **Đơn Tiền mặt:** Do khách chưa trả tiền nên không phát sinh hoàn tiền; chế tài phạt điều dưỡng vẫn khấu trừ qua ví cọc `deposit_balance`. Phí phạt hủy ca của khách hàng không thu qua sàn mà được lưu vết cảnh báo vào lịch sử tài khoản.

| STT | Kịch bản Hủy / Quá hạn | Thời điểm Kích hoạt | Chế tài Phạt & Tỷ lệ Hoàn tiền | Hành động Xử lý của Hệ thống |
|---|---|---|---|---|
| **1** | **Khách chủ động hủy sớm** | Báo trước $\Delta t > 12\text{ giờ}$ | • Phạt 0%.<br>• Hoàn 100% tiền cho khách. | Chuyển `CANCELLED`. Hoàn tiền ký quỹ 100% (`REFUNDED`). Giải phóng lịch rảnh cho điều dưỡng. |
| **2** | **Khách hủy cận giờ** | $2\text{ giờ} \le \Delta t \le 12\text{ giờ}$ | • Phạt 20% phí hủy.<br>• Hoàn 80% tiền cho khách.<br>• Điều dưỡng nhận 15% (giữ lịch).<br>• Nền tảng giữ 5%. | Tách tiền ký quỹ: Hoàn 80% cho khách, cộng 15% vào `available_balance` của điều dưỡng, 5% vào doanh thu nền tảng. |
| **3** | **Khách hủy sát giờ** | $\Delta t < 2\text{ giờ}$ (chưa check-in) | • Phạt 50% phí hủy.<br>• Hoàn 50% tiền cho khách.<br>• Điều dưỡng nhận 40% (xăng xe/lỡ việc).<br>• Nền tảng giữ 10%. | Tách tiền ký quỹ: Hoàn 50% cho khách, cộng 40% vào `available_balance` của điều dưỡng, 10% vào doanh thu nền tảng. |
| **4** | **Khách dừng ca sau khi đã check-in** | Đang `IN_PROGRESS`, khách cho kết thúc sớm | • Trả tiền theo số giờ thực tế.<br>• Không phạt hủy sớm. | Thanh toán 100% số giờ thực tế đã làm (tối thiểu 1 giờ). Đơn theo việc hưởng trọn vẹn 100% nếu làm xong việc. Hoàn tiền thời gian dư còn lại. **Không** tạo trạng thái `PARTIALLY_SETTLED`. |
| **5** | **Khách hủy vì sự kiện y tế bất khả kháng** | Bệnh nhân cấp cứu ICU hoặc qua đời | • Miễn 100% phí phạt.<br>• Hoàn 100% tiền cho gia đình.<br>• Hỗ trợ điều dưỡng 50.000 VNĐ. | Hoàn 100% tiền dư cho gia đình khi tải giấy xác nhận viện. Trợ cấp 50.000 VNĐ (`ICU_TRAVEL_SUPPORT`) từ quỹ vận hành nếu điều dưỡng đã di chuyển. |
| **6** | **Điều dưỡng hủy sớm** | Báo trước $\Delta t > 12\text{ giờ}$ | • Phạt 0 VNĐ tiền cọc.<br>• **Trừ 5 điểm TrustScore**. | Đơn chuyển về trạng thái `MATCHING` để tìm điều dưỡng thay thế. Lịch của điều dưỡng bị hủy phân bổ. |
| **7** | **Điều dưỡng hủy muộn** | Báo trước $\Delta t \le 12\text{ giờ}$ | • Phạt 20% giá trị ca trực.<br>• **Trừ 20 điểm TrustScore**. | Khấu trừ 20% giá trị ca từ ví cọc `deposit_balance` (ghi nợ nếu thiếu). Chuyển thành khoản "Thưởng ca khẩn cấp" đẩy vào ca trực để hút người nhận thay. |
| **8** | **Điều dưỡng bùng ca (không tìm được người thay)** | Quá 30 phút giờ hẹn không đến và điều phối khẩn thất bại | • Điều dưỡng bị **CẤM VĨNH VIỄN** (`BANNED`).<br>• Phạt 50.000 VNĐ từ ví cọc.<br>• Khách nhận hoàn 100% + Voucher 50k. | Khóa vĩnh viễn tài khoản điều dưỡng từ lần đầu vi phạm. Phạt 50.000 VNĐ (`NO_SHOW_PENALTY`) từ ví cọc tạo voucher xin lỗi cho khách hàng kèm hoàn tiền 100%. |
| **9** | **Quá hạn thanh toán / Hết hạn tìm người** | Khách không thanh toán sau 15m; hoặc không có ai nhận trước ca 30m | • Không phạt 0%.<br>• Hoàn 100% tiền nếu đã trả. | Chuyển `execution_status` thành `EXPIRED`. Tự động hoàn lại 100% tiền ký quỹ (`REFUNDED`) kèm thông báo xin lỗi gửi đến khách hàng. |

---

# PHẦN 2: YÊU CẦU PHI CHỨC NĂNG (NFR)

## NFR-UI: Chuẩn Giao diện Thân thiện Người cao tuổi

### Bảng Tổng hợp
| Mã Yêu cầu | Thuộc tính / Phạm vi | Tiêu chuẩn & Định lượng | Giai đoạn |
|---|---|---|---|
| **NFR-UI-01.1** | Cỡ chữ & Độ tương phản màu | • Mobile: Cỡ chữ 16pt–18pt<br>• Web: Cỡ chữ 18px–20px<br>• Tương phản: WCAG 2.1 AA ($\ge 4.5:1$) | MVP (Bề mặt Điều dưỡng) |
| **NFR-UI-01.2** | Vùng cảm ứng & Độ sâu luồng | • Nút bấm $\ge 48 \times 48\text{ dp}$<br>• Luồng nghiệp vụ cốt lõi $\le 3\text{ thao tác}$ | MVP (Bề mặt Điều dưỡng) |
| **NFR-UI-01.3** | Giao diện Người cao tuổi cho App Bệnh nhân | • Mở rộng tiêu chuẩn NFR-UI-01.1 & 01.2 sang App Bệnh nhân | Phase 2 (App Bệnh nhân) |

### Đặc tả Chi tiết

#### NFR-UI-01.1: Cỡ chữ & Độ tương phản màu (Bề mặt Điều dưỡng)
* **Tiêu chuẩn Tuân thủ:** Đạt chuẩn tiếp cận WCAG 2.1 Cấp độ AA.
* **Quy cách Kỹ thuật:**
  * Web Portal Điều dưỡng và App Mobile Điều dưỡng có nút chuyển đổi "Chế độ chữ lớn".
  * Cỡ chữ văn bản thông thường: **16pt đến 18pt** trên App Mobile, **18px đến 20px** trên Web.
  * Tỷ lệ tương phản màu sắc giữa chữ và nền đạt tối thiểu **4.5:1** cho văn bản thông thường và **3.0:1** cho các tiêu đề/nút bấm lớn.
* **Nghiệm thu:** Công cụ kiểm thử tự động Lighthouse / axe-core đạt điểm tiếp cận Accessibility $\ge 95\%$.

#### NFR-UI-01.2: Vùng cảm ứng & Độ sâu luồng thao tác (Bề mặt Điều dưỡng)
* **Tiêu chuẩn Kỹ thuật:**
  * Kích thước vùng bấm tương tác tối thiểu **$48 \times 48\text{ dp}$**, khoảng cách giữa các nút bấm liền kề tối thiểu 8dp.
  * Ba quy trình vận hành chính của điều dưỡng—**Bấm nhận ca**, **Ghi chép sinh hiệu/nhật ký**, và **Nộp 15% hoa hồng tiền mặt**—phải hoàn tất trong **không quá 3 màn hình/thao tác** tính từ bảng điều khiển chính.

#### NFR-UI-01.3: Giao diện Người cao tuổi cho Khách hàng (Phase 2)
* **Quy cách:** Áp dụng toàn bộ chuẩn cỡ chữ lớn và nút bấm nổi bật cho App Mobile Bệnh nhân ở Phase 2 để người cao tuổi có thể tự đặt lịch độc lập.

---

## NFR-COMP: Tương thích Đa nền tảng & Thiết bị Đời cũ

### Bảng Tổng hợp
| Mã Yêu cầu | Nền tảng Ứng dụng | Tiêu chí & Phiên bản Tương thích | Giai đoạn |
|---|---|---|---|
| **NFR-COMP-01.1** | Dung lượng & Hệ điều hành App Điều dưỡng | • Kích thước bộ cài $< 50\text{ MB}$<br>• Android 8.0 trở lên (API 26)<br>• iOS 13.0 trở lên | MVP |
| **NFR-COMP-01.2** | Trình duyệt Web Portals | • Hỗ trợ 2 phiên bản mới nhất của Chrome, Safari, Edge, Firefox<br>• Hiển thị responsive trên Desktop & Mobile | MVP |

### Đặc tả Chi tiết

#### NFR-COMP-01.1: Dung lượng & Phiên bản Hệ điều hành App Điều dưỡng
* **Bối cảnh:** Lực lượng điều dưỡng nghỉ hưu thường sử dụng điện thoại thông minh đời cũ có bộ nhớ trong hạn chế.
* **Quy cách:**
  * Dung lượng gói cài đặt bản phát hành chính thức (Release APK / IPA) phải nhỏ hơn **50 MB**.
  * Hỗ trợ tương thích ngược:
    * **Android:** Từ Android 8.0 Oreo (API Level 26) trở lên.
    * **iOS:** Từ iOS 13.0 trở lên.
  * Bộ nhớ RAM tiêu thụ khi ứng dụng chạy không vượt quá 150 MB kể cả khi bật camera và định vị GPS.

#### NFR-COMP-01.2: Tương thích Trình duyệt Web Portals
* **Quy cách:**
  * Web Bệnh nhân, Web Portal Điều dưỡng và Web Portal Quản trị hoạt động trơn tru trên 2 phiên bản mới nhất của Google Chrome, Apple Safari, Microsoft Edge và Mozilla Firefox.
  * Tự động co giãn mượt mà theo kích thước màn hình Mobile ($320\text{px} - 767\text{px}$), Tablet ($768\text{px} - 1023\text{px}$) và Desktop ($\ge 1024\text{px}$).

---

## NFR-AVAIL: Tính Sẵn sàng, Sao lưu & Khôi phục Thảm họa

### Bảng Tổng hợp
| Mã Yêu cầu | Thuộc tính Chất lượng | Chỉ tiêu Định lượng | Nguồn Chuẩn |
|---|---|---|---|
| **NFR-AVAIL-01.1** | Thời gian Hoạt động (Uptime) & Bảo trì | • Uptime SLA $\ge \mathbf{99.5\%}$<br>• Khung giờ cấm gián đoạn: 19:00–21:00 | SRS §6 (NFR-AVAIL-01) |
| **NFR-AVAIL-01.2** | Sao lưu Cơ sở dữ liệu, RPO & RTO | • PITR + Sao lưu đầy đủ hàng ngày<br>• **RPO $\le 1\text{ giờ}$** (ví), $\le 24\text{h}$ (log)<br>• **RTO $\le 4\text{ giờ}$** | SRS §6 (NFR-AVAIL-01) |

### Đặc tả Chi tiết

#### NFR-AVAIL-01.1: Tính Sẵn sàng & Khung giờ Cấm bảo trì
* **Chỉ số Uptime:** Đạt mức sẵn sàng tối thiểu **99.5%** mỗi tháng (tương đương thời gian ngừng hoạt động ngoài kế hoạch không quá 3.65 giờ/tháng).
* **Khung giờ Tránh bảo trì:** Tuyệt đối **không thực hiện bảo trì hệ thống hoặc cập nhật cơ sở dữ liệu trong khung giờ giao ca cao điểm 19:00–21:00**, nhằm tránh gây gián đoạn việc check-in của các ca trực đêm.

#### NFR-AVAIL-01.2: Kế hoạch Sao lưu, RPO & RTO
* **Phương án Sao lưu:** Tự động tạo bản chụp toàn vẹn (Snapshot) cơ sở dữ liệu PostgreSQL hàng ngày (lưu trữ 30 ngày) kết hợp ghi nhật ký Write-Ahead Log (WAL) liên tục hỗ trợ khôi phục về điểm thời gian bất kỳ (Point-in-Time Recovery - PITR).
* **Chỉ tiêu Khôi phục:**
  * **RPO (Mất mát dữ liệu tối đa cho phép):** Dữ liệu giao dịch tài chính $\mathbf{\le 1\text{ giờ}}$; nhật ký vận hành $\mathbf{\le 24\text{ giờ}}$.
  * **RTO (Thời gian khôi phục hoạt động tối đa):** Khôi phục toàn bộ hệ thống trong vòng $\mathbf{\le 4\text{ giờ}}$ khi xảy ra sự cố sập máy chủ chính.

---

## NFR-SEC: An toàn, Chống Gian lận & Toàn vẹn Tài chính

### Bảng Tổng hợp
| Mã Yêu cầu | Phạm vi An ninh | Cơ chế Bảo vệ Kỹ thuật | Nguồn Chuẩn |
|---|---|---|---|
| **NFR-SEC-01.1** | Lưu trữ Đa phương tiện Y tế | Kho lưu trữ S3/MinIO riêng tư + URL ký trước hiệu lực 10 phút | SRS §6 |
| **NFR-SEC-01.2** | An toàn Tranh chấp Dữ liệu | Giao dịch ACID + Khóa dòng / Khóa phân tán Redis | SRS §6, §4.5 |
| **NFR-SEC-01.3** | Chống Giả mạo Check-in | Đọc cờ phần cứng OS + Chặn ảnh thư viện + Gắn watermark thời gian/GPS | SRS §6, §4.4 |
| **NFR-SEC-01.4** | An toàn Webhook Thanh toán | Xác thực chữ ký HMAC-SHA256 + Khóa chống lặp Idempotency Key | SRS §9 |
| **NFR-SEC-01.5** | Sổ cái Tài chính Bất biến | Sổ cái ghi nối tiếp `wallet_transactions` + Lưu `balance_before` / `after` | SRS §7 |
| **NFR-SEC-01.6** | Nhật ký Kiểm toán & Thu hồi Quyền | Tự động ngắt quyền xem bệnh án sau 12h + Bảng log `audit_logs` | SRS §7, §4.1 |

### Đặc tả Chi tiết

#### NFR-SEC-01.1: Lưu trữ Riêng tư Tệp tin Y tế
* **Quy tắc:** Tất cả ảnh CCCD, GPHN, đơn thuốc y lệnh và ảnh selfie check-in được lưu trữ ở chế độ **Riêng tư (Private)** trên S3/MinIO. Tuyệt đối không để lộ URL công khai vĩnh viễn. Quyền truy cập chỉ được cấp qua **Presigned URL có thời hạn tối đa 10 phút**.

#### NFR-SEC-01.2: An toàn Xử lý Đồng thời & Chống Race Condition
* **Quy tắc:** API nhận ca và các API thay đổi số dư ví (quyết toán, nộp hoa hồng, trừ phạt vi phạm, rút tiền) bắt buộc phải bảo vệ bởi:
  * Giao dịch cơ sở dữ liệu với khóa dòng cấp cao (`SELECT ... FOR UPDATE`).
  * Khóa phân tán Redis Distributed Lock kèm thời gian sống (TTL) xác định, loại bỏ triệt để nguy cơ 2 điều dưỡng cùng nhận 1 ca hoặc lệch số dư ví.

#### NFR-SEC-01.3: Giao thức Chống Giả mạo Check-in
* **Quy tắc:** Đọc trực tiếp cờ giả lập tọa độ từ hệ điều hành điện thoại. Ứng dụng chỉ cho phép kích hoạt camera phần cứng để chụp trực tiếp, vô hiệu hóa nút chọn tệp từ bộ sưu tập ảnh. Ảnh được gắn watermark tọa độ và dấu thời gian phía máy chủ.

#### NFR-SEC-01.4: Toàn vẹn Dữ liệu Webhook Thanh toán
* **Quy tắc:**
  * Mọi callback webhook từ cổng thanh toán đều phải được tính toán lại chữ ký số **HMAC-SHA256** trên dữ liệu thô và đối chiếu với khóa bí mật. Nếu sai lệch, lập tức trả về HTTP 401 và ghi log cảnh báo.
  * Chống tấn công phát lại (Replay attack): Mã giao dịch của cổng được lưu làm `idempotency_key` (ràng buộc `UNIQUE` trong `wallet_transactions`). Nhận webhook trùng lặp sẽ trả về HTTP 200 mà không cộng/trừ tiền lần thứ hai.

#### NFR-SEC-01.5: Sổ cái Tài chính Bất biến
* **Quy tắc:**
  * Cấm tuyệt đối lệnh SQL `UPDATE` trực tiếp cột số dư ví mà không có bản ghi tương ứng trong bảng sổ cái `wallet_transactions`.
  * Mỗi giao dịch biến động số dư bắt buộc phải ghi nhận trường `balance_before` và `balance_after`.
  * Các loại giao dịch nộp hoa hồng (`COMMISSION_PAYMENT`) và phạt vi phạm (`PENALTY_DEDUCT`) phải phân biệt rõ ràng bằng mã giao dịch độc lập.

#### NFR-SEC-01.6: Nhật ký Kiểm toán & Giới hạn Thời gian Truy cập
* **Quy tắc:**
  * Toàn bộ thao tác nhạy cảm (duyệt hồ sơ nhân sự, phân xử khiếu nại, xem bệnh án, sửa cấu hình hệ thống) được ghi bất biến vào bảng `audit_logs`.
  * Điều dưỡng tự động mất toàn bộ quyền xem hồ sơ bệnh án và đơn thuốc **đúng 12 giờ sau khi check-out** (FR-PRIV-01).

---

## NFR-PERF: Các Chỉ tiêu Hiệu năng Định lượng

> **Ranh giới Chuẩn:** Dưới đây là **toàn bộ các chỉ tiêu hiệu năng định lượng cụ thể** được cam kết tại SRS v2.0 §9–§10. Các chỉ tiêu về độ trễ chung của toàn bộ API không có trong SRS v2.0 được xếp vào mục Hạng mục Mở.

### Bảng Tổng hợp
| Mã Yêu cầu | Thao tác / Nghiệp vụ | Chỉ tiêu Hiệu năng Cam kết | Cơ chế Đo lường |
|---|---|---|---|
| **NFR-PERF-01** | Tốc độ Truy vấn Ghép nối Tọa độ | **$< 500\text{ ms}$** | Tìm kiếm không gian điều dưỡng trong bán kính 5 km / 10 km |
| **NFR-PERF-02** | Tốc độ Gửi Cảnh báo Khẩn cấp SOS | **$< 2\text{ giây}$** | Thời gian từ lúc bấm nút SOS đến khi App Gia đình / Web Admin nhận cảnh báo |
| **NFR-PERF-03** | Dự phòng Thông báo Khẩn cấp | **$\le 60\text{ giây}$** | Tự động chuyển phát SMS / ZNS nếu thiết bị chưa xác nhận nhận Push |

### Đặc tả Chi tiết

#### NFR-PERF-01: Tốc độ Truy vấn Ghép nối Tọa độ Địa lý
* **Chỉ tiêu:** Câu truy vấn quét danh sách điều dưỡng đạt chuẩn trong bán kính 5 km (Vòng 1) hoặc 10 km (Vòng 2)—kết hợp lọc theo chuyên môn và lịch rảnh—phải hoàn thành trong thời gian **dưới 500 mili-giây** dưới tải vận hành bình thường.
* **Giải pháp:** Sử dụng chỉ mục không gian PostgreSQL PostGIS (`ST_DWithin` hoặc `earthdistance`).

#### NFR-PERF-02: Tốc độ Gửi Cảnh báo Khẩn cấp SOS
* **Chỉ tiêu:** Khi bấm nút SOS khẩn cấp, gói dữ liệu cảnh báo (tọa độ GPS, thông tin bệnh nhân, sinh hiệu gần nhất) phải truyền tải đến thiết bị của Gia đình và Web Admin trong thời gian **dưới 2 giây**.
* **Đồng thời:** Kích hoạt ngay lập tức trình quay số gọi **Cấp cứu 115** trên máy mà không bị nghẽn mạng chờ phản hồi máy chủ.

#### NFR-PERF-03: Dự phòng Thông báo Khẩn cấp
* **Chỉ tiêu:** Các thông báo có tính chất nguy cấp được bắn qua FCM với cờ `priority = high`. Nếu thiết bị không gửi tín hiệu xác nhận đã nhận (ACK) trong vòng **60 giây** (hoặc FCM báo token không hợp lệ), worker hậu trường tự động chuyển hướng gửi tin nhắn SMS hoặc Zalo ZNS.

---

## NFR-PRIV: Quyền Riêng tư & Tuân thủ Pháp lý

### Bảng Tổng hợp
| Mã Yêu cầu | Lĩnh vực Tuân thủ | Quy định Pháp lý & Kỹ thuật | Căn cứ Pháp lý |
|---|---|---|---|
| **NFR-PRIV-01** | Đồng thuận Dữ liệu Y tế Nhạy cảm | Bắt buộc tích chọn đồng thuận, có lưu vết và hỗ trợ xóa | Nghị định 13/2023/NĐ-CP |
| **NFR-PRIV-02** | Thời hạn Lưu trữ Hồ sơ Y tế | Thời hạn lưu trữ tối đa **24 tháng** | Nghị định 13 / Quy định Y tế |
| **NFR-PRIV-03** | Bảo vệ Bí mật Số điện thoại | Ẩn số thực qua viễn thông ảo / Gọi nội bộ; quét regex chặn lộ số | Luật Viễn thông |
| **NFR-PRIV-04** | Kiểm soát Giới hạn Chuyên môn | Chặn database với `is_invasive`; quét hạn GPHN tự động mỗi ngày | Luật Khám, chữa bệnh 15/2023/QH15 |

### Đặc tả Chi tiết

#### NFR-PRIV-01: Đồng thuận Dữ liệu Y tế & Quyền Chủ thể Dữ liệu
* **Tuân thủ:** Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân.
* **Cơ chế:** Ghi nhận rõ ràng thời điểm đồng thuận, địa chỉ IP và mã thiết bị. Cung cấp quy trình tiếp nhận và xử lý yêu cầu xóa/ẩn danh dữ liệu cho các tài khoản không vướng mắc tranh chấp tài chính.

#### NFR-PRIV-02: Thời hạn Lưu trữ Hồ sơ Y tế
* **Quy định:** Dữ liệu đơn thuốc, nhật ký lâm sàng và ghi chú bàn giao được lưu trữ trên hệ thống trong thời gian tối đa **24 tháng** phục vụ tra cứu y khoa và pháp lý, sau thời hạn này sẽ được lưu trữ lạnh hoặc ẩn danh hóa.

#### NFR-PRIV-03: Bảo vệ Bí mật Số điện thoại & Liên lạc
* **Quy định:** Số điện thoại của khách hàng và điều dưỡng không bao giờ hiển thị trực tiếp. Toàn bộ đàm thoại và nhắn tin diễn ra qua nền tảng. Hệ thống tự động quét và chặn tin nhắn nếu chứa chuỗi ký tự số điện thoại hoặc liên kết ngoài sàn.

#### NFR-PRIV-04: Kiểm soát Giới hạn Chuyên môn
* **Tuân thủ:** Luật Khám bệnh, chữa bệnh số 15/2023/QH15 và Nghị định 96/2023/NĐ-CP.
* **Cơ chế:** Dịch vụ xâm lấn (`is_invasive = true`) bị kiểm soát chặt: Điều dưỡng Hạng 1 nhận ca sẽ nhận mã lỗi `HTTP 403 Forbidden`. Quét hạn GPHN tự động giáng hạng điều dưỡng ngay khi hết hạn.

---

## Danh mục Hạng mục Mở (Chờ Quyết định)

Các tiêu chí chất lượng sau đây từng có con số trong tài liệu cơ sở bệnh viện cũ nhưng **không được định lượng trong SRS v2.0**. Các tiêu chí này được ghi nhận lại dưới dạng hạng mục mở và cần được thống nhất bổ sung trước khi xem là cam kết kỹ thuật:

| STT | Thuộc tính Kiến trúc Chưa Định lượng | Trạng thái trong SRS v2.0 | Thành phần Hệ thống Bị ảnh hưởng |
|---|---|---|---|
| **1** | **Ngân sách Độ trễ & Thông lượng API Chung** | *Hạng mục Mở* | Chỉ tiêu độ trễ p95/p99 cho các API CRUD thông thường (chỉ có định vị < 500ms và SOS < 2s được chốt). |
| **2** | **Công suất Tải & Dung lượng Người dùng** | *Hạng mục Mở* | Số lượng người dùng đồng thời dự kiến, TPS đỉnh điểm, số ca hoàn tất mỗi ngày. |
| **3** | **Thuật toán Mã hóa & Chuẩn Mật khẩu / OTP** | *Hạng mục Mở* | Tiêu chuẩn băm mật khẩu (Argon2id hay BCrypt), thời gian sống của token JWT, độ dài mã OTP và số lần thử tối đa. |
| **4** | **Khu vực Đặt Máy chủ & Lưu trữ Dữ liệu** | *Hạng mục Mở* | Vị trí trung tâm dữ liệu vật lý (Data Center trong nước tại Việt Nam theo Nghị định 53/2022/NĐ-CP hay vùng Singapore của AWS/GCP). |
| **5** | **Đồng bộ Ngoại tuyến cho App Điều dưỡng** | *Hạng mục Mở* | Độ sâu lưu bộ nhớ đệm và hành vi hàng đợi ngoại tuyến khi điều dưỡng vào vùng mất sóng điện thoại. |
| **6** | **Chỉ tiêu Độ bao phủ Kiểm thử CI/CD** | *Hạng mục Mở* | Ngưỡng tỷ lệ bao phủ kiểm thử tự động (Unit / Integration Test Coverage, ví dụ tối thiểu 80%). |
| **7** | **Tần suất Diễn tập Khôi phục Thảm họa (DR)** | *Hạng mục Mở* | Tần suất định kỳ tổ chức diễn tập chuyển đổi dự phòng (mục tiêu RPO/RTO đã được chốt cố định). |

---

*Lưu ý: Trong trường hợp có bất kỳ sự mâu thuẫn nào giữa tài liệu này và nguồn chuẩn, **SRS HealthCareSystem On-Demand Nursing v2.0 (Cập nhật 28/10/2026)** giữ quyền quyết định cao nhất.*
