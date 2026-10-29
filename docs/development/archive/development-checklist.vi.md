# Checklist phát triển theo giai đoạn — Frontend / Backend

> **Baseline:** SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**. Nội dung nghiệp vụ chi tiết xem ở file `Ke-hoach-phat-trien-theo-giai-doan-FE-BE.md` (cùng thư mục) và `docs/development/development_checklist.md` trong repo.
> **Đội hình:** 2 Frontend (FE-1, FE-2) + 3 Backend (BE-1, BE-2, BE-3).
> **Cách dùng:** Làm theo thứ tự giai đoạn 0 → 8, không nhảy giai đoạn. Xong việc nào tick việc đó. Một giai đoạn chỉ hoàn thành khi **toàn bộ mục của 5 người và toàn bộ "Cổng ra" của giai đoạn đều đã tick**. Trong mỗi giai đoạn: BE chốt contract API trước → FE làm bằng mock song song → ghép thật cuối giai đoạn.

## 0. Chuẩn bị chung (làm một lần, trước Giai đoạn 0)

- [ ] Điền tên thật vào bảng phân vai: FE-1 = ……… · FE-2 = ……… · BE-1 = ……… · BE-2 = ……… · BE-3 = ………
- [ ] Cả 5 người đã đọc SRS v2.0 Updated (§4 FR, §5 cấu hình & SLA, §7 CSDL, §8 API)
- [ ] Thống nhất phân vai cố định: FE-1 = Patient Web + Admin Web · FE-2 = Nurse Web + Nurse App · BE-1 = nền tảng/định danh · BE-2 = đặt ca/ca trực · BE-3 = tiền/sau ca
- [ ] Thống nhất: mọi số nghiệp vụ lấy từ `system_configs` (§5.1), không hardcode (hoa hồng 15%, ký quỹ 300.000đ, đêm +20%, Tết +300%, lễ +200%, nặng +15%, timeout 15 phút, quyết toán +24h, check-in ≤ 200 m, ICU 50.000đ, no-show 50.000đ)
- [ ] Thống nhất: tiền chỉ đi qua sổ cái `wallet_transactions` (append-only, có `idempotency_key`); ký quỹ chỉ trừ phạt SLA, không thu hoa hồng
- [ ] Thống nhất: `nurse_profiles.profile_status` là nguồn sự thật quyền nhận ca; chặn tier ở backend (HTTP 403)
- [ ] Thống nhất: mọi hẹn giờ qua job queue dùng chung, cấm `setTimeout` tự phát
- [ ] Thống nhất: FE không tự tính giá/hạn chót/điều kiện nhận ca — tất cả lấy từ BE
- [ ] Điền lịch dự kiến: GĐ0 …… → GĐ1 …… → GĐ2 …… → GĐ3 …… → GĐ4 …… → GĐ5 …… → GĐ6 …… → GĐ7 …… → GĐ8 ……

---

## Giai đoạn 0 — Nền tảng dùng chung

### FE-1 (Patient Web + Admin Web)
- [ ] Dựng khung `apps/patient-web`: routing, layout chính
- [ ] Dựng khung `apps/admin-web`: routing, layout chính
- [ ] Thư viện gọi API dùng chung: base URL `/api/v1`, gắn token, xử lý lỗi 400/401/403 thống nhất
- [ ] Bộ component dùng chung theo design system: nút, form, bảng, badge trạng thái

### FE-2 (Nurse Web + Nurse App)
- [ ] Dựng khung `apps/nurse-web`: routing, layout
- [ ] Dựng khung `apps/nurse-app`: routing, layout
- [ ] Bộ token Elder-Friendly: chữ 16–18pt (app) / 18–20px (web), vùng chạm ≥ 48×48dp, tương phản WCAG 2.1 AA
- [ ] Thư viện gọi API dùng chung theo chuẩn đã thống nhất với FE-1
- [ ] Cài thử app lên máy Android đời cũ

### BE-1 (Nền tảng — chủ trì giai đoạn)
- [ ] `core/database`: kết nối PostgreSQL
- [ ] `core/config`: đọc `system_configs` có cache, không hardcode
- [ ] `core/storage`: bucket private, presigned URL hiệu lực 10 phút
- [ ] Migrations khung 16 bảng dữ liệu (§7)
- [ ] Seeds: `system_configs` (§5.1) + danh mục dịch vụ (§4.2)
- [ ] `packages/shared`: enum 3 trục trạng thái booking, vòng đời hồ sơ, loại giao dịch ví, khóa cấu hình

