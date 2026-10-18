# Checklist phát triển (Development Checklist)

> **Mục đích:** Khi bắt tay vào code bất kỳ phần nào của nền tảng, đi theo checklist này để bảo đảm ba điều không bao giờ bị phá vỡ: **đúng nghiệp vụ** (BR-01…BR-23), **đúng luồng** (17 luồng hoạt động + máy trạng thái đã duyệt), **bảo mật chắc chắn** (BR-09, SEC-00…SEC-10).
> **Nguồn chuẩn (thứ tự ưu tiên khi mâu thuẫn):** `use_case_diagram.drawio` → `work_flow_diagram.drawio` → `docs/user_stories/` → `docs/requirement/` → `docs/business_rule/` → `docs/security/` → `erd_diagram.drawio` → `docs/database/schema.sql`. Tài liệu thắng code: thấy mâu thuẫn thì dừng và hỏi PO, không tự chọn một phía.
> **Tài liệu liên quan:** Chiến lược kiểm thử `docs/testing/test-strategy.md` (mỗi phase dưới đây ghi rõ tầng test tương ứng), hướng dẫn môi trường `docs/dev-setup.md`, các ADR trong `docs/adr/`.
> **Trạng thái:** Checklist và quy ước tổ chức module là **đề xuất chờ chốt** ở hai điểm: (1) cấu trúc file trong một module API sẽ khớp lại khi chốt framework backend; (2) hai thư mục tài liệu mới `docs/api/` và `docs/runbooks/` cần được duyệt khi tạo lần đầu. Phần chia phase/module bám Epic A–I và FR-01…FR-11 của đặc tả hiện hành.

---

## 1. Quy tắc vàng — áp cho mọi module, mọi dòng code

### 1.1 Nghiệp vụ (không được phá)

- [ ] Mọi hành vi đều truy vết được tới ít nhất một mã UC/BR/US/FR — ghi mã đó trong README của module và trong mô tả PR.
- [ ] **Không hardcode giá trị nghiệp vụ.** Phí, tỷ lệ, ngưỡng, thời hạn, khung giờ, bán kính… đọc từ cấu hình có hiệu lực theo thời gian (`system_parameter`, cấu hình bệnh viện — FR-10.1/10.2). Đổi cấu hình không được làm sai dữ kiện lịch sử.
- [ ] **Quyết định chưa chốt (sổ Q) thì không tự chế mặc định:** Q-03 (phí tối thiểu), Q-11 (thời điểm hóa đơn), Q-44 (ô sau quyết Admin của F1b) — code ở mức cơ chế/tham số; Q-12/F5 để trống tuyệt đối, không viết nhánh tiền mặt.
- [ ] **Tiền chỉ đi qua sổ cái:** Mọi biến động tiền ghi bút toán mới vào `financial_entry` (chỉ ghi thêm); cấm sửa/xóa dòng tiền cũ, cấm cộng trừ trực tiếp vào số dư lưu sẵn mà không có bút toán.
- [ ] Nền tảng **không giữ tiền**: tiền cọc/thanh toán chảy thẳng vào tài khoản cổng của bệnh viện (BR-05). Không tạo ví/tài khoản trung gian của nền tảng.
- [ ] Mọi quyết định tự động vì hết hạn phải ghi log kèm mã F (BR-18), thời điểm đến hạn, thời điểm quyết và lý do.
- [ ] Số tiền luôn là số nguyên VND không âm; phần trăm/tỷ lệ tính bằng số nguyên hoặc thập phân chính xác, có test mốc làm tròn.

### 1.2 Luồng & trạng thái

- [ ] Trước khi code một chức năng, mở đúng luồng của nó trong `luong_hoat_dong_v8.14` và đối chiếu từng bước, từng nhánh rẽ — kể cả nhánh hết hạn và nhánh lỗi.
- [ ] Chuyển trạng thái đơn/ca/thanh toán chỉ theo bảng chuyển của mô hình trạng thái đã duyệt (enum trong `packages/shared` + ERD trang 14); chuyển sai phải bị chặn ở API (NFR-05.4), không tin trạng thái do frontend gửi.
- [ ] Mọi mốc thời gian nghiệp vụ (cửa sổ cọc 15', T−24h/T−3h/T−2h, SLA 24h/72h/5 ngày, leo thang SOS 5'…) đều triển khai bằng **job nền** qua hàng đợi dùng chung (FR-11.2), không dùng `setTimeout`/cron rời trong từng module, không tính giờ ở frontend.
- [ ] Mọi thao tác có thể bị gọi lại (webhook, job, xác nhận thanh toán) đều **idempotent** theo khóa nghiệp vụ + ràng buộc duy nhất ở CSDL.
- [ ] Thời gian lưu UTC, hiển thị Asia/Ho\_Chi\_Minh (NFR-05.3).

### 1.3 Bảo mật (SEC-00…SEC-10, BR-09)

