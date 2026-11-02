# DESIGN.md — HealthCareSystem Design System

> **Tài liệu thiết kế điều hành (single source of truth) cho giao diện HealthCareSystem.**
> Phiên bản 1.0 · Cập nhật 02/11/2026 · Baseline nghiệp vụ: **SRS v2.0 Updated**
> Tài liệu này thay thế hoàn toàn DESIGN.md do Stitch sinh (bản đó trôi token — primary #004AC6, sai font — không dùng).
> Vị trí trong repo: `docs/design/DESIGN.md` — các board HTML đi kèm nằm tại `docs/design/ui-boards/` (bảng mục 10 giữ đường dẫn gốc trong gói bàn giao).
> Nguồn chuẩn thành phần: `navbar-header-sh/Prompt-NAV-0-navbar-header-chuan.md` (NAV-0) và bộ board HTML đã duyệt (mục 10).

---

## 1. Thương hiệu

| Hạng mục | Quy định |
|---|---|
| Tên sản phẩm | **HealthCareSystem** (viết liền, đúng chính tả này ở mọi nơi) |
| Logo mark | Ô vuông bo góc 12px nền `#2563EB`, dấu **+** trắng đậm ở giữa |
| Wordmark | "HealthCareSystem" — Be Vietnam Pro 800, màu navy `#0B3C6C` |
| Tính cách | Y tế, tin cậy, sáng sủa; xanh dương — trắng là chủ đạo |
| Cấm | Đổi tên thương hiệu (vd "CareVietnam"), thêm slogan/tuyên bố tự chế |

## 2. Nguyên tắc thiết kế

1. **Một màu chính duy nhất** — `#2563EB`. Mọi điểm nhấn đều quay về màu này; không thêm hue thứ ba.
2. **Màu ngữ nghĩa dùng đúng nghĩa** — teal = thành công/đã xác thực, amber = chờ/cảnh báo, orange = tạm khóa, red = lỗi/nguy hiểm/SOS. Không dùng các màu này để trang trí.
3. **Mỗi component sinh động chỉ xuất hiện đúng chỗ đã chỉ định** ("thêm cho đỡ nhạt nhưng đừng quá màu mè"): bento grid chỉ ở trang chủ/dashboard, carousel chỉ ở hero trang chủ Patient + onboarding app, lightbox chỉ cho ảnh/giấy tờ, một ô gradient tối đa trên một màn.
4. **Nurse = elder-friendly bắt buộc** (điều dưỡng lớn tuổi): chữ to, nút to, vùng chạm rộng (mục 8).
5. **Không bịa nội dung** — không hotline, không tuyên bố cơ quan quản lý, không tính năng ngoài SRS (mục 9).
6. **Dữ liệu mẫu khóa** — mọi màn dùng chung một vũ trụ dữ liệu (mục 9.3); không tự chế tên người, số tiền, mã đơn.

## 3. Màu sắc (tokens)

| Token | Hex | Dùng cho |
|---|---|---|
| `--blue` | `#2563EB` | Màu chính: nút primary, link, trạng thái active, logo |
| `--blue-dark` | `#1D4ED8` | Hover/pressed của primary |
| `--sky` | `#38BDF8` | Đầu gradient hero (royal → sky), điểm nhấn phụ hiếm hoi |
| `--navy` | `#0B3C6C` | Tiêu đề (H1/H2), wordmark, chữ nhấn |
| `--ink` | `#0F2540` | Chữ nội dung chính |
| `--slate` | `#4A6076` | Chữ phụ, mô tả |
| `--muted` | `#7A8FA6` | Chữ mờ, nhãn phụ, placeholder |
| `--bg` | `#F5F9FC` | Nền trang/board |
| `--line` | `#E1EBF5` | Viền thẻ, đường kẻ |
| `--teal` | `#0D9488` | Thành công, đã xác thực, hoàn thành (nền nhạt `#ECFDF5`) |
| `--amber` | `#B45309` (nền `#FEF3C7` / `#FFFBEB`) | Chờ duyệt, cảnh báo nhẹ, huy hiệu hưu trí, điểm sao |
| `--orange` | `#EA580C` (nền `#FFF7ED`) | Tạm khóa nhận ca, trạng thái trung gian nghiêm trọng |
| `--red` | `#DC2626` (nền `#FEF2F2`) | Lỗi, SOS, khóa vĩnh viễn, quá hạn |

Quy tắc gradient: chỉ dùng gradient royal `#2563EB` → navy/sky cho **hero** (landing page, carousel P1). Còn lại nền phẳng trắng/xanh nhạt.

## 4. Typography

- **Font duy nhất: Be Vietnam Pro** (Google Fonts) — chọn vì dấu tiếng Việt đẹp và rõ. Không dùng Inter.
- Thang cỡ (web): H1 `24–25px/800` · H2 `19–21px/800` · H3/thẻ `16–18px/700` · Body `15–16px` · Phụ `13–14px` · Nhãn nhỏ `12–12.5px`.
- Elder (mọi surface Nurse): Body `≥17px` · tiêu đề thẻ `≥17.5px` · ô nhập `17px`.
- Số tiền và số liệu quan trọng luôn `700–900` màu navy để quét nhanh.

## 5. Layout, bo góc, đổ bóng

| Hạng mục | Giá trị |
|---|---|
| Khung nội dung web | max-width `1180px` (Admin console `1280px`), padding trang `38px` ngang / `30px` dọc |
| Khung điện thoại app | `392px`, bo góc `34px` |
| Bo góc thẻ | `16px` (ô con `12–14px`, chip/nút tròn `999px`) |
| Đổ bóng thẻ | `0 18px 40px -18px rgba(11,60,108,.22)` · bóng nhẹ `0 6px 20px -8px rgba(11,60,108,.16)` |
| Khoảng cách lưới | `14–22px` giữa các thẻ; section cách nhau `18–26px` |

## 6. Chuẩn điều hướng (NAV-0 — khóa)

> Đổi điều hướng = sửa tại tài liệu này/NAV-0 rồi áp đồng loạt; **không** sửa riêng trong từng màn hình.

### 6.1 Web — Navbar (Patient & Nurse), cao 60px, một hàng
- Trái: logo. Giữa: tối đa 5 link chữ. Phải: chuông (badge số chưa đọc) + khối avatar (avatar + tên + chip vai trò + ▾).
- **Patient:** Trang chủ · Dịch vụ · Đơn của tôi · Tin nhắn · Tài khoản
- **Nurse:** Trang chủ · Việc làm · Ca của tôi · Ví · Tài khoản
- Link đang đứng: chữ `--blue` + gạch chân 2.5px.
- **Biến thể SETUP** (luồng lần đầu SH3/SH4): chỉ logo + chip trạng thái + avatar — không link, không chuông.
- **Không navbar:** SH1/SH2 (thẻ auth giữa màn hình).

### 6.2 Page header (tách riêng khỏi navbar)
Một mẫu duy nhất: **H1 24px navy + một dòng mô tả phụ + tối đa 2 nút hành động** bên phải. Cấm đưa logo, điều hướng, ô tìm kiếm, chip lọc hay số liệu thống kê vào page header. Hàng tìm kiếm/lọc là **toolbar** nằm trong thân trang; **stepper** nằm trong thẻ ở thân trang, không dính vào header.

### 6.3 Menu avatar (dropdown)
Mở khi bấm khối avatar; gồm khối đầu (avatar lớn + tên + SĐT che) và các mục theo vai trò:
- **Patient:** Hồ sơ cá nhân · Hồ sơ người được chăm sóc · Thanh toán của tôi · Thông báo · Cỡ chữ & hiển thị · Quyền riêng tư & dữ liệu · Hỗ trợ · Đăng xuất
- **Nurse:** Hồ sơ cá nhân · Giấy tờ & GPHN · Ví của tôi · Thông báo · Cỡ chữ & hiển thị · Quyền riêng tư & dữ liệu · Hỗ trợ · Đăng xuất

### 6.4 Mobile App
- **Top strip** 56px: logo + chuông + avatar (vào hội thoại chat thì thay bằng header chat).
- **Bottom nav 5 mục khóa** (icon + nhãn 11.5px, mục active màu `--blue`, badge đỏ cho mục có việc chờ):
  - Patient: Trang chủ · Dịch vụ · Đơn của tôi · Tin nhắn · Tài khoản
  - Nurse: Trang chủ · Việc làm · Ca của tôi · Ví · Tài khoản
- Màn hình luồng tác vụ (check-in, trong ca, check-out): header riêng (✕ + tên bước), **không** bottom nav.

### 6.5 Admin — Sidebar console (ngoại lệ duy nhất được dùng sidebar)
Sidebar trái cố định, đúng 10 mục theo thứ tự: **Tổng quan · Duyệt hồ sơ · Đặt lịch · Khiếu nại · Tài chính · Dịch vụ · Cấu hình · Người dùng · SOS · Nhật ký**. Đầu sidebar: logo; cuối sidebar: khối Admin đang đăng nhập + ghi chú 2FA. Patient/Nurse tuyệt đối không dùng sidebar.

## 7. Components

| Component | Quy định |
|---|---|
| Nút primary | Nền `--blue`, chữ trắng, cao `50–52px` (elder `56–60px`), bo `13px` |
| Nút secondary | Trắng, viền `--line`, chữ navy |
| Nút danger | Nền `--red` — chỉ cho SOS, nộp hoa hồng quá hạn, hành động hủy/khóa |
| Ô nhập | Cao `50px` (elder `56–58px`), viền 1.5px `--line`, focus viền `--blue` |
| Chip trạng thái | Bo `999px`, nền nhạt theo màu ngữ nghĩa, chữ `12.5–13.5px/700` |
| **Chip đơn 3 trục** | Đơn luôn mang 3 chip độc lập: **Thực hiện** (Chờ thanh toán → Chờ ghép ca → Sắp diễn ra → Đang diễn ra → Hoàn thành / Đã hủy) · **Thanh toán** (Chưa thanh toán / Đã tạm giữ / Tiền mặt / Đã quyết toán / Đã hoàn) · **Khiếu nại** (Không / Đang khiếu nại / Đã phân xử) |
| Thẻ (card) | Trắng, viền `--line`, bo `16px`, bóng nhẹ |
| Stepper | Nằm trong thân trang; bước xong = teal ✓, đang làm = vòng xanh số trắng, chưa tới = xám |
| Upload giấy tờ | Ô dashed; trạng thái tệp dùng chip "Đã tải lên · Chờ Admin duyệt" (thẩm định **thủ công**, không OCR/FaceMatch ở MVP) |
| Banner trạng thái | Amber = chờ duyệt · Orange = tạm khóa (kèm lý do + CTA xử lý) · Red = khóa vĩnh viễn (kèm lối gửi yêu cầu xem xét) |
| Timeline | Đường dọc + chấm trạng thái (xong teal, hiện tại xanh, chưa tới xám), mốc giờ in đậm |
| Ví 3 ngăn | **Khả dụng / Tạm giữ (đang chờ quyết toán) / Ký quỹ** — luôn tách bạch, ký quỹ ghi rõ "chỉ dùng trừ phạt SLA" |
| VietQR | Khung QR + chip cổng (PayOS / VNPay / VietQR) + dòng giải thích "hệ thống tạm giữ" |
| Bản đồ | Placeholder cách điệu + pin; vòng tròn đứt nét 200m cho check-in |
| Bảng Admin | Mật độ cao, chữ `14px`, header bảng chữ hoa nhỏ, hàng hover |
| Lightbox | Chỉ để xem ảnh/giấy tờ (hồ sơ điều dưỡng, y lệnh, bằng chứng khiếu nại) |
| Bento / Carousel | **Chỉ** trang chủ Patient (P1 + APP-P1 rút gọn) và onboarding app; nơi khác cấm |
| SOS | Nút đỏ lớn toàn bề ngang; nhãn đúng giao thức: "SOS — Gọi 115 & báo người nhà/Admin" |

## 8. Quy tắc theo vai trò

**Patient**
- **Không hiển thị TrustScore** của điều dưỡng (chỉ sao ★, số ca hoàn thành, đánh giá đã mở).
- Nút nhắn tin/gọi khóa cho tới khi có đơn được xác nhận; số điện thoại hai phía luôn che (`0905 ••• 123`), có ghi chú quét rò rỉ SĐT trong chat.
- Đánh giá hai chiều dạng ẩn: chỉ hiện khi cả hai đã gửi hoặc sau 7 ngày.

**Nurse (elder-friendly)**
- Mọi chữ nền `≥17px`, nút chính `≥56px`, vùng chạm `≥48px`; có mục "Cỡ chữ lớn" bật mặc định trong cài đặt.
- Giá việc hiển thị kèm **số thực nhận sau hoa hồng 15%** (vd 500.000đ → 425.000đ).
- Check-in bắt buộc đủ 3 minh chứng: GPS ≤ 200m + chống mock location + selfie trực tiếp đóng dấu giờ máy chủ/tọa độ (cấm chọn ảnh thư viện).

**Admin**
- Mật độ dữ liệu cao được phép (bảng 14px); mọi thao tác nhạy cảm hiển thị ghi chú audit (ai làm, lúc nào) và xuất hiện ở màn Nhật ký.
- Quyết định phân xử "chia một phần" bị khóa kèm nhãn **Giai đoạn 2** (ngoài MVP).

## 9. Nội dung & dữ liệu

### 9.1 Định dạng
- Tiền VNĐ: phân tách nghìn bằng dấu chấm, hậu tố `đ` — vd `500.000đ`, `3.850.000đ`. Không dùng "k", không dùng dấu phẩy.
- Chia tiền ca: điều dưỡng **85%** / nền tảng **15%** (500.000đ → 425.000đ / 75.000đ).
- TrustScore: **thang 100** (vd `92/100`); mốc điểm: `+2` ca tốt · `−5` hủy gấp phía điều dưỡng · `−20` vi phạm SLA · `−25` khiếu nại đúng; dưới `60` → tạm khóa.
- Phụ phí cộng trên giá gốc theo giờ thực tế thuộc khung: Đêm (22:00–06:00) `+20%` · Lễ lớn/Tết `+300%` · Lễ nhỏ `+200%` · Bệnh nhân nặng (nằm tại giường hoặc ≥80 kg) `+15%`.
- Ký quỹ điều dưỡng `300.000đ`, **chỉ** trừ phạt SLA. Hoa hồng ca tiền mặt: điều dưỡng **tự nộp** qua VietQR trong 24h sau check-out, không trừ từ ví.
- Quyết toán: sau check-out **24 giờ** hoặc khách xác nhận hài lòng sớm.
- SOS: mở cuộc gọi **115** + báo người nhà & Admin. Không tồn tại "trung tâm điều phối SOS" riêng.

### 9.2 Danh sách cấm (fabrication ban list)
Không xuất hiện dưới bất kỳ hình thức nào trong UI:
- Số hotline bất kỳ (1900 xxxx…), tên thương hiệu lạ (CareVietnam…).
- Tuyên bố thẩm định/chứng nhận của Bộ Y Tế hoặc cơ quan quản lý.
- "FaceMatch", "OCR", "eKYC tự động", "EMR" — MVP thẩm định thủ công bởi Admin.
- "Rút tiền tức thì 24/7" (điều khoản rút tiền chưa chốt).
- TrustScore thang 5.0; dịch vụ **Nhóm 3 (cấm tuyệt đối)** ở dạng chọn được/bán được — chỉ hiển thị dạng danh sách khóa với giải thích.

### 9.3 Vũ trụ dữ liệu mẫu khóa (sample-data registry)
| Đối tượng | Giá trị khóa |
|---|---|
| Khách hàng | Nguyễn Văn An · 0905 ••• 123 · Hải Châu, Đà Nẵng |
| Người bệnh chính | Bà Nguyễn Thị Hoa · 78 tuổi (sinh 1948) · 52 kg · hỗ trợ di chuyển · dị ứng Penicillin · địa chỉ 25 Quang Trung, Hải Châu 1, Đà Nẵng |
| Điều dưỡng 1 | Trần Thị Mai · Cấp 2 · TrustScore 92/100 · 4.9★ · huy hiệu hưu trí · GPHN `00976/GPHN-ĐN` hết hạn **12/04/2027** · ví khả dụng 3.850.000đ · NH Vietcombank •••• 6899 |
| Điều dưỡng 2 | Phạm Thu Hà · Cấp 2 · GPHN `01284/GPHN-ĐN` cấp 15/05/2020, hết hạn **15/05/2027** (hồ sơ mẫu cho luồng duyệt) |
| Điều dưỡng 3 | Nguyễn Văn Hùng · Cấp 1 · TrustScore 85/100 (mẫu cho việc bị khóa theo cấp & phạt ký quỹ) |
| Đơn chuẩn | HC-2026-1042 thay băng 500.000đ (check-in 14:30 · check-out 15:20 · quyết toán 425.000đ) |
| Đơn ca đêm | HC-2026-1050 — 500.000đ + 80.000đ phụ phí đêm = 580.000đ (thực nhận 493.000đ) |
| Đơn tiền mặt | HC-2026-1057 ca 8 giờ — hoa hồng phải nộp 75.000đ |
| Voucher mẫu | Voucher xin lỗi 50.000đ (từ phạt điều dưỡng no-show 50.000đ) |

## 10. Bộ màn hình đã thiết kế (61 màn/khung)

| Phần | Số màn | File |
|---|---|---|
| SH — Dùng chung & xác thực | 6 (SH1–SH6) | `SH-design/SH-screens.html` |
| P — Patient (web) | 13 (P1–P13) | `P-design/P-screens.html` |
| N — Nurse (web portal) | 15 (N1–N15) | `N-design/N-screens.html` |
| A — Admin console | 10 (A1–A10) | `A-design/A-screens.html` |
| APP — Mobile (Patient 6 + Nurse 5 + luồng ca 6) | 17 khung | `App-design/app-screens.html` |
| Landing page | 1 | `landing-page/index.html` |

## 11. Chuyển động & truy cập

- Transition `≤250ms`, chỉ cho hover/mở menu/lightbox; không animation trang trí lặp.
- Trạng thái focus phải nhìn thấy được (viền `--blue` 2px).
- Độ tương phản chữ: body dùng `--ink`/`--slate` trên nền trắng/xanh nhạt; không đặt chữ `--muted` cho nội dung quan trọng.
- Mọi nút bấm có nhãn chữ rõ ràng (không nút chỉ-icon cho hành động chính).

## 12. Lịch sử thay đổi

- **v1.0 — 02/11/2026:** Ban hành từ bộ board HTML đã duyệt (SH/P/N/A/APP) + NAV-0 + M0. Thay thế DESIGN.md của Stitch (trôi token). Font chính thức: Be Vietnam Pro (thay Inter của M0 gốc). Mọi thay đổi token/điều hướng sau này sửa tại file này trước, rồi mới áp vào các board.