### BE-2
- [ ] `core/jobs`: engine hàng đợi có khóa idempotency, dead-letter queue, cảnh báo tồn đọng
- [ ] Docker Compose: PostgreSQL + Redis (cùng BE-1)

### BE-3
- [ ] `core/notifications`: interface FCM push + in-app + WebSocket, có bản mock để test
- [ ] Cảnh báo khẩn `priority = high` + watcher 60 giây chưa xác nhận
- [ ] `core/audit`: ghi `audit_logs` append-only (khóa sửa/xóa ở cả tầng DB và ứng dụng)
- [ ] CI xanh trên PR rỗng: unit test + migration/constraint test + quét secret

### Cổng ra Giai đoạn 0
- [ ] Docker Compose dựng được PostgreSQL + Redis
- [ ] Migrations + seeds áp sạch từ database rỗng
- [ ] `packages/shared` xuất đủ enum §2.2/§2.3
- [ ] CI xanh

---

## Giai đoạn 1 — AUTH: Định danh, eKYC, Tier & Riêng tư [MVP]

### FE-1
- [ ] Patient Web — đăng nhập SĐT + OTP (`features/auth`)
- [ ] Patient Web — hồ sơ người bệnh + tích chọn consent xử lý dữ liệu (`features/patient-profiles`)
- [ ] Patient Web — tải CCCD khách để eKYC
- [ ] Admin Web — hàng đợi duyệt hồ sơ điều dưỡng: xem giấy tờ, duyệt/từ chối, gán tier (`features/nurse-verification`)

### FE-2
- [ ] Nurse Web + App — đăng nhập SĐT + OTP
- [ ] Nurse Web + App — wizard đăng ký eKYC (`features/onboarding`): CCCD 2 mặt, ảnh chân dung chụp trực tiếp, bằng tốt nghiệp, GPHN (số, ngày hết hạn, phạm vi), quyết định nghỉ hưu
- [ ] Nurse Web + App — màn hình văn bằng + tải GPHN mới khi hết hạn (`features/credentials`)
- [ ] Hiển thị trạng thái hồ sơ: chờ duyệt / đang hoạt động / tạm khóa / khóa vĩnh viễn

### BE-1 (chủ trì giai đoạn)
- [ ] `accounts-otp`: `POST /api/v1/auth/request-otp` (giới hạn tần suất, không log mã OTP)
- [ ] `accounts-otp`: `POST /api/v1/auth/verify-otp` (chỉ cấp phiên khi mã đúng; Admin bắt buộc thêm 2FA)
- [ ] `nurse-onboarding` (FR-AUTH-01): `POST /api/v1/auth/nurse-onboarding` — hồ sơ vào `PENDING_VERIFICATION`, giấy tờ lưu private storage
- [ ] `credential-review` (FR-AUTH-02): `PATCH /api/v1/admin/nurses/:id/verify` — ghi `reviewed_by`, gán tier (có bằng không GPHN → Tier 1; GPHN còn hạn đúng phạm vi → Tier 2; quyết định nghỉ hưu một mình không lên Tier 2)
- [ ] `credential-review`: duyệt GPHN mới qua `PUT /api/v1/nurse/credentials/gphn` → tự nâng lại Tier 2

### BE-2
- [ ] `tier-lifecycle`: job quét hạn GPHN hằng ngày — hết hạn thì hạ Tier 2 → Tier 1, hồ sơ vẫn ACTIVE
- [ ] `tier-lifecycle`: tự hủy không phạt các ca xâm lấn CONFIRMED sau ngày GPHN hết hạn + điều phối lại
- [ ] `patient-profiles` (FR-AUTH-03): hồ sơ bệnh nhân + eKYC khách; chặn đặt chăm sóc tại nhà khi eKYC chưa VERIFIED; không lưu được hồ sơ nếu thiếu consent

### BE-3
- [ ] `privacy-consent` (FR-PRIV-01): ghi consent kèm timestamp + IP/thiết bị
- [ ] `privacy-consent`: cửa sổ xem bệnh án — chỉ điều dưỡng được gán, từ CONFIRMED đến check-out +12h; Admin cấp lại có thời hạn + ghi audit
- [ ] `privacy-consent`: lưu trữ 24 tháng; xử lý yêu cầu xóa/ẩn danh dữ liệu
- [ ] Hỗ trợ BE-1: luồng presigned URL cho giấy tờ tùy thân

### Cổng ra Giai đoạn 1
- [ ] Điều dưỡng đi hết luồng: đăng ký → Admin duyệt → gán tier (trên staging)
- [ ] Chạy được 1 vòng: GPHN hết hạn → hạ Tier 1 → nộp GPHN mới → duyệt → nâng lại Tier 2
- [ ] Khách hoàn tất eKYC + tạo hồ sơ bệnh nhân có consent
- [ ] Hồ sơ `PENDING_VERIFICATION` không xuất hiện ở tìm kiếm/ghép ca, không nhận được ca