- [ ] **Phân quyền ở backend, 4 yếu tố** (vai trò × bệnh viện × quan hệ với hồ sơ/ca × trạng thái) cho mọi route chạm dữ liệu bệnh nhân/tài chính (BR-09). Frontend chỉ ẩn/hiện giao diện, không phải lớp bảo vệ.
- [ ] Mọi truy vấn dữ liệu đều lọc theo `hospital_id` (tenant) ở tầng repo — không có query "toàn hệ thống" ngoài module của Platform Admin.
- [ ] Đầu vào kiểm tra theo danh sách cho phép (whitelist) ở biên API; không bao giờ nối chuỗi SQL; dùng tham số hóa 100%.
- [ ] Thao tác nhạy cảm (xem hồ sơ, đổi tiền, khóa tài khoản, quyết tranh chấp…) ghi `audit_log` chỉ-ghi-thêm: ai, lúc nào, bản ghi nào, hành động gì (FR-01.7). Log không chứa mật khẩu, token, OTP hay dữ kiện lâm sàng thừa (NFR-03.5).
- [ ] File/ảnh sức khỏe: bucket riêng tư, chỉ cấp **URL ký hạn ≤ 15 phút** sau khi đã qua kiểm quyền 4 yếu tố (NFR-03.3); lưu kèm hash toàn vẹn.
- [ ] Bí mật (khóa cổng, khóa API) chỉ qua biến môi trường/secret manager, không commit (NFR-03.6); `.env` thật không bao giờ vào repo.
- [ ] Không SMS, không CCCD, không số điện thoại làm định danh ở bất kỳ đâu (BR-20). Mã dùng trong ca (check-in, xác nhận phát sinh…) là mã trong ứng dụng, tách biệt OTP tài khoản — không gửi qua email.
- [ ] PR chạm xác thực/phân quyền/tài chính/lược đồ lâm sàng: bắt buộc security reviewer duyệt + có test phủ định đi kèm (SEC-10.1).

### 1.4 Kiểm thử đi kèm (chi tiết ở `docs/testing/test-strategy.md`)

- [ ] Module mới có đủ test ở tầng tương ứng của chiến lược kiểm thử; module tiền/vi phạm/phân quyền đạt ≥ 80% bao phủ nhánh (NFR-09.1).
- [ ] Test đặt tên/gắn mã UC/BR/US; nhánh chờ quyết định thì để `it.todo` kèm mã Q thay vì bịa kỳ vọng.

---

## 2. Quy ước đặt tên & vị trí file

### 2.1 Cây gốc của repo (đã có — không tự ý đổi)

```
apps/admin-web/        # Web quản trị bệnh viện + nền tảng (React)
apps/patient-web/      # Web/PWA bệnh nhân & người nhà (React)
apps/nurse-app/        # App điều dưỡng (React Native)
services/api/          # Backend Node.js + TypeScript
packages/shared/       # Enum, hằng số, kiểu dùng chung (nguồn sự thật cho trạng thái)
db/migrations/         # Migration SQL theo thứ tự
db/seeds/              # Dữ liệu tham chiếu & ca mẫu
db/tests/              # Test ràng buộc CSDL
docs/                  # Toàn bộ tài liệu dự án (xem 2.4)
```

### 2.2 Một module backend chuẩn (`services/api/src/modules/<ten-module>/`)

Tên module: **tiếng Anh, kebab-case, số ít**, đặt theo năng lực nghiệp vụ (không đặt theo tên bảng). Bên trong module luôn đủ các file sau (file nào không cần thì bỏ, nhưng không đổi tên các file còn lại):

| File | Vai trò |
| --- | --- |
| `README.md` | Mục đích module, mã UC/BR/US/Flow phụ trách, quyết định Q liên quan, cách chạy test |
| `<ten-module>.routes.ts` | Khai báo route, gắn middleware xác thực/phân quyền; không chứa logic nghiệp vụ |
| `<ten-module>.service.ts` | Logic nghiệp vụ theo BR — nơi duy nhất được quyết định nghiệp vụ |
| `<ten-module>.repo.ts` | Truy cập CSDL (SQL thuần, tham số hóa, luôn lọc tenant) — nơi duy nhất chạm DB của module |
| `<ten-module>.policy.ts` | Kiểm quyền 4 yếu tố BR-09 riêng của module |
| `<ten-module>.jobs.ts` | Các job/hẹn giờ của module (đăng ký vào hàng đợi dùng chung) — chỉ khi module có mốc thời gian |
| `<ten-module>.types.ts` | Kiểu dữ liệu, DTO; trạng thái lấy từ `packages/shared`, không định nghĩa lại enum |
| `<ten-module>.schema.ts` | Schema kiểm tra đầu vào (whitelist) cho từng route |

Code dùng chung **không thuộc một nghiệp vụ** đặt ở `services/api/src/core/` (db pool, audit, jobs, notifications, storage, errors, logging) — cấm nhét logic nghiệp vụ vào `core/`, và cấm module này import thẳng `repo` của module khác (đi qua `service` hoặc sự kiện).

Test đi theo module: unit ở `services/api/test/unit/<ten-module>/`, tích hợp ở `services/api/test/integration/<ten-module>/`, đặt tên `<doi-tuong>.test.ts` (mẫu sẵn có: `test/unit/br04-refund-policy.test.ts`).

### 2.3 Một feature frontend chuẩn (`apps/<app>/src/features/<ten-feature>/`)

- Tên feature kebab-case theo hành trình người dùng (vd `advance-booking`, `sos`, `care-report`).
- Component đặt tên PascalCase (`BookingSummary.tsx`); hook đặt `use-<ten>.ts`; gọi API qua một file `<ten-feature>.api.ts` duy nhất trong feature — component không tự fetch rải rác.
- Feature không tự quyết nghiệp vụ: giá, hạn, quyền hiển thị nút hành động đều lấy từ API; frontend chỉ trình bày và kiểm tra mềm cho trải nghiệm.

### 2.4 CSDL & tài liệu

