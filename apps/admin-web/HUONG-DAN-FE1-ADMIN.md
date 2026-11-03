# FE-1 · Phase 1 · Admin Web — Đăng nhập 2FA + Duyệt hồ sơ điều dưỡng (A2, A3)

## Cài đặt & chạy
```bash
# ở thư mục gốc repo (npm workspaces)
npm install                 # cài thêm react-router-dom, @vitejs/plugin-react cho admin-web
cd apps/admin-web
npm run dev                 # http://localhost:5174 (patient-web chạy 5173, chạy song song được)
npm run build               # tsc + vite build — chạy trước khi tạo PR
```
`.env.development` để `VITE_USE_MOCK=true` → không cần backend.

## Kịch bản test với mock
**Đăng nhập** (SĐT → OTP → 2FA):
| Bước | Nhập | Kết quả |
|---|---|---|
| SĐT | **0901 000 001** | Tài khoản Admin |
| SĐT | 0905 123 456 | Tài khoản khách → bị chặn "không có quyền truy cập Admin Console" |
| OTP SMS | **123456** | đúng (111111 = hết hạn) |
| Mã 2FA | **246810** | đúng (sai 5 lần → phải đăng nhập lại) |

**Hàng đợi (A2)** có sẵn 4 hồ sơ như thiết kế:
- **Phạm Thu Hà** — mới, GPHN còn hạn → gợi ý Cấp 2
- **Trần Thị Mai** — gia hạn GPHN (tab "Duyệt gia hạn GPHN")
- **Lê Văn Đức** — mới, chưa có GPHN → chỉ Cấp 1
- **Đỗ Thị Lan** — GPHN hết hạn + quyết định nghỉ hưu → Cấp 2 bị khoá, hưu trí chỉ gắn huy hiệu

Thử: tìm kiếm, lọc "Quá 24 giờ", lọc "Chỉ bằng tốt nghiệp", bấm **Thẩm định** → xem ảnh (bấm ảnh để mở lightbox, phím ←/→/+/−/Esc) → duyệt hoặc từ chối (bắt buộc lý do) → xác nhận → về hàng đợi, badge sidebar giảm. Tab **Đã xử lý** xem lại kết quả.
Reset dữ liệu mock: Console → `localStorage.removeItem('mock_db')`.

## File thay đổi / thêm mới
- `index.html`, `vite.config.ts` (port 5174), `.env.development`, `src/vite-env.d.ts`
- `src/main.tsx`, `src/routes/index.tsx` — router + AuthProvider + mock
- `src/lib/` — `api-client.ts` (bắt lỗi mạng, 401 → đăng xuất), `session.ts`, `phone.ts`, `errors.ts`, `formatters.ts`
- `src/components/` — `Alert`, `Button` (size/loading/forwardRef), `ConfirmDialog`, `layout/AdminLayout.tsx` (sidebar 10 mục)
- `src/features/auth/` — `AdminLoginPage` (SH1 biến thể Admin), `AdminVerifyOtpPage`, `AdminTwoFactorPage`, AuthProvider, RequireAuth
- `src/features/nurse-verification/` — `VerificationQueuePage` (A2), `NurseReviewPage` (A3), `DocumentViewer` (lightbox), `DecisionPanel`, `useCredentialUrls` (presigned URL 10 phút, tự làm mới)
- `src/styles/tokens.css`, `base.css` — màu thiết kế #166B58, Be Vietnam Pro
- `src/mocks/` — auth (OTP + 2FA), nurse-verification

> `lib/`, `components/`, `features/auth/` đang **giống phần lớn** bên patient-web. Nên đề xuất với team gom vào `packages/ui` + `packages/web-core` để khỏi sửa 2 nơi (đưa vào backlog, không làm trong PR này).

## Contract đề xuất — cần BE-1 xác nhận
**Đăng nhập Admin (SRS: SĐT + OTP, Admin bắt buộc 2FA)**
- `POST /auth/verify-otp` với tài khoản ADMIN → `{ requires_2fa: true, challenge_token, challenge_expires_in_sec }` (không trả access_token)
- `POST /auth/verify-2fa` `{ challenge_token, code }` → `{ access_token, user }` · lỗi `TWO_FA_INVALID` (`details.attempts_left`), `TWO_FA_CHALLENGE_EXPIRED`

**Duyệt hồ sơ**
- `GET /admin/nurses/verification-queue?tab=NEW|RENEWAL|PROCESSED&q=&submitted=TODAY|OVER_24H&docs=HAS_GPHN|DEGREE_ONLY|HAS_RETIREMENT` → `QueueItem[]`
- `GET /admin/nurses/verification-queue/summary` → `{ NEW, RENEWAL }`
- `GET /admin/nurses/:id/verification` → `NurseReviewDetail` (có `suggested_tier`, `gphn.is_valid`, `gphn.days_remaining`, `gphn.identity_match` do **backend tính**)
- `GET /admin/nurses/:id/credentials/:credentialId/url` → `{ url, expires_at }` presigned 10 phút (backend ghi audit lượt xem)
- `PATCH /admin/nurses/:id/verify` (SRS §8) `{ decision: APPROVED|REJECTED, tier?, rejection_reason? }`
  - lỗi `TIER2_REQUIRES_VALID_GPHN` (422), `REJECTION_REASON_REQUIRED` (400), `ALREADY_REVIEWED` (409 — 2 Admin duyệt cùng lúc)
  - Chi tiết kiểu dữ liệu: `src/features/nurse-verification/nurse-verification.types.ts`

## Việc còn treo / cần team chốt
- [ ] **Admin đăng nhập kiểu gì?** Bản Phase 0 dùng `POST /admin/auth/login` (username + password + TOTP) — đó là baseline bệnh viện cũ. SRS v2.0 + SH1: SĐT + OTP + 2FA. Đã làm theo SRS, cần BE-1 xác nhận. 2FA là TOTP (app) hay SMS?
- [ ] `nurse_credentials.doc_type` trong SRS chỉ có `CCCD` — FE cần tách `CCCD_FRONT` / `CCCD_BACK` để xem từng mặt.
- [ ] Field `notes` (bản Phase 0) → đổi thành `rejection_reason` cho khớp cột trong SRS §7.
- [ ] **Duyệt eKYC khách hàng** (SH3 ghi "Admin duyệt thủ công") chưa có màn trong A1–A10 → hỏi Tom/PO.
- [ ] Thiết kế A3 ghi "nạp đủ ký quỹ 300.000đ" → đã đổi thành "theo cấu hình hệ thống" (không ghi cứng số).
- [ ] Tô màu tuổi hồ sơ (≥ 12 giờ cam, ≥ 24 giờ đỏ) là ngưỡng giao diện trong `format.ts` — nếu team có SLA duyệt hồ sơ thì lấy từ backend.
- [ ] `README.md` của admin-web còn mô tả bản cũ (Hospital/SaaS) → nên cập nhật theo SRS v2.0.
- [ ] `TIER`, trạng thái hồ sơ, `doc_type` đang khai báo tạm trong `*.types.ts` → chuyển sang `@healthcare-system/shared`.
