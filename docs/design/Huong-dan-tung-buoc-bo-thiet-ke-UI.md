# Hướng dẫn từng bước — Bộ thiết kế UI CareNest

Dành cho Phúc và nhóm FE đi qua toàn bộ bộ thiết kế theo đúng thứ tự.
Tổng: **5 board HTML (61 màn/khung) + DESIGN.md + landing page**. Mọi board mở
trực tiếp bằng trình duyệt, không cần build, có tương tác bấm thử được.

---

## Bước 0 — Chuẩn bị (2 phút)

1. Vào thư mục `files/` của gói bàn giao.
2. Chuẩn bị sẵn một tab trình duyệt — mỗi board là 1 file `.html` độc lập.
3. Nguyên tắc đi đường: **đọc luật trước (Bước 1), xem màn sau (Bước 2–6)** —
   nếu xem màn trước sẽ không hiểu vì sao các màn bị "khóa" một số thứ.

## Bước 1 — Đọc DESIGN.md trước (file luật, ~15 phút)

Mở `files/DESIGN.md`. Đây là tài liệu điều hành của cả bộ. Đọc theo thứ tự:

1. **Mục 3 (Token màu)** — ghi nhớ 3 màu nòng cốt: primary `#166B58`,
   navy `#143F34` cho tiêu đề, teal `#1E9E50` chỉ cho thành công/đã xác thực.
2. **Mục 6 (NAV-0)** — chuẩn điều hướng khóa: navbar web từng vai trò, biến thể
   SETUP, bottom nav app, sidebar Admin 10 mục. Mọi màn ở các bước sau đều phải
   đối chiếu được với mục này.
3. **Mục 9.2 (Danh sách cấm)** — những thứ tuyệt đối không xuất hiện (hotline,
   tuyên bố Bộ Y Tế, FaceMatch/OCR, "rút tiền tức thì"…). Đây là checklist để
   tự rà soát khi xem từng board.
4. **Mục 9.3 (Vũ trụ dữ liệu mẫu)** — bảng người/mã đơn/số tiền khóa. Từ đây
   về sau, thấy bất kỳ màn nào lệch các số này là có lỗi.

## Bước 2 — Board SH: dùng chung & xác thực (6 màn)

Mở `SH-design/SH-screens.html`, cuộn theo thanh điều hướng SH1→SH6 ở đầu board:

1. **SH1/SH2** — đăng nhập SĐT + OTP: thử gõ OTP (ô tự nhảy), xem đếm ngược gửi
   lại mã chạy thật, bấm đổi thẻ vai trò. Lưu ý: hai màn này **cố ý không có
   navbar**; biến thể Admin ở SH1 chỉ ghi 2FA chung chung.
2. **SH3** — eKYC khách: nhận diện navbar biến thể SETUP (logo + chip + avatar),
   stepper nằm trong thân trang, giấy tờ ở trạng thái "Chờ Admin duyệt".
3. **SH4** — onboarding điều dưỡng: cuộn tới khối dịch vụ — **Nhóm 3 phải ở dạng
   khóa 🔒**, không chọn được. Đây là điểm Stitch từng vẽ sai.
4. **SH5/SH6** — navbar Nurse đầy đủ: bấm avatar để đóng/mở menu; SH6 mở sẵn
   menu và có 3 banner trạng thái tài khoản (chờ duyệt / tạm khóa / khóa vĩnh
   viễn). Đối chiếu số GPHN hết hạn 12/04/2027 và ví 3.850.000đ giữa hai màn.

## Bước 3 — Board P: phía khách hàng (13 màn)

Mở `P-design/P-screens.html`:

1. **P1** — trang chủ: carousel + bento **chỉ có ở màn này** (quy tắc component
   đúng chỗ). Các màn sau mà thấy bento/carousel là sai chuẩn.
2. **P4** — hồ sơ điều dưỡng: kiểm tra **không có TrustScore** (chủ đích — khách
   không được thấy), nút Nhắn tin bị khóa kèm lý do.
3. **P5** — đặt lịch: dừng ở Bước 3 — tải y lệnh là **bắt buộc** với dịch vụ
   xâm lấn; có lựa chọn Radar / chọn điều dưỡng.
4. **P6** — thanh toán: đếm ngược 15 phút chạy thật; xem 2 biến thể (đã thanh
   toán / hết hạn) ở cuối màn.
5. **P8** — chi tiết đơn: tự kiểm toán hoàn hủy — 500.000đ + 80.000đ phụ phí
   đêm = 580.000đ; hủy còn 6 giờ → hoàn 80% = 464.000đ.
6. Lướt nhanh phần còn lại: P7 (chip 3 trục trên thẻ đơn), P9 (khung điện thoại
   ca trực tiếp), P10 (đánh giá ẩn hai chiều), P11–P13 (khiếu nại, ví khách,
   hồ sơ người bệnh + vùng nguy hiểm dữ liệu).

## Bước 4 — Board N: phía điều dưỡng web (15 màn)

Mở `N-design/N-screens.html`. Kiểm tra xuyên suốt: chữ ≥17px, nút lớn
(elder-friendly):

1. **N1/N2** — trang chủ + Job Board: có biến thể việc xâm lấn **bị khóa** với
   tài khoản Cấp 1.
2. **N6** — check-in: vòng 200m, selfie trực tiếp, biến thể chặn mock-location.
3. **N9→N10→N11→N12** — chuỗi tiền, đi theo thứ tự: ví 3 ngăn → ký quỹ chỉ trừ
   phạt SLA → nộp hoa hồng VietQR hạn 24h → rút tiền (số dư 3.850.000đ, tài
   khoản •••• 6899 — khớp SH6 ở Bước 2).