---

## Giai đoạn 2 — SCHED & SEARCH: Lịch rảnh và Tìm điều dưỡng [MVP]

### FE-1
- [ ] Patient Web — màn hình tìm kiếm điều dưỡng: lọc theo dịch vụ, khu vực, khung giờ, tier, giới tính
- [ ] Patient Web — thẻ hồ sơ điều dưỡng: điểm đánh giá, kinh nghiệm, huy hiệu nhân viên y tế đã nghỉ hưu

### FE-2
- [ ] Nurse Web + App — lịch rảnh: khai khung giờ lặp lại hằng tuần
- [ ] Nurse Web + App — đăng ký ngày nghỉ (ngoại lệ)
- [ ] Nurse Web + App — hiển thị ca đã CONFIRMED/IN_PROGRESS trên cùng lịch

### BE-1
- [ ] Duy trì `rating_avg` trên hồ sơ điều dưỡng từ các đánh giá đã hiển thị
- [ ] Rà soát dữ liệu seed điều dưỡng mẫu phục vụ test tìm kiếm

### BE-2 (chủ trì giai đoạn)
- [ ] `nurse-availabilities` (FR-SCHED-01): `PUT /api/v1/nurse/availabilities` — khung lặp lại + ngày nghỉ trong một lần ghi nhất quán
- [ ] `availability-engine`: lịch rảnh hiệu dụng = lịch khai − ca CONFIRMED/IN_PROGRESS − đệm di chuyển 60 phút
- [ ] `availability-engine` là nguồn duy nhất cho cả tìm kiếm và ghép ca (không viết logic "đang rảnh" riêng ở nơi khác)

### BE-3
- [ ] `nurse-search`: `GET /api/v1/nurses/search` với đủ bộ lọc FR-SEARCH-01
- [ ] `nurse-search`: chỉ trả điều dưỡng `ACTIVE`, ký quỹ ≥ 300.000đ, đủ tier cho dịch vụ; dùng kết quả của `availability-engine`

### Cổng ra Giai đoạn 2
- [ ] Kịch bản ngày nghỉ (TIME_OFF_EXCEPTION) loại điều dưỡng khỏi danh sách ứng viên
- [ ] Kịch bản khoảng trống < 60 phút tới ca đã xác nhận loại điều dưỡng khỏi danh sách ứng viên
- [ ] Kết quả lịch rảnh giống hệt nhau ở màn hình tìm kiếm và danh sách ghép ca

---

## Giai đoạn 3 — BOOK: Đặt ca, Tính giá, Cổng y lệnh & Ghép ca [MVP]

### FE-1
- [ ] Patient Web — luồng đặt ca: chọn dịch vụ → chọn bệnh nhân → chọn giờ → xác nhận
- [ ] Patient Web — tải ảnh y lệnh khi đặt dịch vụ xâm lấn
- [ ] Patient Web — bảng tách giá: giá gốc / phụ phí đêm / phụ phí lễ / phụ phí bệnh nhân nặng / phí nền tảng / tổng
- [ ] Patient Web — chọn hình thức thanh toán: chuyển khoản / tiền mặt
- [ ] Patient Web — trạng thái chờ thanh toán kèm đếm ngược 15 phút
- [ ] Patient Web — nút mời trực tiếp 1 điều dưỡng từ màn hình tìm kiếm
- [ ] Patient Web — danh sách đơn của tôi, hiển thị trạng thái 3 trục dễ hiểu

### FE-2
- [ ] Nurse Web + App — Bảng việc làm (Job Board) cho ca đặt trước
- [ ] Nurse Web + App — thông báo ca Radar (ca gấp) kèm đếm ngược, nút Nhận / Từ chối
- [ ] Nurse Web + App — phản hồi lời mời trực tiếp trong 15 phút
- [ ] Nurse Web + App — cảnh báo rõ khi không đủ điều kiện nhận ca (thiếu ký quỹ / sai tier / trùng lịch)

### BE-1
- [ ] `prescription-gate` (FR-BOOK-02) lớp 1: dịch vụ xâm lấn bắt buộc ảnh y lệnh, ngày cấp ≤ 7 ngày — thiếu trả HTTP 400
- [ ] `prescription-gate` lớp 2: điều dưỡng Tier 2 xem được ảnh y lệnh trước khi nhận ca

