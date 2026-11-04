# FE-1 · Phase 1 · Đăng nhập OTP (SH1 + SH2) + Onboarding (SH3) + Hồ sơ người bệnh (P13) — Patient Web

## Cài đặt
```bash
cd apps/patient-web
npm install            # cài thêm react-router-dom và @vitejs/plugin-react (đã khai báo trong package.json)
npm run dev            # mở http://localhost:5173 → tự chuyển về /login
npm run build          # tsc + vite build — chạy trước khi tạo PR
```
`.env.development` để `VITE_USE_MOCK=true` → chạy không cần backend. Khi BE-1 xong API thì đổi thành `false`
(request `/api` sẽ được proxy sang `VITE_API_PROXY_TARGET`).

## Kịch bản test với mock
| Số điện thoại | Kết quả |
|---|---|
| 0905 123 456 | Khách cũ, đã eKYC → vào trang chủ |
| 0905 111 222 | Khách cũ, chưa eKYC → vào trang chủ |
| 0909 888 777 | Tài khoản điều dưỡng → báo "không dùng cho trang Khách hàng" |
| 0905 000 000 | Bị giới hạn gửi OTP (429) |
| Số khác | Người dùng mới → hiện chọn vai trò → /onboarding |

Mã OTP: `123456` đúng · `111111` hết hạn · mã khác sai (sai 5 lần thì bị khoá, phải gửi lại mã).

## SH3 — eKYC + hồ sơ người bệnh + đồng ý NĐ 13 (`/onboarding`)
Đăng nhập bằng một số **mới** (vd. 0977 111 333, mã 123456, chọn "Tôi cần thuê điều dưỡng") → tự vào `/onboarding`.
1. **Bước 1:** tải CCCD 2 mặt (JPG/PNG ≤ 10 MB) + chụp selfie bằng camera (trình duyệt sẽ hỏi quyền camera) → "Gửi xác thực" → trạng thái *Đang chờ duyệt*.
2. **Bước 2:** điền hồ sơ; bấm "Lưu & tiếp tục" khi còn thiếu sẽ báo lỗi từng ô. Dữ liệu chỉ giữ trong bộ nhớ trang (không lưu localStorage vì là dữ liệu sức khoẻ).
3. **Bước 3:** tick đồng ý → "Hoàn tất" → gửi hồ sơ + đồng ý trong 1 request → về trang chủ, thấy hồ sơ vừa tạo.

Số 0905 123 456 (khách đã eKYC) → vào `/onboarding` thấy Bước 1 "Đã xác thực".
Dữ liệu mock lưu ở localStorage key `mock_db` — xoá bằng `localStorage.removeItem('mock_db')` trong Console.

### Contract đề xuất cho SH3 — cần BE-2 xác nhận (SRS §8 chưa có)
`GET /api/v1/customers/me/ekyc` → `{ kyc_status, full_name?, cccd_number_masked?, documents: [{ doc_type: CCCD_FRONT|CCCD_BACK|SELFIE, file_name, uploaded_at }], rejection_reason? }`

`POST /api/v1/customers/me/ekyc` (multipart: `cccd_front`, `cccd_back`, `selfie`) → cùng format, `kyc_status = PENDING`. Lỗi 400 `KYC_MISSING_DOCUMENT`.

`POST /api/v1/patients/profiles`
```json
{ "relationship": "MOTHER", "full_name": "Nguyễn Thị Hoa", "birth_year": 1948, "weight_kg": 52,
  "mobility_status": "PARTIAL", "medical_history": "...", "is_infectious": false,
  "location_type": "HOME", "address_text": "...", "lat": 16.06, "lng": 108.22,
  "data_consent_accepted": true }
```
→ `{ id, full_name, location_type, data_consent_accepted, consent_timestamp }`. Thiếu đồng ý → 400 `CONSENT_REQUIRED`. Backend tự ghi IP + thiết bị + thời điểm (FR-PRIV-01). `lat/lng = null` → backend geocode từ địa chỉ.

## P13 — Hồ sơ người được chăm sóc (`/patient-profiles`)
Vào bằng menu avatar → "Hồ sơ người được chăm sóc", hoặc tab "Tài khoản". Hoàn tất SH3 cũng tự chuyển về đây.
Đăng nhập 0905 123 456 để thấy sẵn 2 hồ sơ mẫu (bà Hoa, ông Đức) như thiết kế.
- Bấm thẻ bên trái → form sửa bên phải → "Lưu thay đổi".
- "＋ Thêm hồ sơ" → bắt buộc tick đồng ý mới tạo được.
- "Rút lại đồng ý" (có hộp xác nhận) → form bị khoá, chỉ còn nút "Đồng ý lại".
- "Yêu cầu xóa dữ liệu" → hồ sơ chuyển sang chỉ đọc.
- Navbar NAV-0: tab/menu chưa có màn hình thì hiện mờ.

### Contract đề xuất cho P13 — cần BE-2 / BE-3 xác nhận
- `GET /api/v1/patients/profiles` → danh sách **tóm tắt** (không có tiền sử bệnh): `id, full_name, relationship, birth_year, mobility_status, location_type, data_consent_accepted, consent_timestamp, booking_count, deletion_requested_at`
- `GET /api/v1/patients/profiles/:id` → chi tiết đầy đủ; **403 `CONSENT_NOT_ACTIVE`** nếu đã rút đồng ý hoặc đang chờ xoá
- `PATCH /api/v1/patients/profiles/:id` → body giống POST nhưng không có `data_consent_accepted`
- `POST /api/v1/patients/profiles/:id/consent` → đồng ý lại (backend ghi thời điểm/IP/thiết bị)
- `DELETE /api/v1/patients/profiles/:id/consent` → rút đồng ý (BE-3: dừng các ca chưa diễn ra)
- `POST /api/v1/patients/profiles/:id/deletion-request` → yêu cầu xoá/ẩn danh hoá (BE-3, FR-PRIV-01)