4. **N15** — TrustScore thang 100 với bảng mốc +2/−5/−20/−25.

## Bước 5 — Board A: Admin console (10 màn)

Mở `A-design/A-screens.html`:

1. Kiểm tra sidebar: đủ 10 mục đúng thứ tự ở **mọi** màn, mục đang đứng sáng.
2. **A2→A3** — đi theo luồng duyệt: hàng đợi → mở hồ sơ Phạm Thu Hà → xem giấy
   tờ bằng lightbox → quyết định gán Cấp. Chú ý dòng khóa: quyết định nghỉ hưu
   chỉ gắn huy hiệu.
3. **A8** — cấu hình: đếm đủ **11 khóa §5.1** và đối chiếu giá trị với SRS
   (0.15 · 300000 · 0.20 · 3.00 · 2.00 · 0.15 · 15 · 24 · 200 · 50000 · 50000).
4. **A5** — khiếu nại: lựa chọn "chia một phần" bị khóa nhãn Giai đoạn 2.
5. **A10** — SOS trực tuyến + nhật ký kiểm toán: nơi mọi thao tác nhạy cảm ở
   các màn trước đổ về.

## Bước 6 — Board APP: mobile (17 khung)

Mở `App-design/app-screens.html`:

1. **APP-P (6 khung)** — Patient App: onboarding → trang chủ → dịch vụ → đơn →
   chat → tài khoản. Kiểm tra bottom nav 5 mục luôn ở đáy, mục đang đứng sáng;
   màn chat có ghi chú che số + chat chỉ mở khi có đơn đã xác nhận.
2. **APP-N (5 khung)** — Nurse App: trang chủ (công tắc nhận ca lớn) → việc làm
   (giá kèm số thực nhận sau hoa hồng) → ca của tôi → ví 3 ngăn → tài khoản.
3. **Luồng ca (6 khung)** — đi liền mạch theo một ca HC-2026-1042:
   **N5** xem chi tiết (có lưu ý dị ứng Penicillin) → **N6a** GPS 42m trong vòng
   200m → **N6b** selfie trực tiếp có đóng dấu → **N6c** thành công →
   **N7** trong ca (checklist khớp mốc giờ với P9 phía khách) → **N8** check-out
   15:20 + báo cáo + quyết toán dự kiến 425.000đ.

## Bước 7 — Landing page (tùy chọn, 1 trang)

Mở `landing-page/index.html` — trang giới thiệu dự án, cùng chuẩn thiết kế.
Trạng thái: **chưa đăng công khai**; muốn có link chia sẻ thì cần một bước đăng
riêng.

## Bước 8 — Đưa vào repo nhóm

1. `DESIGN.md` → `docs/design/DESIGN.md` (thư mục design đã có sẵn trong repo,
   đang chứa các file .drawio).
2. 5 board HTML → `docs/design/ui-boards/` (đặt cạnh DESIGN.md để tham chiếu
   không gãy).
3. Kỷ luật repo như cũ: chỉ commit đúng các file này, **không push khi chưa có
   lệnh riêng của Phúc cho lần push đó**.

## Bước 9 — Chia việc cho FE theo board

| Người phụ trách surface | Board cần mở | Ghi chú |
|---|---|---|
| FE phía Patient Web + Admin Web | P + A + SH | SH là phần dùng chung, đọc trước |
| FE phía Nurse Web + Nurse App | N + APP + SH | Ưu tiên elder-friendly và luồng ca ở APP |
| Cả nhóm | DESIGN.md + file index bàn giao | DESIGN.md là luật; index là tờ bàn giao tóm tắt |

(Việc gán tên người thật vào FE-1/FE-2 vẫn đang chờ Phúc chốt — bảng này chỉ
theo surface, không gán người.)

## Bước 10 — Khi cần sửa một màn hình

1. Nếu thay đổi thuộc về **token/điều hướng/quy tắc** → sửa `DESIGN.md` trước,
   rồi mới sửa board bị ảnh hưởng. Không sửa lẻ trong một board.
2. Nếu chỉ sửa nội dung một màn → sửa trực tiếp file board đó, giữ nguyên dữ
   liệu mẫu ở mục 9.3 của DESIGN.md.
3. Sửa xong tự rà bằng danh sách cấm (mục 9.2): tìm trong file các chuỗi
   `CareVietnam`, `1900`, `FaceMatch`, `Bộ Y Tế` — phải không còn kết quả nào.

## Phụ lục — Các file .md liên quan, ai nên đọc

| File | Vai trò | Ai đọc |
|---|---|---|
| `DESIGN.md` | Luật thiết kế điều hành | Cả nhóm, đọc đầu tiên |
| `UI-handoff-index.md` | Tờ bàn giao tóm tắt cho FE (chỉ mục + điểm cần xem kỹ + điểm chưa chốt) | Trưởng nhóm/FE khi nhận việc |
| `navbar-header-sh/Prompt-NAV-0-navbar-header-chuan.md` | Nguồn gốc chi tiết của chuẩn điều hướng | Khi tranh luận về navbar/header |
| `bo-prompt-stitch-ui-srs-v2.md` | Bộ prompt gốc đã dùng để định nghĩa 60 màn — nay là hồ sơ tham khảo, board HTML mới là nguồn sự thật | Khi cần tra ý đồ ban đầu của một màn |
| `Prompt-sua-SH-Stitch.md` | Hồ sơ lịch sử đợt sửa Stitch | Chỉ để tra cứu, không dùng nữa |
