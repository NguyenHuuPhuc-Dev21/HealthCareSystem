# UI handoff index — CareNest (SRS v2.0 Updated)

Mục đích: một trang duy nhất để Phúc chuyển cho nhóm FE khi bắt đầu code từ bộ
màn hình đã thiết kế tay ngày 2026-10-30. File này chỉ lập chỉ mục, không sửa
nội dung bất kỳ màn hình nào. Các file màn hình vẫn là nguồn duy nhất.

## 1. Bộ file — mở trực tiếp, không cần build

| Phần | File | Màn hình |
|---|---|---|
| Landing page (riêng, chưa đăng công khai) | `files/landing-page/index.html` (~41 KB) | 1 trang |
| SH — dùng chung & xác thực | `files/SH-design/SH-screens.html` (~57 KB) | SH1–SH6 (6) |
| P — Patient | `files/P-design/P-screens.html` (~97 KB) | P1–P13 (13) |
| N — Nurse | `files/N-design/N-screens.html` (~121 KB) | N1–N15 (15) |
| A — Admin | `files/A-design/A-screens.html` (~107 KB) | A1–A10 (10) |
| APP — Mobile App | `files/App-design/app-screens.html` (~68 KB) | APP-P0–P5 (6) + APP-N1–N5 (5) + luồng ca N5→N6(3 bước)→N7→N8 (6) = 17 khung điện thoại |
| Design system (điều hành) | `files/DESIGN.md` | Token, NAV-0, components, quy tắc dữ liệu — đọc trước khi code |

Tổng: 61 màn hình/khung. Đã kiểm lại (cập nhật 02/11/2026 sau khi bổ sung luồng
ca cho APP): đếm ID màn hình đủ 6 + 13 + 15 + 10 + 17 = 61; quét 5 file không còn CareVietnam / số 1900 /
FaceMatch / BYT; cả 5 file đều tải font Be Vietnam Pro. Phần APP lấp đúng khoảng
trống đã chỉ ra tối 2026-10-30: trước đó chỉ có khung điện thoại lẻ (P9, N3, N6)
và chưa hề có thanh tab dưới ở đâu.

## 2. Chuẩn đã khóa trong bộ này

- **Điều hướng:** NAV-0 cho Patient/Nurse (navbar một hàng 60px; SH1/SH2 không
  navbar; SH3/SH4 dùng biến thể SETUP chỉ logo + chip trạng thái + avatar).
  Admin dùng sidebar console M0 với đúng 10 mục theo thứ tự đã khóa.
  Mobile (APP): thanh trên gọn (logo + chuông + avatar) + bottom nav 5 mục đã
  khóa theo từng vai trò; ngày 02/11 APP được bổ sung luồng ca riêng
  (N5 → N6 ba bước → N7 → N8); P9 (ca trực tiếp phía khách) và N3 (Radar) vẫn là
  khung điện thoại riêng ở phần P và N.
- **Màu & font:** một màu chính #166B58; teal chỉ cho thành công/đã xác thực;
  font tải trong file là Be Vietnam Pro (quyết định Tom đưa ra khi sửa prompt SH
  ngày 2026-10-30 vì dấu tiếng Việt, ghi chú là có thể đảo ngược — nếu nhóm
  muốn về Inter của M0 thì đó là một thay đổi một dòng trong token, không phải
  vẽ lại màn hình).
- **Component đúng chỗ:** carousel + Bento chỉ ở P1; lightbox chỉ cho
  media/giấy tờ (A3); motion ≤ 250ms.

## 3. Vũ trụ dữ liệu mẫu — dùng đúng các số này khi code, đừng tự chế số mới

- Bệnh nhân mẫu: Nguyễn Thị Hoa, 78 tuổi, Đà Nẵng.
- Điều dưỡng mẫu: ĐD. Trần Thị Mai, TrustScore 92/100, GPHN hết hạn 12/04/2027,
  ví 3.850.000đ.
- Đơn mẫu: HC-2026-1042 (500.000đ, quyết toán 425.000đ); ca tiền mặt
  HC-2026-1057 nợ hoa hồng 75.000đ (quá 24h → tạm khóa).
- Hồ sơ đang duyệt: Phạm Thu Hà, GPHN 01284/GPHN-ĐN, hết hạn 15/05/2027.
- Ký quỹ 300.000đ chỉ trừ phạt SLA; hoa hồng nền tảng 15%; SOS = gọi 115 +
  báo người nhà/Admin (không có trung tâm điều phối).

## 4. Những màn nên xem kỹ trước khi code (quyết định nghiệp vụ nằm ở đó)

- **P4:** không hiển thị TrustScore cho khách; nút Nhắn tin khóa trước khi đặt.
- **P8:** toán hoàn hủy ca đêm — gốc 500.000đ + phụ phí đêm 80.000đ = 580.000đ;
  hủy còn 6 giờ → hoàn 80% = 464.000đ.
- **N6:** check-in vòng 200m + selfie trực tiếp; chặn mock-location và ngoài
  bán kính thì khóa nút.
- **N11:** nộp hoa hồng qua VietQR, nội dung gắn mã ca, đếm ngược hạn 24 giờ.
- **A3:** duyệt hồ sơ Hà, trình xem giấy tờ dạng lightbox; quyết định nghỉ hưu
  chỉ gắn huy hiệu, không mở dịch vụ xâm lấn.
- **A5:** lựa chọn "chia một phần" khi phân xử được khóa nhãn Giai đoạn 2 (ngoài
  phạm vi MVP).
- **A8:** đủ 11/11 khóa cấu hình §5.1 đúng giá trị.
- **APP:** Nurse App hiển thị số thực nhận sau hoa hồng (ca đêm 580.000đ →
  493.000đ, tiêm bắp 150.000đ → 127.500đ); chat Patient App chỉ mở khi có đơn
  đã xác nhận, số hai phía được che; ví Nurse App 3 ngăn kèm cảnh báo nộp hoa
  hồng HC-2026-1057.

## 5. Chưa chốt — đừng code những điểm này thành "luật" cho tới khi có quyết định

- Phân vai FE-1/FE-2 và BE-1/BE-2/BE-3 cho CODEOWNERS (câu hỏi Tom gửi Phúc
  sáng 2026-10-30 vẫn đang chờ trả lời; file này cố ý không gán người theo
  surface, để tránh đoán thay).
- Điều khoản rút tiền (điểm mở OD trong SRS) — các màn hình đã tránh khẳng định
  "rút tức thì 24/7".
- Landing page chưa đăng ở đâu; muốn link công khai thì cần một bước đăng riêng.

## 6. Cách chuyển cho nhóm

Gửi 5 file `SH/P/N/A-screens.html` + `App-design/app-screens.html` + `DESIGN.md` kèm file index này. Nhóm FE mở file bằng
trình duyệt là xem và bấm thử được ngay (OTP, tab lọc, menu avatar, đếm ngược
đã có tương tác thật trong file). Khi sửa màn nào, sửa trực tiếp trên file đó
và giữ nguyên vũ trụ dữ liệu mẫu ở mục 3.