## File thay đổi / thêm mới
- `index.html`, `vite.config.ts`, `.env.development`, `src/vite-env.d.ts` — để `npm run dev` chạy được
- `src/main.tsx` — Router + AuthProvider + bật mock khi dev
- `src/routes/index.tsx` (sửa), `src/routes/HomePage.tsx` (trang giữ chỗ)
- `src/lib/api-client.ts` (sửa: bắt lỗi mạng, 401 → tự đăng xuất), `src/lib/session.ts`, `src/lib/phone.ts`
- `src/features/auth/*` — SH1, SH2, AuthProvider, RequireAuth/GuestOnly, OtpInput, RoleCard
- `src/features/onboarding/*` — trang SH3 + Stepper
- `src/features/ekyc/*` — Bước 1: tải CCCD, chụp selfie (CameraCapture), tóm tắt trạng thái
- `src/features/patient-profiles/*` — Bước 2 (form + kiểm tra), Bước 3 (đồng ý), API
- `src/components/layout/SetupLayout.tsx` — navbar biến thể SETUP
- `src/components/layout/PatientLayout.tsx` — navbar NAV-0 + menu avatar
- `src/components/ConfirmDialog.tsx`, `Button.tsx` (thêm size sm, forwardRef)
- `src/features/patient-profiles/PatientProfilesPage.tsx` + `components/ProfileCard.tsx`, `DataRightsPanel.tsx` — P13
- `src/lib/errors.ts`, `src/lib/useObjectUrl.ts`
- `src/routes/HomePage.tsx` — hiện danh sách hồ sơ để kiểm tra
- `src/components/Alert.tsx` (mới), `Button.tsx` (thêm size/block/loading, không phá code cũ)
- `src/styles/tokens.css` (đổi sang màu thiết kế #166B58, giữ tên biến cũ), `src/styles/base.css`
- `src/mocks/*` — mock API không cần thư viện ngoài (auth, ekyc, patient-profiles)

## Contract đang dùng — cần BE-1 xác nhận
`POST /api/v1/auth/request-otp`
- Request `{ "phone": "+84905123456" }` (E.164)
- 200 `{ success: true, data: { expires_in_sec, resend_after_sec, is_new_user } }`
- Lỗi: 400 `INVALID_PHONE` · 429 `OTP_RATE_LIMITED` (`details.retry_after_sec`)

`POST /api/v1/auth/verify-otp`
- Request `{ "phone", "otp", "role"?: "PATIENT" | "NURSE" }` (`role` chỉ gửi khi người dùng mới)
- 200 `{ success: true, data: { access_token, user: { id, role, status, kyc_status, full_name } } }`
- Lỗi: 400 `OTP_INVALID` (`details.attempts_left`) · 400 `OTP_EXPIRED` · 429 `OTP_TOO_MANY_ATTEMPTS`

## Việc còn treo
### P13 — cần team chốt
- [ ] Thiết kế P13 ghi "≥ 80 kg → +15%": đã bỏ vì là số nghiệp vụ, FE không ghi cứng. Mức phụ phí hiển thị ở bước đặt lịch (lấy từ backend).
- [ ] Rút đồng ý thì có được sửa hồ sơ không? Hiện khoá form (không đồng ý = không xử lý dữ liệu sức khoẻ).

### SH3 — cần team chốt
- [ ] **Ai duyệt eKYC khách?** SH3 ghi "Admin duyệt thủ công" nhưng bộ màn Admin (A1–A10) chưa có màn duyệt CCCD khách.
- [ ] **Trường "Mối quan hệ"** (SH3) chưa có trong bảng `patient_profiles` → BE-2 thêm cột `relationship`.
- [ ] **Năm sinh vs ngày sinh:** SRS lưu `dob` (DATE), thiết kế chỉ hỏi năm → đang gửi `birth_year`.
- [ ] **Nơi chăm sóc (Tại nhà / Bệnh viện):** SRS có `location_type` và luật eKYC dựa vào nó, SH3 chưa vẽ → đã thêm vào form, báo Tom cập nhật thiết kế.
- [ ] **Khách chỉ đặt tại bệnh viện có bắt buộc eKYC ở onboarding không?** SRS: chỉ home-care mới bắt buộc. Hiện làm theo thiết kế (bắt buộc Bước 1).
- [ ] Nội dung tóm tắt điều khoản ở Bước 3 + link toàn văn cần PO/pháp lý duyệt.
- [ ] Upload qua multipart gửi thẳng backend hay presigned URL lên S3? Đổi cách nào thì chỉ sửa `ekyc.api.ts`.

### SH1/SH2
- [ ] `UserRole`, `KycStatus`, `AccountStatus` đang khai báo tạm trong `auth.types.ts` → chuyển sang import từ `@healthcare-system/shared` khi BE-1 export.
- [ ] Token đang lưu localStorage (giữ như api-client cũ). Nếu BE chọn httpOnly cookie → chỉ sửa `src/lib/session.ts`.
- [ ] Người dùng mới chọn "Tôi là điều dưỡng" → chuyển sang Nurse Web (`VITE_NURSE_WEB_URL`), không tạo tài khoản điều dưỡng trong Patient Web. Cần thống nhất với FE-2.
- [ ] Link "Điều khoản sử dụng" đang trỏ `/dieu-khoan` tạm.
- [ ] `README.md` của patient-web còn mô tả bản cũ (đăng ký email, cọc 30%) — nên cập nhật theo SRS v2.0.
