# Hướng dẫn Cài đặt & Test `nurse-app` trên Android Studio

Tài liệu này hướng dẫn cấu hình môi trường Windows, mở project `apps/nurse-app/android` trên Android Studio, chạy ứng dụng trên Emulator (API 26 & API 34) và điện thoại Android thật, cùng bộ test thủ công cho Phase 0 → Phase 8.

---

## 1. Yêu cầu Môi trường & Khắc phục Lỗi Thường gặp

| Thành phần | Yêu cầu cho React Native 0.74.1 | Ghi chú kiểm tra trên Windows |
| --- | --- | --- |
| **JDK** | **JDK 17** hoặc **JDK 21 LTS** (không dùng Java 25 cho Gradle 8.6) | Kiểm tra `java -version` và biến `JAVA_HOME` (tránh trỏ vào thư mục rỗng; trên máy có `D:\java21` hoặc cài Eclipse Temurin 17/21) |
| **Node.js** | Node 18 LTS / 20 LTS (hoặc ≥ 18) | Nếu gặp lỗi CLI/Metro trên Node 24, chuyển về Node 20 LTS bằng `nvm` hoặc `fnm` |
| **Android SDK** | `compileSdkVersion = 34`, `minSdkVersion = 26`, `buildToolsVersion = 34.0.0` | Đặt `ANDROID_HOME` trỏ tới thư mục SDK (vd: `D:\Android_sdk`) |
| **NDK** | `26.1.10909125` | Bắt buộc nếu build native modules C++ (Reanimated / VisionCamera / Hermes) |

### Thiết lập SDK trong Android Studio
1. Mở Android Studio → **Settings > Languages & Frameworks > Android SDK**.
2. Kiểm tra **Android SDK Location** (vd: `D:\Android_sdk`).
3. Tab **SDK Platforms**, tích chọn và cài đặt:
   - **Android 14.0 ("UpsideDownCake" / API 34)** — bắt buộc để compile RN 0.74.1.
   - **Android 8.0 ("Oreo" / API 26)** — bắt buộc để kiểm thử thiết bị cấu hình cũ (Phase 8).
4. Tab **SDK Tools** (bật **Show Package Details** ở góc dưới phải), tích chọn:
   - **Android SDK Build-Tools 34.0.0**
   - **Android SDK Platform-Tools** (`adb`)
   - **Android Emulator**
   - **NDK (Side by side) → 26.1.10909125**
5. Tạo `apps/nurse-app/android/local.properties` (file này đã nằm trong `.gitignore`, không commit):
   ```properties
   sdk.dir=D:\\Android_sdk
   ```

---

## 2. Tạo Máy ảo (AVD) trong Device Manager

Mở **Tools > Device Manager > Create Virtual Device**, tạo 2 máy ảo:
1. **AVD Chính (Dev & GPS/Camera):** `Pixel 7` · System Image **API 34 (Google APIs x86_64)** · RAM ≥ 4096 MB.
2. **AVD Tương thích (Phase 8):** `Pixel 2` · System Image **API 26 (Android 8.0 Google APIs x86_64)**.

---

## 3. Chạy Project từ Terminal & Android Studio

1. **Cài dependencies & build `@healthcare-system/shared` (tại gốc repo):**
   ```powershell
   npm install
   npm run build --workspace=packages/shared
   ```
2. **Kiểm tra cấu hình môi trường API (`apps/nurse-app/.env.development`):**
   ```env
   API_BASE_URL=http://10.0.2.2:3000/api/v1
   USE_MOCK_AUTH=false
   USE_MOCK_SHIFTS=true
   ```
   - `10.0.2.2` là địa chỉ loopback trỏ từ **Android Emulator** về `localhost` trên máy tính Windows.
3. **Mở project Android trong Android Studio:**
   - Chọn **File > Open** → `apps/nurse-app/android`.
   - Đợi **Gradle Sync** tải Gradle 8.6 và các thư viện Android hoàn tất.
   - Nếu Android Studio báo lỗi Java version: vào **Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK**, chọn **JDK 17** hoặc **JDK 21** (`D:\java21`).
4. **Chạy Metro Bundler (Terminal 1 tại gốc repo):**
   ```powershell
   npm run start --workspace=apps/nurse-app -- --reset-cache
   ```