### BE-2 (chủ trì giai đoạn)
- [ ] `pricing-engine` (FR-BOOK-01): giá = giá gốc + phụ phí đêm theo đoạn giờ 22:00–06:00 + phụ phí lễ + phụ phí bệnh nhân nặng, mọi phụ phí cộng trên giá gốc, không nhân chồng
- [ ] `pricing-engine`: test biên đạt các ví dụ chuẩn SRS — ca đêm 580.000đ; ca Tết 500.000đ → 2.000.000đ
- [ ] `pricing-engine`: chụp snapshot giá vào đơn (`base_amount`, `surcharge_amount`, `platform_fee`, `total_amount`)
- [ ] `bookings`: `POST /api/v1/bookings` — kiểm tra consent + eKYC khách, cổng y lệnh, chặn dịch vụ bị cấm, ghi `payment_method`, đơn `DRAFT` giữ chỗ 15 phút
- [ ] `matching-radar` (FR-BOOK-03): ca gấp ≤ 6h — 5 km trong 5 phút đầu, mở 10 km sau đó
- [ ] `matching-radar`: người nhận trước thắng bằng Redis lock / `SELECT … FOR UPDATE`
- [ ] `matching-radar`: tại thời điểm nhận kiểm tra lại `profile_status = ACTIVE` + tier + ký quỹ ≥ 300.000đ + lịch rảnh hiệu dụng

### BE-3
- [ ] `job-board`: ca đặt trước > 6h phát lên bảng việc cho điều dưỡng phù hợp
- [ ] `job-board`: mời trực tiếp — 15 phút không phản hồi thì phát rộng
- [ ] `booking-expiry`: job hết hạn — quá 15 phút chưa thanh toán → `EXPIRED`
- [ ] `booking-expiry`: sát giờ hẹn 30 phút chưa ghép được ca → `EXPIRED` + hoàn 100% nếu tiền đang `ESCROW_HELD`
- [ ] `gateway-webhooks` (phần tối thiểu): đơn chuyển khoản giữ được tiền vào `ESCROW_HELD` để kích hoạt ghép ca

### Cổng ra Giai đoạn 3
- [ ] Cả 2 cơ chế ghép ca (Radar + Job Board) đều lấp được một đơn trên staging
- [ ] Đơn không thanh toán hết hạn đúng 15 phút
- [ ] Đơn đã trả tiền, không ghép được ca → hết hạn + hoàn 100%
- [ ] Dịch vụ bị cấm (nhóm 3) không tạo được đơn qua bất kỳ đường nào, kể cả công cụ Admin

---

## Giai đoạn 4 — SHIFT: Thực thi ca, Check-in chống gian lận & SOS [MVP]

### FE-1
- [ ] Patient Web — theo dõi ca thời gian thực: trạng thái ca, ảnh selfie check-in để đối chiếu
- [ ] Patient Web — xem chỉ số sinh tồn / nhật ký ca được cập nhật
- [ ] Patient Web — gia hạn ca: chọn thêm theo block 1 giờ, trả thêm vào escrow (đơn chuyển khoản)
- [ ] Patient Web — nhận cảnh báo SOS từ ca của người nhà

### FE-2 (chủ trì phía FE)
- [ ] Nurse App — check-in: GPS + chụp selfie trực tiếp, chặn chọn ảnh từ thư viện
- [ ] Nurse App — báo cáo tình trạng đầu ca trong 30 phút + báo sai lệch tình trạng so với khai báo
- [ ] Nurse App — ghi nhật ký ca: chỉ số sinh tồn, hoạt động chăm sóc
- [ ] Nurse App — duyệt / từ chối gia hạn ca
- [ ] Nurse App — từ chối ca do y lệnh sai, kèm ảnh bằng chứng
- [ ] Nurse App — nút SOS: mở trình gọi 115 ngay tại máy, không chờ mạng
- [ ] Nurse App + Web — check-out + nộp báo cáo ca tối thiểu

### BE-1
- [ ] `shift-extend` (FR-SHIFT-03): `POST /api/v1/bookings/:id/extend` — block 1 giờ, kiểm tra ca kế tiếp của điều dưỡng, cần điều dưỡng đồng ý
- [ ] `prescription-rejection`: `POST /api/v1/bookings/:id/reject-invalid-prescription` — bắt buộc ảnh bằng chứng, đơn `CANCELLED`, không phạt, không trừ TrustScore (hỗ trợ di chuyển §5.2 — mức tiền là điểm mở)

