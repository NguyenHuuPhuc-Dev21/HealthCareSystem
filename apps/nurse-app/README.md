# Nurse Field Mobile Application (`@healthcare-system/nurse-app`)

React Native `0.74.1` mobile application for CareNest home care nurses:
- 3-zone React Navigation architecture (`Auth`, `Onboarding / Pending / Locked`, `Active Tabs + Shift Flow`)
- Pre-visit clinical briefing and patient address view (US-HP-18)
- Real-time Radar Dispatch modal for urgent bookings (≤ 6 hours) with 45s countdown timer, audio/vibration alert, and Accept/Decline actions (A08, FR-BOOK-03, FR-NOTIF-01)
- 3-balance nurse wallet dashboard (available, escrow held, deposit) with immutable transaction ledger, 7-day earnings SVG bar chart, upcoming 24h settlements, and pending commission alerts (A09, FR-PAY-02, FR-PAY-04, ADR-0004)
- Nurse deposit management, independent custody partner (BIDV), grace-period progress (3 shifts, 30% withhold), VietQR top-up with banking app deep link / QR save, SLA penalty dispute appeal, and account closure with 7-day hold refund (A10, FR-PAY-03, BR-04, BR-12, ADR-0004)
- Firebase Cloud Messaging (FCM) & Notifee full-screen push notification architecture
- On-site geofenced check-in (`<= 200m` Haversine, Android `mocked` GPS block, live-only VisionCamera capture)
- Mandatory initial clinical assessment, vital signs, care checklist, invalid prescription rejection, extension approval, check-out report, and zero-latency SOS `115`

## Quick Start

From repository root:

```powershell
npm install
npm run build --workspace=packages/shared
npm run start --workspace=apps/nurse-app -- --reset-cache
```

In a second terminal:

```powershell
npm run android --workspace=apps/nurse-app
```

For full Android Studio SDK, JDK, AVD (API 26 / API 34), physical device USB debugging, and manual hardware verification instructions, see [`docs/development/nurse-app-android-testing.md`](../../docs/development/nurse-app-android-testing.md).

## Cấu hình Firebase & `google-services.json` (A08 — Radar Push)

Ứng dụng sử dụng `@react-native-firebase/app`, `@react-native-firebase/messaging` và `@notifee/react-native` để nhận thông báo đẩy ưu tiên cao khi có ca gấp Radar (kể cả khi app đang tắt hoặc màn hình khóa).

### Cách lấy file `google-services.json`

1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Chọn project Firebase của CareNest (hoặc tạo project mới cho môi trường development).
3. Thêm ứng dụng Android với Package Name chính xác là:
   ```
   com.nurseapp
   ```
4. Tải file `google-services.json` từ Firebase Console.
5. Đặt file vào đường dẫn:
   ```
   apps/nurse-app/android/app/google-services.json
   ```
6. **Lưu ý bảo mật:** File `google-services.json` thật đã được thêm vào `.gitignore` và không commit vào git repository. Một file template mẫu dành cho build local development đã được đặt sẵn.

### Chế độ Mock không cần Firebase (Development)

Trong môi trường development (`IS_DEV = true`), điều dưỡng có thể kiểm thử toàn bộ luồng Radar Dispatch mà không cần kết nối Firebase:
1. Bật công tắc **"Sẵn sàng nhận ca"** trên Trang chủ.
2. Bấm nút **`[DEV] Giả lập ca gấp Radar`**.
3. Màn hình Radar toàn màn hình sẽ hiển thị với đầy đủ:
   - Bản đồ radar với vòng tròn phát sóng và ghim vị trí ca.
   - Thẻ dịch vụ, khoảng cách, giờ bắt đầu, tiền + thưởng nóng (+100.000đ), thực nhận.
   - Đồng hồ đếm ngược 45 giây.
   - Nút **"✓ NHẬN CA"** (≥ 64dp) và **"Bỏ qua"**.
   - Kiểm tra logic ký quỹ theo ADR-0004 và tự động chuyển đến màn tóm tắt ca trực (`ShiftBriefing`) khi nhận thành công.