| Loại | Quy ước tên | Vị trí |
| --- | --- | --- |
| Migration | `NNNN_<pham-vi>_<mo-ta-ngan>.sql` (NNNN tăng dần, không sửa file đã merge — viết migration mới) | `db/migrations/` |
| Seed | `NNN_<ten>.sql` | `db/seeds/` |
| Test ràng buộc DB | `constraints.<nhom>.test.ts` | `db/tests/tests/` |
| Quyết định kiến trúc | `NNNN-<ten-quyet-dinh>.md` | `docs/adr/` |
| Hợp đồng API của module | `<ten-module>.api.md` | `docs/api/` *(thư mục mới — đề xuất)* |
| Kịch bản xử lý sự cố | `<ma-su-co>.md` (4 sự cố chuẩn theo NFR-09.5) | `docs/runbooks/` *(thư mục mới — đề xuất)* |
| Chiến lược/kế hoạch kiểm thử | `<ten>.md` | `docs/testing/` |
| Tài liệu nghiệp vụ/yêu cầu/bảo mật | Giữ nguyên cây hiện có (business\_rule, requirement, security, user\_stories) | `docs/` |

Enum & hằng số nghiệp vụ dùng chung: chỉ sửa ở `packages/shared/src/` (hiện có `enums.ts`) — đây là điểm rà soát tập trung khi PO duyệt lại từ điển enum của ERD.

### 2.5 Checklist mở đầu một module mới

- [ ] Đọc đủ: BR liên quan trong `docs/business_rule/`, luồng tương ứng, Story + AC, mục FR, mục SEC liên quan.
- [ ] Liệt kê các mã Q chưa chốt chạm module và cách xử lý (tham số / `it.todo` / loại trừ) — ghi vào README của module.
- [ ] Tạo module theo khuôn 2.2, feature theo 2.3 nếu có giao diện.
- [ ] Viết test khung (kể cả `it.todo` truy vết) **trước hoặc cùng** code, theo tầng đã gán ở chiến lược kiểm thử.
- [ ] Nếu module cần quyết định kỹ thuật mới (thư viện, mẫu tích hợp): viết ADR vào `docs/adr/` trước khi áp dụng rộng.

---

## 3. Các phase phát triển

Thứ tự phase đi theo phụ thuộc nghiệp vụ: danh tính → hồ sơ & cấu hình → sàng lọc → đặt lịch/ghép ca → tiền cọc → thực hiện ca → SOS → vi phạm/khiếu nại/tranh chấp → quản trị & báo cáo → cứng hóa & pilot. Module đánh dấu *(Should)* có thể lùi sang đợt sau pilot mà không phá phụ thuộc; module không đánh dấu là **Must** cho pilot Q-23.

### Phase 0 — Nền tảng dùng chung

**Mục tiêu:** Mọi module sau này đứng trên cùng một nền: DB, hàng đợi job, audit, thông báo, lưu trữ file, cấu hình môi trường.

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `core/database` | ADR-0002 (SQL-first) | `services/api/src/core/database/` |
| `core/audit` | FR-01.7, BR-09 | `services/api/src/core/audit/` |
| `core/jobs` | FR-11.2, NFR-06.3 | `services/api/src/core/jobs/` |
| `core/notifications` | FR-11.1, BR-20 (chỉ email + push, không SMS) | `services/api/src/core/notifications/` |
| `core/storage` | NFR-03.3 (bucket riêng tư, URL ký) | `services/api/src/core/storage/` |
| `shared` (enum, tiền tệ, khóa cấu hình) | ERD trang 14, NFR-05.1 | `packages/shared/src/` |
| Hạ tầng repo/CI/docker | `docs/dev-setup.md`, SEC-10.2 | Gốc repo, `.github/workflows/` |

Checklist riêng:

- [ ] `audit_log` chỉ ghi thêm ở cả hai tầng: quyền DB (khi cứng hóa) + quy ước code; writer dùng chung, cấm module tự ghi bảng audit bằng SQL riêng.
- [ ] Hàng đợi job có khóa idempotent + dead-letter + cảnh báo tồn đọng (NFR-09.3) ngay từ đầu.
- [ ] Lớp thông báo có giao diện nhà cung cấp (email/push) để test bằng fake; nội dung mẫu không chứa PHI chi tiết (NFR-04.4).
- [ ] CI chạy đủ cổng của Mục 5 ngay từ phase này (job unit + job DB + quét bí mật).

**Cổng ra:** docker compose dựng được PG16 + Redis; migration + seed áp sạch; CI xanh trên PR rỗng có test mẫu; `packages/shared` chứa đủ enum của ERD trang 14.