### BE-2 (chủ trì giai đoạn)
- [ ] `check-in` (FR-SHIFT-01): `POST /api/v1/bookings/:id/check-in` — chặn mock location
- [ ] `check-in`: khoảng cách Haversine ≤ 200 m so với tọa độ đơn
- [ ] `check-in`: selfie chụp trực tiếp, đóng dấu server timestamp + tọa độ → chuyển `IN_PROGRESS`
- [ ] `shift-logs` (FR-SHIFT-02): nhật ký sinh tồn/hoạt động chăm sóc + luồng sai lệch đầu ca (yêu cầu cộng phụ phí hoặc từ chối không phạt)
- [ ] `shift-logs`: đồng bộ thời gian thực qua WebSocket
- [ ] `check-out` (FR-SHIFT-04): `POST /api/v1/bookings/:id/check-out` — chặn nếu thiếu báo cáo ca tối thiểu (sinh tồn cuối ca, việc đã làm, ghi chú bàn giao)
- [ ] `check-out`: ghi `checkout_time`, khởi động đồng hồ khiếu nại/quyết toán 24h + đồng hồ đóng quyền xem bệnh án 12h, mở đánh giá 2 chiều
- [ ] `check-out`: dịch vụ theo đầu việc làm đủ thì tính đủ giá dù kết thúc sớm

### BE-3
- [ ] `sos` (FR-SHIFT-05): phát cảnh báo đồng thời push + SMS fallback kèm GPS + chỉ số sinh tồn mới nhất tới người nhà và Admin, < 2 giây
- [ ] `sos`: ghi log sự cố vào `shift_logs.emergency_incident_log`
- [ ] Hạ tầng WebSocket dùng chung cho `shift-logs` của BE-2

### Cổng ra Giai đoạn 4
- [ ] Một ca chạy trọn trên thiết bị thật: check-in → nhật ký → gia hạn → check-out + báo cáo
- [ ] Nhánh từ chối y lệnh sai chạy được
- [ ] Nhánh SOS chạy được, cảnh báo tới nơi < 2 giây
- [ ] Kiểm thử chống gian lận trên máy thật: app fake GPS bị chặn, tải ảnh thư viện bị chặn

---

## Giai đoạn 5 — PAY: Ví, Escrow, Quyết toán, Ký quỹ & Rút tiền [MVP]

### FE-1
- [ ] Patient Web — thanh toán chuyển khoản trả trước: hiển thị VietQR/link, đếm ngược 15 phút
- [ ] Patient Web — trạng thái tiền đang được nền tảng tạm giữ
- [ ] Patient Web — theo dõi trạng thái hoàn tiền theo từng tình huống hủy

### FE-2
- [ ] Nurse Web + App — màn hình ví: 3 số dư tách bạch (khả dụng / tạm giữ / ký quỹ)
- [ ] Nurse Web + App — nạp ký quỹ đủ 300.000đ
- [ ] Nurse Web + App — nộp hoa hồng ca tiền mặt: tạo VietQR/link, đếm ngược 24h sau check-out, cảnh báo tạm khóa nếu quá hạn
- [ ] Nurse Web + App — yêu cầu rút tiền
- [ ] Nurse Web + App — lịch sử giao dịch ví

### BE-1
- [ ] `cancellation-policy`: cài ma trận hủy/SLA §5.2 dạng bảng chính sách dữ liệu — 9 dòng, mỗi dòng 1 bộ test
- [ ] `cancellation-policy`: hủy > 12h hoàn 100% · 2–12h phạt 20% (điều dưỡng 15% / nền tảng 5%) · < 2h phạt 50% (40% / 10%)
- [ ] `cancellation-policy`: dừng ca giữa chừng trả theo giờ thực tế (tối thiểu 1h), không phạt
- [ ] `cancellation-policy`: ca ICU/tử vong miễn phạt + hỗ trợ 50.000đ nếu điều dưỡng đã di chuyển
- [ ] `cancellation-policy`: điều dưỡng hủy ≤ 12h — trừ ký quỹ 20% giá ca thành Urgent Bonus cho ca thay thế, −20 TrustScore; hủy > 12h −5 TrustScore
- [ ] `cancellation-policy`: no-show → `BANNED` + phạt 50.000đ thành voucher cho khách

### BE-2
- [ ] `deposits` (FR-PAY-03): nạp trước đủ 300.000đ mới được nhận ca; không lũy tiến, không giới hạn giá trị ca
- [ ] `deposits`: trừ phạt SLA khi thiếu thì ghi nợ, khóa nhận ca tới khi nạp bù
- [ ] `deposits`: chỉ rút hết ký quỹ khi đóng tài khoản sau 7 ngày không khiếu nại
- [ ] `cash-commission`: `POST /api/v1/bookings/:id/commission-payment-link` — sinh VietQR/link đúng 15% giá trong app của đơn tiền mặt
- [ ] `cash-commission`: webhook xác nhận đã nộp → đơn `SETTLED`; quá 24h chưa nộp → điều dưỡng `SUSPENDED`
- [ ] `cash-commission`: tuyệt đối không trừ hoa hồng từ bất kỳ ví nào

