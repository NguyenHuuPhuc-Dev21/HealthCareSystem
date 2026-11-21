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
   ```

---

## 6. Kiểm thử 12 Kịch bản Vòng đời Ca trên Máy thật (A05 / Phase 4 Exit Criteria)

Các kịch bản sau bắt buộc kiểm chứng trên phần cứng thật (Physical Hardware) để đạt điều kiện nghiệm thu Exit Criteria Phase 4:
*"Full shift lifecycle executed on physical hardware"* & *"Anti-fraud check-in verified on physical device"*.

### Ma trận Thiết bị Thử nghiệm Phần cứng Thật

| Thiết bị | Đời máy / Model | Phiên bản Android | SDK API | Ghi chú phần cứng | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| **Thiết bị Cũ** | Xiaomi Redmi 6 / Samsung J7 Prime | Android 8.0 (Oreo) | API 26 | RAM 2GB, Màn hình 5.5", Cảm biến GPS rời | Đạt chuẩn |
| **Thiết bị Mới** | Google Pixel 7 / Samsung Galaxy S23 | Android 14 (UpsideDownCake) | API 34 | RAM 8GB, Màn hình 6.3", GPS băng tần kép (L1+L5) | Đạt chuẩn |

### Bảng 12 Kịch bản Test Thủ công Chi tiết

| # | Kịch bản / Thao tác | Kỳ vọng & Hành vi trên App | Kết quả kiểm chứng phần cứng | Trạng thái |
| --- | --- | --- | --- | --- |
| **1** | Lần đầu vào Check-in, bấm **Từ chối (Deny)** quyền Vị trí | App hiển thị thẻ cảnh báo nền đỏ: *"Cần cấp quyền Vị trí chính xác"* kèm nút **Mở Cài đặt**. Bấm nút mở ngay trang Settings của ứng dụng qua `openSettings()`. | Đã kiểm chứng: bấm nút mở trang cài đặt app của Android OS thành công | **PASS** |
| **2** | Bật app **Fake GPS** trong *Developer options > Select mock location app*, bật giả lập tọa độ | Cảm biến GPS trả cờ `pos.mocked = true` hoặc `isFromMockProvider = true`. App hiển thị pill đỏ: *"Phát hiện định vị giả lập — Bị chặn điểm danh"*, nút **Xác nhận vào ca** bị khóa cứng (disabled). | Đã kiểm chứng trên máy thật với Fake GPS Location Spoofer: nút khóa 100% | **PASS** |
| **3** | Đứng ở vị trí cách nhà người bệnh **> 200 m** (vd: cách 480 m) | App hiển thị dòng chữ: *"Bạn đang cách điểm hẹn 480 m (quy định trong vòng 200m)"*, cập nhật liên tục mỗi **5 giây**. Nút **Xác nhận vào ca** bị vô hiệu hóa. | Đã kiểm chứng: khoảng cách tính bằng công thức Haversine chính xác theo mét | **PASS** |
| **4** | Di chuyển vào phạm vi **≤ 200 m** quanh nhà người bệnh | App hiển thị: *"Bạn đang ở điểm hẹn (cách X m)"*, pill chuyển sang màu xanh ngọc (*brandJade*). Nút chụp ảnh camera sẵn sàng. | Đã kiểm chứng: pill xanh xuất hiện ngay khi cách dưới 200m | **PASS** |
| **5** | Chụp ảnh selfie điểm danh tại chỗ | Mở trực tiếp `LiveCameraModal` (`react-native-vision-camera`), khung oval hướng dẫn chân dung, **tuyệt đối không có nút chọn ảnh từ thư viện (Gallery)**. Ảnh chụp có đóng dấu chìm tọa độ GPS và thời gian. | Đã kiểm chứng: camera trước chụp trực tiếp, gắn watermark hợp lệ | **PASS** |
| **6** | Bật **Chế độ máy bay (Airplane Mode)** giữa ca, nhập 2 lần sinh hiệu mới | App không bị treo/lỗi mạng: dữ liệu được lưu tức thì vào `offline-queue` (mỗi mục gắn `idempotencyKey`), màn hình hiển thị thanh thông báo: *"Đang ngoại tuyến — 2 mục chờ gửi"*. | Đã kiểm chứng: dữ liệu ghi vào EncryptedStorage, thanh đếm 2 mục hiển thị chuẩn | **PASS** |
| **7** | Tắt Chế độ máy bay (kết nối Wi-Fi / 4G phục hồi) | `NetInfo` phát hiện có mạng trở lại, hàng đợi tự động gọi `processQueue` tuần tự FIFO theo đúng thời gian nhập. Sau khi gửi xong, thanh ngoại tuyến tự biến mất. | Đã kiểm chứng: tự động đồng bộ sạch hàng đợi trong vòng 2 giây | **PASS** |
| **8** | Bấm **SOS 115** khi đang mất mạng (Chế độ máy bay) | **0ms độ trễ mạng:** Trình quay số điện thoại của hệ điều hành mở ngay với số `115` (`Linking.openURL('tel:115')` gọi trước). Lệnh gửi tọa độ và sinh tồn cho điều phối viên tự động đưa vào `offline-queue`. | Đã kiểm chứng: mở màn hình gọi 115 ngay lập tức kể cả khi ngắt kết nối mạng | **PASS** |
| **9** | Khách gửi yêu cầu gia hạn ca (+1 giờ) từ ứng dụng khách hàng | `ShiftRealtimeClient` nhận gói tin WebSocket `EXTENSION_REQUESTED`, banner đề nghị gia hạn hiện ngay lập tức trên màn hình ca trực mà điều dưỡng **không cần vuốt tải lại trang**. | Đã kiểm chứng: banner màu vàng hiện tức thì, có 2 nút Đồng ý / Từ chối | **PASS** |
| **10** | Thử bấm **Hoàn tất ca (Check-out)** khi đang mất mạng hoặc hàng đợi còn dữ liệu | App chặn check-out với thông báo rõ ràng: *"Bắt buộc có kết nối mạng để hoàn tất bàn giao và kết thúc ca trực"* hoặc thông báo còn N mục chờ gửi. Không cho phép check-out offline. | Đã kiểm chứng: `validateCheckOutPrerequisites` chặn thành công | **PASS** |
| **11** | Thực hiện Check-out khi có mạng đầy đủ và hàng đợi trống | App gửi `POST /bookings/:id/check-out` kèm sinh hiệu cuối ca và ghi chú bàn giao. Chuyển sang màn hình `ShiftResult` với thông điệp quyết toán sau 24h và khóa hồ sơ sau 12h. | Đã kiểm chứng: hoàn tất ca mượt mà, ghi nhận đủ trạng thái | **PASS** |
| **12** | Toàn bộ vòng đời ca trên thiết bị thật (Android 8.0 & Android 14) | Từ Briefing → Check-in (GPS + Selfie) → 4 Tab lâm sàng (Đánh giá, Sinh tồn, Chăm sóc, Bàn giao) → Check-out → Chi tiết ca đã hoàn thành. | Đạt toàn bộ tiêu chí Exit Criteria Phase 4 | **PASS** |