### Phase 1 — Tài khoản, xác thực & đồng ý (Epic A · FR-01, FR-02 · Luồng 01–03)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `tenants` | FR-01.8 (tạo bệnh viện + admin đầu tiên) | `services/api/src/modules/tenants/` |
| `accounts` | FR-01.1, BR-20 (đăng ký email, OTP 5', reset 15') | `services/api/src/modules/accounts/` |
| `auth` | FR-01.2, R-L03 (khóa chung 5 lần/15'), phiên đăng nhập | `services/api/src/modules/auth/` |
| `staff-2fa` | FR-01.3, BR-20/21 (2FA bắt buộc cho nhân sự) | `services/api/src/modules/staff-2fa/` |
| `staff-credentialing` | FR-01.4/01.5, BR-21, UC139, Q-50 (duyệt 2 bước, máy trạng thái hồ sơ, quét hết hạn CCHN) | `services/api/src/modules/staff-credentialing/` |
| `consent` | FR-02.2/02.3/02.4, BR-17, Q-47 (đồng ý theo hồ sơ, link email cho người thân, rút đồng ý, đồng ý lại khi đổi điều khoản) | `services/api/src/modules/consent/` |
| `privacy-erasure` | FR-02.5, BR-12 (xóa/ẩn danh trong 72h + job hạn chót) | `services/api/src/modules/privacy-erasure/` |

Frontend đi kèm: `apps/patient-web/src/features/auth/`, `features/consent/`; `apps/admin-web/src/features/staff-onboarding/`, `features/tenant-onboarding/`.

Checklist riêng:

- [ ] Nhân sự chưa qua UC139 xác nhận chuyên môn thì **không** lọt vào mọi danh sách điều phối (khẳng định bằng test, US-HP-04).
- [ ] Không tồn tại đường tự khôi phục tài khoản nhân sự qua tổng đài (US-HP-05 AC-03).
- [ ] Link đồng ý của người thân: đúng phạm vi một hồ sơ/đơn, có hạn, dùng một lần; điều phối viên không có quyền bấm thay (US-HP-02).
- [ ] Rút đồng ý xử lý theo trạng thái đơn đang chạy (chưa điều phối → hủy + hoàn 100%; đang đi/đang ca → kết thúc an toàn) (FR-02.3).
- [ ] Kiểm thử: Tầng 1 (CHECK 2FA, unique consent), Tầng 2 (BR-20/21, R-L03), Tầng 3 (ma trận quyền), Tầng 7 (bộ test bảo mật CI).

**Cổng ra:** Toàn bộ TC của US-HP-01…05 đạt ở tầng API; tài khoản nhân sự mẫu đi trọn vòng đời BR-21 trên staging.

### Phase 2 — Hồ sơ bệnh nhân, danh mục & cấu hình bệnh viện (Epic B một phần · FR-02, FR-04.2, FR-10 · Luồng 02)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `patient-profiles` | FR-02.1, BR-17 (nhiều hồ sơ/tài khoản, tự khai quan hệ đại diện, không CCCD) | `services/api/src/modules/patient-profiles/` |
| `facilities` | BR-06 (cơ sở, vùng phục vụ theo cơ sở) | `services/api/src/modules/facilities/` |
| `service-catalog` | FR-04.2, FR-10.1 (dịch vụ, bảng giá tầng, cờ cần giấy chỉ định — danh mục Q-13) | `services/api/src/modules/service-catalog/` |
| `hospital-config` | FR-10.1/10.2 (cấu hình hiệu lực theo thời gian: giá, geofence, tỷ lệ chia, khung giờ BR-03, SLA, đầu mối trực & SOS Q-48) | `services/api/src/modules/hospital-config/` |
| `merchant-accounts` | FR-10.3, BR-05 (tài khoản cổng của bệnh viện) | `services/api/src/modules/merchant-accounts/` |
| `clinical-form-templates` | FR-10.6, BR-22, Q-49 (khung biểu mẫu theo loại dịch vụ, trường bắt buộc) | `services/api/src/modules/clinical-form-templates/` |
| `doctor-assignment` *(Should)* | FR-02.6, BR-09 (gán bác sĩ theo dõi, quyền xem lịch sử có hạn) | `services/api/src/modules/doctor-assignment/` |

Checklist riêng:

- [ ] Mọi thực thể cấu hình đều có `effective_from/effective_to`; đọc cấu hình luôn theo thời điểm nghiệp vụ, không theo "bản mới nhất" một cách mù quáng.
- [ ] Vùng phục vụ riêng của điều dưỡng (`nurse_service_area`): chỉ dùng nếu PO chốt giữ + thứ tự ưu tiên so với vùng cơ sở — chưa chốt thì module chỉ dùng vùng cơ sở (BR-06).
- [ ] Biểu mẫu lâm sàng: khung kỹ thuật xong trước, nội dung trường do khoa lâm sàng bệnh viện duyệt (Q-49) — không tự chế trường y khoa.
- [ ] Kiểm thử: Tầng 1 (unique cấu hình 3.1d), Tầng 2 (BR-06, BR-17), Tầng 3.

**Cổng ra:** Tạo được trọn bộ dữ liệu nền của bệnh viện pilot chỉ qua giao diện/API quản trị, không sửa DB tay.

### Phase 3 — Sàng lọc triệu chứng & hỗ trợ AI (FR-03 · BR-10, BR-15 · Luồng 04)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `screening` | FR-03.1/03.2/03.3, BR-10 (phân loại 4 nhóm theo luật có `rule_version`; bản ghi sự kiện 1-n cho mỗi đơn; khẩn cấp → chặn đặt + hướng dẫn 115/SOS; bổ sung triệu chứng tới T−1h, cấm tự hạ nhóm) | `services/api/src/modules/screening/` |
| `screening-review` | FR-03.4, BR-10, Q-21 (AI lỗi/timeout/độ tin cậy thấp → bác sĩ trực rà soát; quá SLA → hướng dẫn gọi bệnh viện) | `services/api/src/modules/screening-review/` |

Checklist riêng:

- [ ] Kết quả sàng lọc là **bản ghi sự kiện thêm mới**, không ghi đè: phân loại lại tạo bản ghi mới nối `supersedes` (ERD 8.11); không tồn tại cờ "chưa sàng lọc lại" ở bất kỳ đâu.
- [ ] AI chỉ hỗ trợ: không chẩn đoán xác định, không kê đơn, không duyệt hoàn tiền/hồ sơ nhân sự; mọi đầu ra AI kèm mức không chắc chắn + đường leo thang con người (FR-03.6).
- [ ] Bộ triệu chứng kiểm thử đại diện đủ 4 nhóm được PO/khoa lâm sàng duyệt dùng làm fixture chuẩn (Tầng 2 của chiến lược kiểm thử).
- [ ] Kiểm thử: Tầng 1 (3.1a — hai lần cập nhật khẩn cấp chỉ sinh một lần hủy + một lần hoàn 100%), Tầng 2 (BR-10), Tầng 8 (AI hỏng → suy giảm an toàn, NFR-02.3).

**Cổng ra:** Đặt lịch thử với ca khẩn cấp bị chặn đúng, hoàn cọc đúng một lần; tắt AI vẫn hoàn tất sàng lọc bằng bác sĩ trực.

### Phase 4 — Đặt lịch & ghép ca (Epic C · FR-04 · BR-01, BR-03, BR-13, BR-14 · Luồng 04–06)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `bookings` | FR-04.1 (đặt trước T+2h…T+14 ngày, trần 3 đơn đang hoạt động, kiểm công nợ BR-14, geofence dịch vụ) | `services/api/src/modules/bookings/` |
| `prescription-verification` | FR-04.12, BR-15 (tải giấy chỉ định, bác sĩ trực duyệt trong 30') | `services/api/src/modules/prescription-verification/` |
| `nurse-availability` | FR-04.4, BR-03 (lịch trống trượt 14 ngày, trạng thái sẵn sàng nhận ca) | `services/api/src/modules/nurse-availability/` |
| `matching` | FR-04.3, BR-01 (lọc cứng theo chuyên môn/lịch/vùng + cửa sổ điều dưỡng nhận ca 30', giữ slot có điều kiện) | `services/api/src/modules/matching/` |
| `rematching` | FR-04.6, BR-13, Q-19 (điều dưỡng hủy → vòng ghép mới theo thời gian còn lại; lựa chọn của bệnh nhân; mặc định khi hết SLA) | `services/api/src/modules/rematching/` |
| `manual-dispatch` | FR-04.7 (điều phối viên gán thủ công khi ghép tự động thất bại) | `services/api/src/modules/manual-dispatch/` |
| `booking-cancellation` | FR-04.8, BR-04 (bệnh nhân hủy, hoàn theo bậc; Admin duyệt ngoại lệ hoàn 100%) | `services/api/src/modules/booking-cancellation/` |
| `booking-reminders` | FR-04.5, BR-13 (job T−24h nhắc lịch, T−3h điều dưỡng xác nhận lại — hạn T−2h, T−2h mời cập nhật triệu chứng UC119; không xác nhận lại → ghép lại) | `services/api/src/modules/booking-reminders/` |
| `rescheduling` *(Should)* | FR-04.9, BR-13 (đổi lịch tối đa 2 lần, giữ cọc, còn > 2h) | `services/api/src/modules/rescheduling/` |

Loại trừ tường minh: đặt ngay/ghép nhanh toàn trình (FR-04.10, BR-08) và đặt hộ UC135 (FR-04.11, R-UC135) — **không tạo module** trong pilot; nếu sau này được duyệt, UC135 phải qua threat model (SEC-10.4) và mở phase riêng.

Checklist riêng:

- [ ] Ghép ca loại trừ tuyệt đối: nhân sự chưa UC139, nhân sự đang bị khóa vi phạm, lịch chồng (dựa cả vào ràng buộc EXCLUDE ở DB — Tầng 1 test), ngoài vùng phục vụ.
- [ ] Điều dưỡng hủy trong lúc bệnh nhân chờ trả cọc → mở vòng ghép 15' mới và tính là 1 vi phạm nhẹ ngay (Q-41/Q-45, BR-01).
- [ ] Kiểm thử: Tầng 1 (EXCLUDE chống chồng lịch & đơn cùng hồ sơ, ngoại lệ đơn con BR-16), Tầng 2 (BR-01/03/13/14), Tầng 5 (toàn bộ job nhắc/xác nhận), Tầng 6 (hành trình đặt lịch).

**Cổng ra:** Hành trình đặt lịch đầu-cuối tới trạng thái "đã cọc" chạy được trên staging với dữ liệu bệnh viện pilot (phần cọc thuộc Phase 5 — cổng ra của phase này là tới trạng thái chờ cọc + ghép ca hoàn chỉnh).

### Phase 5 — Cọc, thanh toán, sổ cái & đối soát (Epic D · FR-06 · BR-04, BR-05, BR-18 một phần · Luồng 04, 10, 11)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `deposits` | FR-06.1, BR-04 (cọc `max(30%, 50.000đ)`, cửa sổ 15' — hết hạn tự hủy đơn + nhả slot, job) | `services/api/src/modules/deposits/` |
| `gateway-webhooks` | FR-06.2, BR-05 (webhook ký HMAC, idempotent, khớp giao dịch) | `services/api/src/modules/gateway-webhooks/` |
| `ledger` | FR-06, BR-04/05 (bút toán chỉ ghi thêm; phân bổ cọc vào dòng tranh chấp trước — Q-30) | `services/api/src/modules/ledger/` |
| `settlements` | FR-06.3 + FR-05.11, BR-04, Q-33 (bảng kê 2 cấp xác nhận; phần còn lại; "Chờ thanh toán" 24h → công nợ — job) | `services/api/src/modules/settlements/` |
| `refunds-auto` | FR-06.4, BR-04 (hoàn tự động đúng bậc 100/50/0%; lỗi BV/ĐD hoặc sàng lọc khẩn cấp luôn 100%) | `services/api/src/modules/refunds-auto/` |
| `refunds-manual` | FR-06.5, UC90 (lệnh hoàn thủ công sau quyết, kèm chứng từ + hash) | `services/api/src/modules/refunds-manual/` |
| `reconciliation` | FR-06.8, BR-04/05, F7 (đối soát cọc 4 nhóm cuối kỳ; lệch → mở ticket điều tra; nhập sao kê tay dự phòng) | `services/api/src/modules/reconciliation/` |
| `einvoice` | FR-06.7, BR-04, Q-11 (hóa đơn điện tử phần còn lại; hóa đơn điều chỉnh khi hoàn) | `services/api/src/modules/einvoice/` |
| `patient-transactions` | FR-06.12 (cổng tra cứu lịch sử thanh toán/hóa đơn của bệnh nhân) | `services/api/src/modules/patient-transactions/` |
| `commission` *(Should)* | FR-06.9, BR-05 (phí nền tảng theo đơn hoàn tất, xuất hóa đơn tháng cho bệnh viện) | `services/api/src/modules/commission/` |
| `nurse-payouts` *(Should)* | FR-06.10 (sổ thu nhập điều dưỡng, điểm tin cậy) | `services/api/src/modules/nurse-payouts/` |

Loại trừ tường minh: chuỗi thu tiền mặt tại nhà (FR-06.11) — **không tạo module** trong pilot (Q-23, Q-12); mọi khoản thu đều qua cổng.

Checklist riêng:

- [ ] Webhook: sai chữ ký → từ chối + ghi log bảo mật; bắn trùng/bắn lại → đúng một giao dịch, một lệnh hoàn (test đồng thời ở Tầng 7).
- [ ] Mọi lệnh hoàn đều truy được về: dòng phí gốc, quyết định (tự động theo BR-04 hay UC90 thủ công), chứng từ, bút toán.
- [ ] Đối soát 4 nhóm: tổng 4 nhóm phải khớp tổng cọc thu — lệch là lỗi Blocker, không "cho qua" (FR-06.8).
- [ ] Kiểm thử: Tầng 1 (3.1b idempotent thanh toán), Tầng 2 (BR-04 — đã có 8 test; BR-18 khung F), Tầng 4 (contract cổng), Tầng 5 (job 15', 24h).

**Cổng ra:** Kịch bản tiền trọn vòng (cọc → ca → bảng kê → trả nốt → đối soát) cân tuyệt đối trên bộ dữ kiện chuẩn #MH-8824 và các biến thể hoàn cọc.

### Phase 6 — Thực hiện ca chăm sóc (Epic E · FR-05 · BR-07, BR-15, BR-16, BR-22 · Luồng 07, 07A, 07B)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `session-briefing` | US-HP-18 (điều dưỡng xem tóm tắt trước ca; thu hồi quyền xem ngay khi bị đổi ca/hủy) | `services/api/src/modules/session-briefing/` |
| `departure-tracking` | FR-05.1/05.2, BR-07 (hạn xuất phát theo ETA, GPS 10–15 giây, phát hiện bom ca, chờ trễ tối đa 2 lần × 15') | `services/api/src/modules/departure-tracking/` |
| `checkin` | FR-05.3, BR-07/20 (geofence + mã trong app của bệnh nhân; dự phòng: ảnh có geofence + bệnh nhân xác nhận, hậu kiểm 24h) | `services/api/src/modules/checkin/` |
| `initial-assessment` | FR-05.4, BR-22 (đánh giá ban đầu theo biểu mẫu loại dịch vụ — bắt buộc vô điều kiện) | `services/api/src/modules/initial-assessment/` |
| `session-addons` | FR-05.5, BR-15 (phát sinh lớp A/B/C; B cần BV duyệt ≤ 10'; C dừng ca + SOS; dòng tính tiền phải có bệnh nhân xác nhận) | `services/api/src/modules/session-addons/` |
| `care-reports` | FR-05.6/05.7, BR-22 (báo cáo bắt buộc, 2 trạng thái Kết thúc/Hoàn thành; nhắc 2h — job; treo nhận ca sau 24h; lưu vào hồ sơ tại BV thực hiện) | `services/api/src/modules/care-reports/` |
| `session-stop` | FR-05.8, BR-16, F9 (dừng ca giữa chừng: lý do có mã, tính phí, báo cáo dừng, thu phí ngay trừ khẩn cấp/an toàn; BV xác nhận/điều chỉnh trong 24h — job; hậu kiểm lý do "không an toàn" Q-46; phần chưa làm → đơn con 0 cọc) | `services/api/src/modules/session-stop/` |
| `patient-absent` | FR-05.9, BR-07 (báo vắng mặt sau 15' chờ có mặt xác thực; không phạt điều dưỡng) + cơ chế phí tối thiểu F3 (giá trị theo Q-03) | `services/api/src/modules/patient-absent/` |
| `in-app-contact` *(Should)* | FR-05.10, UC133, BR-20 (chat/gọi trong app, che số cá nhân) | `services/api/src/modules/in-app-contact/` |

Frontend đi kèm: `apps/nurse-app/src/features/` (briefing, departure, check-in, assessment, add-ons, care-report, session-stop); `apps/patient-web/src/features/visit-tracking/`, `features/addon-confirmation/`.

Checklist riêng:

- [ ] App điều dưỡng: GPS nền + geofence là yêu cầu cứng (BR-07) — kiểm trên thiết bị thật, không chỉ emulator; pin trong giới hạn NFR-01.3.
- [ ] Báo cáo chăm sóc là điều kiện chặn hoàn thành ca ở **cả** API lẫn giao diện; kể cả khi bệnh nhân không bổ sung triệu chứng nào (BR-22).
- [ ] Mọi mã dùng trong ca (check-in/xác nhận) sinh trong phiên ứng dụng, hạn ngắn, giới hạn số lần thử và ghi log lần sai (US-HP-19).
- [ ] Kiểm thử: Tầng 2 (BR-07/15/16/22), Tầng 3 (thu hồi quyền xem briefing), Tầng 5 (job nhắc báo cáo, hạn duyệt dừng ca), Tầng 6 (hành trình ca), Tầng 8 (GPS/mạng yếu).

**Cổng ra:** Một ca mẫu chạy trọn từ xuất phát tới báo cáo + bảng kê trên thiết bị thật, gồm cả nhánh dừng ca và nhánh vắng mặt bệnh nhân.

### Phase 7 — SOS & an toàn khẩn cấp (Epic F · FR-09 · BR-23, Q-48 · Luồng 17)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `sos` | FR-09.1/09.2/09.3/09.4, BR-23, UC140 (kích hoạt mọi lúc cho bệnh nhân/người nhà; trong ca cũng có; giao diện hướng dẫn gọi 115 — hệ thống **không** tự gọi 115; phát alert tới đầu mối trực; đóng sự cố bắt buộc ghi chép xử lý) | `services/api/src/modules/sos/` |
| `sos-escalation` | BR-23, Q-48 (job leo thang 5' tới đầu mối dự phòng; ghi `sos_escalation_event` từng nấc; SOS trong ca → dừng ca, cấm thu phí tại chỗ) | `services/api/src/modules/sos-escalation/` |

Checklist riêng:

- [ ] Độ trễ từ bấm SOS tới push đầu mối ≤ 10 giây (p95) — đo ở Tầng 8; kênh in-app tức thời, không phụ thuộc hàng đợi email (US-HP-36 AC-03).
- [ ] Cơ chế chống bấm nhầm (đếm ngược 5 giây — NFR-07.4) chỉ bật khi PO duyệt; không tự thêm bước chặn làm chậm phát tín hiệu.
- [ ] Mọi sự cố SOS có đủ: thời điểm kích hoạt, người kích hoạt, tọa độ (nếu được phép), mốc xác nhận, nấc leo thang, ghi chép đóng — phục vụ hậu kiểm pháp lý.
- [ ] Kiểm thử: Tầng 2 (BR-23), Tầng 5 (job 5'), Tầng 8 (độ trễ), diễn tập trực SOS ở UAT (Tầng 9).

**Cổng ra:** Diễn tập SOS đầu-cuối với bệnh viện: bấm → đầu mối nhận ≤ 10 giây → xác nhận trong 5' → đóng có ghi chép; và kịch bản không ai xác nhận → leo thang đúng nấc.

### Phase 8 — Vi phạm, khiếu nại & tranh chấp tài chính (Epic G + H · FR-07, FR-06.6 · BR-01, BR-02, BR-11, BR-18, BR-19 · Luồng 08, 12)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `violations` | FR-07.1/07.2, BR-01/02, F6 (ghi nhận vi phạm theo cửa sổ trượt, khóa/mở khóa kỹ thuật — mở khóa bom ca 24h Q-43 độc lập với xét duyệt 72h; nền tảng không tự phạt tiền/đuổi việc) | `services/api/src/modules/violations/` |
| `complaints` | FR-07.3/07.4, BR-11 (khiếu nại trong 30 ngày; dòng phí 24h; nghiêm trọng → khóa tạm điều dưỡng, BV xác nhận trong 4h — job; chuyển nguyên văn tới BV; SLA + nhắc) | `services/api/src/modules/complaints/` |
| `fee-disputes` | FR-06.6, BR-18 F1a/F1b (dòng chưa trả → F1a: quá 5 ngày tự miễn thu; dòng đã trả khiếu nại trong 24h → F1b: hoàn thủ công UC90, quá hạn leo thang nền tảng, **không** tự miễn thu) | `services/api/src/modules/fee-disputes/` |
| `platform-arbitration` | US-HP-34, BR-18 F1b, Q-44 (Platform Admin quyết trong 3 ngày làm việc, hồ sơ đầy đủ; ô mặc định sau quyết để chờ PO — code tới bước leo thang + đếm SLA) | `services/api/src/modules/platform-arbitration/` |
| `complaint-appeals` *(Should)* | FR-07.5/07.6, BR-11, F4 (phúc tra một cấp, người quyết độc lập với người xử đầu; khiếu nại cấp nền tảng) | `services/api/src/modules/complaint-appeals/` |
| `abuse-flags` *(Should)* | FR-07.7, BR-19 (cờ lạm dụng theo tài khoản, cửa sổ 90 ngày, thông báo & phản biện 7 ngày) | `services/api/src/modules/abuse-flags/` |
| `nurse-safety-reports` *(Should)* | FR-07.8, BR-11 (điều dưỡng báo hành vi không an toàn của phía bệnh nhân) | `services/api/src/modules/nurse-safety-reports/` |
| `adverse-incidents` | FR-07.9, BR-11, UC134 (sự cố lâm sàng tại nhà — tách khỏi khiếu nại dịch vụ, kích hoạt quy trình an toàn) | `services/api/src/modules/adverse-incidents/` |

Checklist riêng:

- [ ] Bảng BR-18 triển khai dạng **bảng quyết định data-driven** đủ F1a–F9 (trừ F5); mỗi mã F có test riêng theo khung ở Tầng 2 của chiến lược kiểm thử — không rải logic hết hạn vào từng màn hình quản trị.
- [ ] Việc khóa/mở khóa điều dưỡng luôn là sự kiện có dấu thời gian + người/quyết định hệ thống, tra cứu lại được (US-HP-29).
- [ ] Kiểm thử: Tầng 2 (BR-01/02/11/18/19), Tầng 5 (mọi SLA: 4h, 24h, 72h, 5 ngày, 3 ngày làm việc — phân biệt ngày làm việc/ngày lịch).

**Cổng ra:** Ba kịch bản tranh chấp mẫu (F1a miễn thu tự động; F1b hoàn UC90; F1b leo thang → quyết nền tảng) chạy đúng trên staging kèm đủ bút toán + audit.

### Phase 9 — Quản trị, báo cáo, tái khám & thông báo hoàn thiện (Epic H, Epic I · FR-08, FR-10.4/10.5, FR-11 · Luồng 13, 15)

| Module | Nguồn | Vị trí chính |
| --- | --- | --- |
| `admin-dashboards` | FR-10.4 (dashboard BV + nền tảng đa tenant; giám sát hàng đợi quá hạn BR-18, hạn xóa dữ liệu 72h, SLA khiếu nại) | `services/api/src/modules/admin-dashboards/` + `apps/admin-web/src/features/` |
| `analytics-reports` *(Should)* | FR-10.5 (hiệu quả điều dưỡng, doanh thu theo nhóm dịch vụ) | `services/api/src/modules/analytics-reports/` |
| `follow-up` *(Should)* | FR-08.1/08.2, FR-03.5, Luồng 13 (đề xuất tái khám từ phân tích rủi ro sau ca; bác sĩ duyệt kế hoạch; quyền xem lịch sử khóa theo BV của bác sĩ) | `services/api/src/modules/follow-up/` |
| `notification-events` | FR-11.1/11.3, US-HP-36 (hoàn thiện bảng sự kiện → kênh → mẫu cho mọi luồng 04–15, 17; log mốc gửi/xác nhận mọi leo thang) | `services/api/src/modules/notification-events/` |
| `history-lookup` *(Should)* | US-HP-35, US-HP-37 (tra cứu dấu vết quyết định tài chính + audit; lịch sử đơn & báo cáo cho bệnh nhân) | `services/api/src/modules/history-lookup/` |

Checklist riêng:

- [ ] Dashboard quản trị chỉ hiển thị dữ liệu tenant của người xem (trừ vai trò Platform Admin) — có test phân quyền riêng.
- [ ] Mẫu thông báo rà soát lần cuối: không PHI chi tiết, không kênh SMS, tiếng Việt rõ ràng cho người lớn tuổi (NFR-07.3).
- [ ] Kiểm thử: Tầng 3, Tầng 6, rà soát truy vết toàn bộ Story Should được kéo vào đợt này.

**Cổng ra:** Vận hành một ngày pilot mô phỏng chỉ bằng các màn hình quản trị (không can thiệp DB): xử lý hàng đợi quá hạn, xem đối soát, tra cứu audit.

### Phase 10 — Cứng hóa, kiểm thử phi chức năng & sẵn sàng pilot

Không thêm nghiệp vụ mới — phase này biến hệ thống "đúng" thành hệ thống "đủ tin cậy để chạy thật":

- [ ] Bảo mật: bộ test bảo mật CI đầy đủ (SEC-10.2), threat model cho các năng lực đã mở, **pen test độc lập** trước go-live (SEC-10.3) và xử lý hết lỗi Critical/High; rà soát bí mật, phụ thuộc, cấu hình TLS/mã hóa (NFR-03).
- [ ] Hiệu năng & sức chịu tải: kiểm thử tải theo NFR-01/06 (giờ cao điểm, surge ×5) bằng kịch bản ở Tầng 8 của chiến lược kiểm thử.
- [ ] Khôi phục thảm họa: diễn tập PITR đạt RPO ≤ 1h / RTO ≤ 4h (NFR-02.2); kiểm các đường suy giảm (AI hỏng, cổng hỏng, GPS hỏng — NFR-02.3).
- [ ] Quan trắc & vận hành: dashboard sức khỏe, cảnh báo (tồn đọng job, webhook lỗi, OTP lỗi tăng, SOS quá 5' chưa xác nhận — NFR-09.3); viết đủ 4 runbook vào `docs/runbooks/` và diễn tập (NFR-09.5).
- [ ] Cách ly tenant & dữ liệu: rà soát lần cuối không rò chéo tenant; môi trường staging chỉ dữ liệu tổng hợp (NFR-09.4).
- [ ] UAT & go/no-go theo tiêu chí ra của chiến lược kiểm thử (Mục 8): 69 TC Must đạt, 0 lỗi Blocker/Critical, bệnh viện ký.

**Cổng ra:** Biên bản go-live pilot có chữ ký PO + bệnh viện; danh sách việc hoãn (Should, UC135, F5) ghi rõ trạng thái ngoài phạm vi.

---

## 4. Checklist trước khi merge một PR (áp cho mọi phase)

- [ ] Mô tả PR ghi rõ: mã UC/BR/US/FR chạm tới, phase/module, mã Q liên quan và cách xử lý.
- [ ] Không hardcode giá trị nghiệp vụ; không trạng thái/enum định nghĩa ngoài `packages/shared`.
- [ ] Route mới/sửa đều có kiểm quyền backend (BR-09) + test phủ định (sai vai trò/sai tenant → 403/404).
- [ ] Thao tác tiền/trạng thái đều idempotent và có test; bút toán/audit ghi đủ.
- [ ] Test của module xanh; bao phủ nhánh module tiền/vi phạm/phân quyền ≥ 80%.
- [ ] CI xanh toàn bộ (unit, DB, quét bí mật, kiểm toán phụ thuộc) — fail ở cổng bảo mật là chặn merge (SEC-10.2).
- [ ] PR vùng nhạy cảm đã có security reviewer duyệt (SEC-10.1).
- [ ] Tài liệu đi kèm đã cập nhật: README module, `docs/api/<module>.api.md` nếu đổi hợp đồng, ADR nếu có quyết định kỹ thuật mới.

---

*Nguyên tắc xuyên suốt mọi phase: làm đúng thứ tự phụ thuộc, mỗi module xong là phải chạy được và kiểm được độc lập; khi đặc tả và code lệch nhau, đặc tả đã chốt thắng — và phần chưa chốt thì để mở có đánh dấu, không lấp bằng suy đoán.*