### BE-3 (chủ trì giai đoạn)
- [ ] `wallets-ledger`: 3 số dư tách bạch trong `wallets`
- [ ] `wallets-ledger`: `wallet_transactions` append-only, mỗi giao dịch có `idempotency_key` + `balance_before`/`balance_after`; cấm UPDATE/DELETE
- [ ] `wallets-ledger`: mọi biến động số dư chạy trong ACID transaction + khóa dòng / Redis lock
- [ ] `gateway-webhooks` (FR-PAY-01): `POST /api/v1/payments/escrow-webhook` — kiểm tra HMAC-SHA256 trước, sai chữ ký trả HTTP 401, không đổi trạng thái
- [ ] `gateway-webhooks`: webhook gửi lặp chỉ tạo đúng 1 bút toán (HTTP 200, no-op)
- [ ] `settlements` (FR-PAY-02): đơn chuyển khoản — khách xác nhận sớm **hoặc** check-out +24h và `dispute_status = NONE` → trừ 15%, cộng 85% vào `available_balance`
- [ ] `settlements`: khiếu nại đang `OPEN` thì đóng băng giải ngân
- [ ] `withdrawals` (FR-PAY-04): `POST /api/v1/wallets/withdraw` — vượt số dư khả dụng trả HTTP 400; luồng `WITHDRAW_REQUESTED` chờ duyệt chi

### Cổng ra Giai đoạn 5
- [ ] Ca chuyển khoản 500.000đ quyết toán → điều dưỡng nhận đúng 425.000đ
- [ ] Nộp hoa hồng ca tiền mặt không làm thay đổi ký quỹ một đồng nào
- [ ] Webhook gửi lặp 2 lần → sổ cái chỉ có 1 bút toán
- [ ] Cả 2 hình thức thanh toán chạy hết vòng đời trên staging, đối soát sổ cái lệch 0đ
- [ ] Hoàn tiền chỉ áp cho đơn chuyển khoản (đơn tiền mặt chưa từng trả trước)

---

## Giai đoạn 6 — DISP / RATE / NOTIF / CHAT [MVP]

### FE-1
- [ ] Patient Web — tạo khiếu nại + tải tối đa 5 file bằng chứng
- [ ] Patient Web — form đánh giá điều dưỡng sau ca
- [ ] Patient Web — trung tâm thông báo
- [ ] Component chat dùng chung (FE-1 chủ trì, FE-2 dùng lại cho phía điều dưỡng)

### FE-2
- [ ] Nurse Web + App — phản hồi khiếu nại
- [ ] Nurse Web + App — đánh giá khách hàng sau ca
- [ ] Nurse Web + App — chat với khách (dùng lại component của FE-1)
- [ ] Nurse Web + App — màn hình TrustScore cá nhân: điểm hiện tại, lịch sử cộng/trừ, cảnh báo khi gần mốc 60

### BE-1
- [ ] `reviews-trustscore` (FR-RATE-01): `POST /api/v1/bookings/:id/reviews` — mở tại `COMPLETED`, không chờ quyết toán
- [ ] `reviews-trustscore`: đánh giá ẩn (`is_visible = false`) tới khi cả 2 bên cùng gửi hoặc sau 7 ngày — job lật hiển thị, không tính lúc đọc
- [ ] `reviews-trustscore`: TrustScore −5 hủy > 12h · −20 hủy gấp · −25 khiếu nại đúng · +2/ca từ 4 sao trở lên, tối đa 100
- [ ] `reviews-trustscore`: TrustScore < 60 → `SUSPENDED`

### BE-2
- [ ] `chat` (FR-CHAT-01): chat/gọi trong app, mở từ khi đơn `CONFIRMED`
- [ ] `chat`: che số điện thoại hai phía — không lộ số thật ở bất kỳ màn hình/API nào
- [ ] `chat`: quét nội dung chứa SĐT/link ngoài → cảnh báo người gửi + ghi log
- [ ] `chat`: lịch sử lưu làm bằng chứng khiếu nại (không xóa cứng); đóng khi đơn kết thúc, Admin đọc dạng bằng chứng có ghi audit