5. **Cài và mở App lên Emulator (Terminal 2 tại gốc repo):**
   ```powershell
   npm run android --workspace=apps/nurse-app
   ```
   *(Hoặc bấm nút **Run 'app' (Shift+F10)** trực tiếp trên Android Studio sau khi Metro đang chạy ở Terminal 1).*

---

## 4. Chạy trên Điện thoại Android Thật (USB Debugging)

1. Trên điện thoại: vào **Cài đặt > Giới thiệu điện thoại** → chạm 7 lần vào **Số bản dựng** → vào **Tùy chọn nhà phát triển** → bật **Gỡ lỗi USB (USB Debugging)**.
2. Cắm cáp USB, chọn **Cho phép gỡ lỗi USB** trên màn hình điện thoại, kiểm tra kết nối:
   ```powershell
   adb devices
   ```
3. Forward cổng Metro (`8081`) và Backend API (`3000`) qua cáp USB:
   ```powershell
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:3000 tcp:3000
   ```
   Nếu dùng máy thật kết nối qua `adb reverse`, có thể đặt `API_BASE_URL=http://localhost:3000/api/v1` trong `.env.development` (hoặc dùng IP LAN của máy tính).
4. Chạy `npm run android --workspace=apps/nurse-app`.

---

## 5. Bộ Kiểm thử Thủ công (Manual Test Checklist)

### A. Smoke Test Giai đoạn 0 (Emulator API 26, API 34 & Máy thật)
1. **Điều hướng 3 vùng:** Ở tab `Hồ sơ` (trong chế độ `[DEV]`), thử chuyển qua vùng `Onboarding` / `Chờ duyệt` / `Bị khóa` và quay lại vùng `ACTIVE`.
2. **Luồng Ca mẫu:** Tại `Trang chủ` → bấm **Xem hồ sơ ca** (`ShiftBriefing`) → bấm **Điểm danh vào ca** (`CheckIn`) → kiểm tra GPS + chụp ảnh selfie → vào màn `ActiveShift` đi hết 4 tab (`Đánh giá`, `Sinh tồn`, `Chăm sóc + Đơn thuốc`, `Bàn giao`) → hoàn tất **Check-out**.

### B. Test Phần cứng & Chống Gian lận (Phase 4 Exit Criteria)
1. **Geofencing ≤ 200 m (Emulator):**
   - Nhấn `...` (**Extended Controls**) trên thanh công cụ Emulator → tab **Location**.
   - Đặt tọa độ mẫu nhà bệnh nhân (`16.0718, 108.2205`) → **Set Location** → bấm cập nhật GPS trên màn Check-in → hiển thị trong bán kính hợp lệ (`≤ 200m`).
   - Đổi tọa độ sang vị trí cách > 500m (vd: `16.0800, 108.2300`) → bấm cập nhật GPS → app chặn Check-in và báo vượt bán kính.
2. **Chống Fake GPS (Máy thật):**
   - Cài một ứng dụng Mock Location, chọn làm *Mock location app* trong Developer Options và bật giả lập vị trí.
   - Mở màn `CheckIn` → `react-native-geolocation-service` trả về `pos.mocked = true` → app hiện cảnh báo đỏ và khóa nút Check-in.
3. **Camera trực tiếp (Không thư viện ảnh):**
   - Bấm chụp selfie điểm danh / chụp đơn thuốc không hợp lệ → mở `LiveCameraModal` (`react-native-vision-camera`) trực tiếp, không có nút chọn ảnh từ Gallery.
4. **SOS 115 (0ms độ trễ mạng):**
   - Tắt Wi-Fi và dữ liệu di động trên máy → tại `ActiveShift`, bấm **SOS 115** → app mở ngay trình gọi điện thoại với số `115`.

### C. Kiểm tra Elder-Friendly & Dung lượng Release (Phase 8)
1. **Cỡ chữ lớn:** Vào **Settings > Display > Font size** tăng lên mức lớn nhất; kiểm tra không bị cắt chữ, tràn nút trên màn hình 5 inch (API 26) và màn hình hiện đại (API 34).
2. **Kiểm tra dung lượng bản Release (< 50 MB):**
   ```powershell
   cd apps\nurse-app\android
   .\gradlew assembleRelease
   ```
   Kiểm tra file `.apk` theo từng kiến trúc CPU (`arm64-v8a`, `armeabi-v7a`) trong `android/app/build/outputs/apk/release/` phải nhỏ hơn **50 MB**.
   Để tạo Android App Bundle nộp Play Store:
   ```powershell
   .\gradlew bundleRelease
   ```

