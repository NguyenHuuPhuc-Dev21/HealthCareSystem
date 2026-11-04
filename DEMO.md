# CareNest — Hướng dẫn chạy demo local

Toàn bộ hệ thống chạy trên máy local: hạ tầng bằng Docker, backend 1 tiến trình,
4 frontend mở ở 4 cổng riêng. Mở mỗi lệnh ở một terminal riêng và giữ terminal chạy.

## 1. Bản đồ cổng

| Thành phần | Địa chỉ | Ghi chú |
|---|---|---|
| Landing page | http://localhost:5177 | Trang giới thiệu — điểm bắt đầu demo |
| Patient web | http://localhost:5173 | Hiện mới là khung (chưa có màn đăng nhập bệnh nhân) |
| Admin console | http://localhost:5174 | Đăng nhập OTP + 2FA bắt buộc |
| Nurse web | http://localhost:5175 | Đăng nhập OTP, onboarding, văn bằng |
| API | http://localhost:3000/api/v1 | Kiểm tra sống: `GET /api/v1/health` |
| MinIO console | http://localhost:9001 | Xem file hồ sơ đã tải lên (user/pass trong `services/api/.env`) |
| Postgres / Redis | localhost:5432 / 6379 | Chạy trong Docker |

## 2. Chạy lần đầu

```bash
npm install
npm run docker:up
cp services/api/.env.example services/api/.env   # kiểm tra: OTP_SECRET đủ 32 ký tự, OTP_DEV_ECHO=true
npm run db:migrate                                # migration + seed tài khoản mẫu
```

Sau đó mở 5 terminal:

```bash
npm run dev:api        # backend :3000
npm run dev:landing    # :5177
npm run dev:admin      # :5174
npm run dev:nurse-web  # :5175
npm run dev:patient    # :5173 (khi cần)
```

Chế độ dữ liệu: cả nurse-web và admin-web đang đặt **gọi API thật**
(`VITE_USE_MOCK=false` ở admin-web, 3 cờ `VITE_USE_MOCK_*`/`VITE_MOCK_CREDENTIALS`
đều `false` ở nurse-web). Muốn quay lại mock phần nào, đổi cờ tương ứng thành `true`
rồi khởi động lại terminal của app đó — không phải sửa code.

## 3. Tài khoản mẫu (seed)

Mã OTP lấy ngay trên màn hình nhập OTP (chế độ dev `OTP_DEV_ECHO=true` trả mã kèm
response — production sẽ gửi SMS/ZNS thật).

| Vai trò | Số điện thoại | Ghi chú |
|---|---|---|
| Admin | 0901 000 001 | Sau OTP phải qua 2FA. Lần đầu: bấm "Lấy mã cài đặt 2FA", nhập mã bí mật vào Google/Microsoft Authenticator, rồi nhập mã 6 số |
| Điều dưỡng (ACTIVE, Tier 2) | 0902 000 002 | Vào thẳng trang chủ điều dưỡng |
| Bệnh nhân | 0903 000 003 | Đăng nhập ở nurse-web/admin sẽ bị chặn đúng thiết kế (sai cổng) |

Phân biệt vai trò nằm ở backend: cùng một endpoint OTP cho mọi tài khoản, backend
trả `role` kèm theo; Admin thì bị giữ lại ở bước 2FA. Mỗi app chỉ chấp nhận đúng
vai trò của mình.

## 4. Kịch bản demo gợi ý (một vòng khép kín)

1. **Landing (:5177)** — bấm "Đăng ký làm điều dưỡng" → nhảy sang nurse-web đăng nhập.
2. **Nurse web (:5175)** — nhập một số MỚI (ví dụ 0905 111 222) → nhập OTP hiện trên
   màn hình → "Hoàn tất đăng ký" (nhập họ tên) → wizard 6 bước nộp hồ sơ (CCCD 2 mặt,
   ảnh chân dung, bằng, GPHN còn hạn) → màn hình "đang chờ duyệt".
3. **Admin (:5174)** — đăng nhập tài khoản Admin (OTP + 2FA) → menu "Duyệt hồ sơ":
   hồ sơ vừa nộp nằm ở tab "Chờ duyệt mới" → "Thẩm định" → xem từng giấy tờ → Duyệt.
4. **Quay lại nurse web** — tải lại trang: hồ sơ chuyển ACTIVE, Tier 2 (có GPHN hợp lệ).
5. (Tùy chọn) Ở SH6 "Văn bằng & GPHN", tải GPHN gia hạn → Admin tab "Duyệt gia hạn
   GPHN" → duyệt → Tier 2 được khôi phục/duy trì.

## 5. Giới hạn đã biết khi demo

- Patient-web chưa có màn hình đăng nhập/đặt ca (mới scaffold) — nút phía gia đình
  ở landing trỏ về trang gốc của patient-web.
- Tab "Đã xử lý" trong hàng đợi duyệt của Admin chưa có endpoint thật ở backend
  (hàng đợi thật chỉ gồm hồ sơ đang chờ) — ở chế độ API thật tab này trả danh sách trống.
- Admin chọn Tier ở màn thẩm định: backend tự suy Tier từ GPHN được duyệt
  (GPHN hợp lệ → Tier 2), không nhận Tier do FE gửi.