### BE-3 (chủ trì giai đoạn)
- [ ] `disputes` (FR-DISP-01): `POST /api/v1/bookings/:id/disputes` — mở từ `IN_PROGRESS` tới check-out +24h, tối đa 5 file bằng chứng
- [ ] `disputes`: mở khiếu nại là đóng băng quyết toán của đơn ngay lập tức
- [ ] `disputes`: `PATCH /api/v1/admin/disputes/:id/resolve` — MVP chỉ 2 kết quả: hoàn 100% cho khách hoặc giải ngân 100% cho điều dưỡng
- [ ] `disputes`: khiếu nại đúng trên đơn tiền mặt → trừ tiền bồi thường từ ký quỹ của điều dưỡng vi phạm
- [ ] `notifications` (FR-NOTIF-01): push FCM ưu tiên cao + trung tâm thông báo trong app + WebSocket thời gian thực
- [ ] `notifications`: SMS/ZNS fallback khi sự kiện khẩn 60 giây chưa được xác nhận

### Cổng ra Giai đoạn 6
- [ ] Khiếu nại mở ở giờ 20 sau check-out chặn được quyết toán ở giờ 24
- [ ] Chu trình đánh giá ẩn 2 chiều chạy đúng (cả 2 cùng gửi → hiện; 1 bên gửi → hiện sau 7 ngày)
- [ ] SMS fallback kích hoạt đúng khi push không được xác nhận sau 60 giây
- [ ] Chat không dùng được trước `CONFIRMED`

---

## Giai đoạn 7 — ADMIN: Danh mục, Cấu hình & Đối soát [MVP]

### FE-1 (chủ trì giai đoạn)
- [ ] Admin Web — quản lý danh mục dịch vụ: thêm/sửa, cờ xâm lấn / cấm / tier yêu cầu
- [ ] Admin Web — màn hình sửa `system_configs`
- [ ] Admin Web — quản lý người dùng: tìm kiếm, chi tiết, khóa/mở khóa khách và điều dưỡng
- [ ] Admin Web — hàng đợi khiếu nại
- [ ] Admin Web — báo cáo đối soát tài chính + xuất báo cáo
- [ ] Mọi phiên Admin Web đều qua cổng 2FA (Giai đoạn 1)

### FE-2
- [ ] Hỗ trợ FE-1 hàng đợi duyệt hồ sơ / khiếu nại trong Admin Web
- [ ] Rà soát toàn bộ bề mặt điều dưỡng theo chuẩn Elder-Friendly trước UAT

### BE-1 (chủ trì giai đoạn)
- [ ] `admin-catalog` (FR-ADMIN-01): CRUD danh mục dịch vụ gồm `is_invasive`, `is_prohibited`, `required_tier`
- [ ] `admin-configs`: sửa cấu hình §5.1 không cần sửa code; mọi thay đổi ghi audit kèm `updated_by`

### BE-2
- [ ] `admin-users`: tìm kiếm/chi tiết người dùng; khóa/mở khóa theo `ACTIVE` / `SUSPENDED` / `BANNED`, tôn trọng `profile_status` là nguồn quyết định quyền nhận ca

### BE-3
- [ ] `admin-finance` (CT-15): báo cáo đối soát — tổng tiền đang tạm giữ, tổng hoa hồng 15% nền tảng, tổng đã chi trả, tổng hoàn tiền, rút tiền chờ duyệt

### Cổng ra Giai đoạn 7
- [ ] Mô phỏng trọn 1 ngày vận hành chỉ bằng giao diện Admin: duyệt hồ sơ, xử lý khiếu nại, đổi 1 cấu hình, xuất đối soát
- [ ] Không sửa database bằng tay ở bất kỳ bước nào
- [ ] Mọi thao tác Admin đều có `audit_logs`

---

## Giai đoạn 8 — Hardening & Sẵn sàng MVP

### FE-1
- [ ] Kiểm tra responsive Patient + Admin Web trên Chrome/Safari/Edge/Firefox (2 phiên bản gần nhất)
- [ ] Sửa toàn bộ lỗi UAT phía khách / Admin

### FE-2
- [ ] Kiểm thử Nurse App trên thiết bị thật đời cũ: Android 8.0 / iOS 13
- [ ] Dung lượng cài app < 50 MB
- [ ] Rà soát Elder-Friendly lần cuối + sửa lỗi UAT phía điều dưỡng

### BE-1
- [ ] Cứng hóa bảo mật định danh: chống brute-force OTP, cửa sổ xem bệnh án, bypass tier-gate
- [ ] Khắc phục phát hiện pentest thuộc miền định danh/hồ sơ

### BE-2
- [ ] Kiểm thử race condition ở ghép ca + job queue
- [ ] Diễn tập sao lưu/phục hồi: snapshot hằng ngày + PITR — RPO ≤ 1h (ví) / ≤ 24h (log), RTO ≤ 4h
- [ ] Không lịch bảo trì trong khung chuyển ca 19:00–21:00

### BE-3
- [ ] Kiểm thử race condition ví / webhook
- [ ] Cảnh báo vận hành: job tồn đọng, webhook lỗi, SOS chưa xác nhận, hoa hồng quá hạn
- [ ] Hoàn thiện runbook sự cố trong `docs/runbooks/`
- [ ] Khắc phục phát hiện pentest thuộc miền tiền

### Cổng ra Giai đoạn 8 (Go-live)
- [ ] Toàn bộ ma trận RTM của SRS xanh
- [ ] Không còn lỗi Blocker/Critical mở
- [ ] Pentest độc lập đạt: mọi phát hiện Critical/High đã xử lý
- [ ] Diễn tập vận hành (Tier 9) hoàn thành
- [ ] Product Owner ký duyệt go-live MVP

---

## Phạm vi không làm trong MVP (tick = đã xác nhận cả nhóm đều biết)

- [ ] Đấu thầu hợp đồng dài hạn + ca thử việc (FR-BOOK-04) — Giai đoạn 2 của sản phẩm
- [ ] Vòng đời hợp đồng dài hạn: tạm dừng / đổi người giữa kỳ / kết thúc sớm (FR-BOOK-05) — Giai đoạn 2
- [ ] Phân xử khiếu nại chia tỉ lệ → `PARTIALLY_SETTLED` (FR-DISP-02) — Giai đoạn 2; enum có trong schema nhưng không luồng MVP nào được sinh ra
- [ ] `partial-settlement` module — không xây trong MVP
- [ ] `contract-bidding`, `contract-lifecycle` modules — không xây trong MVP
- [ ] Gói chăm sóc định kỳ / subscription — chưa có trong SRS
- [ ] Elder-Friendly cho Patient App — Giai đoạn 2 (MVP chỉ bắt buộc phía điều dưỡng)
- [ ] Deep AI eKYC liveness — giai đoạn thương mại; MVP dùng chụp trực tiếp + đóng dấu server timestamp/GPS
- [ ] Escrow qua trung gian thanh toán được cấp phép — MVP là escrow mô phỏng (sổ cái nội bộ + cổng sandbox), không diễn đạt là escrow được cấp phép

## Checklist cho mọi Pull Request (áp dụng mọi giai đoạn)

- [ ] Mô tả PR ghi rõ mã FR / CT / TC liên quan, giai đoạn và module
- [ ] Không có số nghiệp vụ §5.1 nào bị hardcode; không định nghĩa enum ngoài `packages/shared`
- [ ] Route mới/sửa có kiểm tra quyền ở backend (kèm test âm tính: sai tier / sai chủ sở hữu / hết cửa sổ → HTTP 403)
- [ ] Thay đổi về tiền: bút toán append-only có `idempotency_key`, không UPDATE/DELETE `wallet_transactions`, không dùng ký quỹ thu hoa hồng, quyết định tự động có `audit_logs`
- [ ] Hẹn giờ mới đăng ký vào job queue, có test fake-clock, chạy lại an toàn (idempotent)
- [ ] Toàn bộ test của module xanh; module tiền/quyền/tier-gate đạt ≥ 80% độ bao phủ nhánh quyết định
- [ ] CI xanh: unit test, migration + constraint test PostgreSQL, quét secret
- [ ] PR đụng auth/OTP, phân quyền, tier-gate, tiền, hồ sơ bệnh án: có security reviewer duyệt
- [ ] Cập nhật tài liệu trong cùng PR: `README.md` của module, `docs/api/<module>.api.md` nếu contract đổi, ADR nếu có quyết định kỹ thuật mới

## Nhịp phối hợp trong mỗi giai đoạn

- [ ] Đầu giai đoạn: BE owner công bố contract API (`/api/v1/...`, request/response mẫu, mã lỗi) tại `docs/api/<module>.api.md` + dữ liệu mẫu
- [ ] Giữa giai đoạn: FE dựng màn hình bằng mock theo contract; BE code logic + test theo Test Strategy
- [ ] Thay đổi contract phải báo cho FE ngay trong ngày
- [ ] Cuối giai đoạn: ghép thật FE ↔ BE trên staging, chạy mục "Cổng ra", cả 5 người cùng ký nhận mới sang giai đoạn kế
- [ ] Việc của người này chặn người kia quá 1 ngày → nêu ngay ở standup; không tự sửa module của miền khác khi chưa qua owner
