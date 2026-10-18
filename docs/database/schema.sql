-- =====================================================================
-- Nền tảng đặt điều dưỡng chăm sóc tại nhà (SaaS đa bệnh viện)
-- Lược đồ cơ sở dữ liệu PostgreSQL 16
-- Nguồn: use_case_v8.1 (UC1–UC140, BR-01–BR-23) và luong_hoat_dong_v8.14
-- Bản 2 (18/10/2026): áp danh sách góp ý ERD – cột triage / hủy / hash, sos_escalation_event,
--   ràng buộc 3.1a–e, index 3.2, giá trị enum VIẾT HOA theo đề xuất nhóm 4
-- Quy ước:
--   * Khóa chính UUID; thời gian dùng timestamptz (UTC).
--   * Tiền: numeric(14,0) đơn vị VND.
--   * Dữ liệu thuộc bệnh viện mang hospital_id để lọc theo tenant (BR-09).
--   * Tiền không sửa tại chỗ: mọi biến động ghi bút toán mới (financial_entry).
--   * Dòng "-- @module:" dùng để sinh sơ đồ ERD, đừng xóa.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =====================================================================
-- KIỂU LIỆT KÊ (ENUM)
-- =====================================================================
CREATE TYPE account_type        AS ENUM ('PATIENT', 'NURSE', 'DOCTOR', 'HOSPITAL_ADMIN', 'PLATFORM_ADMIN');
CREATE TYPE account_status      AS ENUM ('UNVERIFIED', 'INACTIVE', 'ACTIVE', 'TEMP_LOCKED', 'DISABLED');
CREATE TYPE mfa_method          AS ENUM ('EMAIL', 'TOTP');
CREATE TYPE email_code_purpose  AS ENUM ('REGISTER', 'LOGIN_MFA', 'RESET_PASSWORD', 'ACTIVATION', 'REAUTH_DELETE',
                                         'REAUTH_WITHDRAW_CONSENT', 'RELATIVE_CONSENT');
CREATE TYPE hospital_sub_role   AS ENUM ('CHIEF', 'COORDINATOR', 'ACCOUNTANT', 'HR_QUALITY');
CREATE TYPE hospital_status     AS ENUM ('ACTIVE', 'SUSPENDED_NEW_ORDERS', 'TERMINATED');

CREATE TYPE staff_type          AS ENUM ('NURSE', 'DOCTOR');
CREATE TYPE staff_status        AS ENUM ('DRAFT', 'PENDING_HOSPITAL_REVIEW', 'PENDING_PLATFORM_REVIEW', 'APPROVED',
                                         'INFO_REQUESTED', 'INFO_EXPIRED', 'REJECTED', 'SUSPENDED', 'LICENSE_EXPIRED',
                                         'INACTIVE');
CREATE TYPE gender              AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE staff_lock_scope    AS ENUM ('INSTANT_ORDERS', 'ALL_ORDERS', 'CASH_ORDERS');
CREATE TYPE violation_type      AS ENUM ('NO_ACK_REPEAT', 'UNACCEPT_AFTER_ACK', 'CANCEL_GE_12H', 'CANCEL_1_12H',
                                         'CANCEL_LT_1H', 'NO_SHOW', 'LATE', 'REPORT_OVERDUE', 'FALSE_STOP_REASON');
CREATE TYPE violation_status    AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'FORCE_MAJEURE', 'AUTO_WAIVED');

CREATE TYPE relationship_type   AS ENUM ('SELF', 'SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'GRANDPARENT', 'OTHER');
CREATE TYPE consent_mode        AS ENUM ('SELF', 'RELATIVE_EMAIL', 'REPRESENTATIVE');
CREATE TYPE consent_status      AS ENUM ('PENDING', 'GRANTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE review_status       AS ENUM ('PENDING', 'VALID', 'INVALID', 'EXPIRED');

CREATE TYPE addon_class         AS ENUM ('A', 'B', 'C');

CREATE TYPE booking_type        AS ENUM ('SCHEDULED', 'INSTANT');
CREATE TYPE order_status        AS ENUM ('DRAFT', 'PENDING_MEDICAL_ORDER', 'PENDING_ASSIGNMENT', 'PENDING_DEPOSIT',
                                         'CONFIRMED', 'REPLACING', 'EN_ROUTE', 'IN_CARE', 'COMPLETED', 'CANCELLED');
CREATE TYPE order_end_type      AS ENUM ('NORMAL', 'STOPPED_MIDWAY', 'BASE_NOT_PERFORMED', 'PATIENT_ABSENT');
CREATE TYPE payment_status      AS ENUM ('NONE', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'AWAITING_BALANCE',
                                         'BALANCE_DUE_24H', 'IN_DEBT', 'CASH_DISPUTE', 'SETTLED');
CREATE TYPE party_type          AS ENUM ('PATIENT', 'NURSE', 'DOCTOR', 'HOSPITAL', 'PLATFORM', 'SYSTEM');
CREATE TYPE triage_result       AS ENUM ('NO_WARNING', 'EARLY_REVIEW', 'EMERGENCY', 'INSUFFICIENT_INFO');
CREATE TYPE triage_source       AS ENUM ('AI', 'DOCTOR');
CREATE TYPE assignment_method   AS ENUM ('PATIENT_SELECTED', 'AUTO_MATCH', 'REPLACEMENT_INVITE', 'MANUAL');
CREATE TYPE assignment_status   AS ENUM ('REQUESTED', 'ACCEPTED', 'ACKNOWLEDGED', 'DECLINED', 'EXPIRED', 'UNACCEPTED',
                                         'RELEASED', 'REPLACED', 'DONE');
CREATE TYPE replacement_source  AS ENUM ('NURSE_ABSENCE', 'NURSE_LATE', 'NO_SHOW_BOMB', 'COMPLAINT_LOCK',
                                         'STOP_BY_NURSE');
CREATE TYPE patient_choice      AS ENUM ('ACCEPT', 'CHOOSE_OTHER', 'RESCHEDULE', 'CANCEL', 'WAIT');

CREATE TYPE checkin_method      AS ENUM ('GEOFENCE_OTP', 'FALLBACK_PHOTO');
CREATE TYPE visit_code_purpose  AS ENUM ('CHECKIN', 'STATEMENT', 'ADDON', 'STOP');
CREATE TYPE report_status       AS ENUM ('DRAFT', 'INCOMPLETE', 'COMPLETE');
CREATE TYPE addon_status        AS ENUM ('PENDING_ASSESSMENT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
                                         'PENDING_PATIENT', 'AGREED', 'PATIENT_DECLINED', 'PERFORMED', 'CANCELLED');
CREATE TYPE stop_reason         AS ENUM ('PATIENT_REQUEST', 'PATIENT_CONDITION', 'MEDICAL_EMERGENCY',
                                         'UNSAFE_FOR_NURSE', 'NURSE_OR_HOSPITAL');

CREATE TYPE line_type           AS ENUM ('BASE_SERVICE', 'ADDON', 'SUPPLY', 'HOME_VISIT_FEE');
CREATE TYPE line_status         AS ENUM ('PERFORMED', 'STOPPED_MIDWAY', 'DISPUTED', 'DISPUTED_AFTER_PAYMENT', 'KEPT',
                                         'REDUCED', 'WAIVED', 'CANCELLED');
CREATE TYPE confirm_mode        AS ENUM ('EXPLICIT', 'DEFAULT_SILENCE');
CREATE TYPE payment_purpose     AS ENUM ('DEPOSIT', 'REMAINING', 'DEBT');
CREATE TYPE payment_method      AS ENUM ('GATEWAY', 'CASH');
CREATE TYPE txn_status          AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE refund_kind         AS ENUM ('AUTO_POLICY', 'EXCEPTION', 'MANUAL_AFTER_PAYMENT', 'OVERPAID_CANCELLED');
CREATE TYPE refund_status       AS ENUM ('CREATED', 'SUCCEEDED', 'FAILED', 'MANUAL_PENDING', 'MANUAL_DONE');
CREATE TYPE request_status      AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'AUTO_DECIDED');
CREATE TYPE cash_match_status   AS ENUM ('WAITING_PATIENT', 'MATCHED', 'DISPUTED', 'RESOLVED');
CREATE TYPE remittance_status   AS ENUM ('DECLARED', 'RECEIVED_FULL', 'RECEIVED_SHORT', 'RECEIVED_OVER');
CREATE TYPE invoice_kind        AS ENUM ('NORMAL', 'ADJUSTMENT');
CREATE TYPE invoice_status      AS ENUM ('PENDING', 'ISSUED', 'FAILED', 'CANCELLED');
CREATE TYPE entry_type          AS ENUM ('DEPOSIT_COLLECTED', 'DEPOSIT_DEDUCTED', 'DEPOSIT_REFUNDED',
                                         'DEPOSIT_WITHHELD', 'DEPOSIT_HELD_DISPUTE', 'BALANCE_COLLECTED',
                                         'REFUND_POSTPAYMENT', 'CASH_HELD_BY_NURSE', 'CASH_REMITTED',
                                         'NURSE_COMPENSATION', 'NURSE_DEDUCTION');
CREATE TYPE recon_status        AS ENUM ('OPEN', 'DISCREPANCY', 'CLOSED');
CREATE TYPE fee_invoice_status  AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE');

CREATE TYPE complaint_target    AS ENUM ('NURSE', 'PATIENT', 'PLATFORM', 'BILLING_LINE');
CREATE TYPE complaint_status    AS ENUM ('NEW', 'REJECTED_LATE', 'TEMP_LOCKED', 'IN_PROGRESS', 'CONCLUDED', 'APPEAL',
                                         'CLOSED');
CREATE TYPE handler_level       AS ENUM ('HOSPITAL', 'PLATFORM', 'HOSPITAL_CHIEF');
CREATE TYPE sos_source          AS ENUM ('PATIENT_BUTTON', 'NURSE_IN_VISIT', 'TRIAGE', 'AI_RISK', 'ADDON_C');
CREATE TYPE sos_status          AS ENUM ('NEW', 'NOTIFIED', 'ACKNOWLEDGED', 'ESCALATED', 'CLOSED');

CREATE TYPE risk_level          AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');
CREATE TYPE alert_status        AS ENUM ('NEW', 'REMINDED', 'REASSIGNED', 'REVIEWED');
CREATE TYPE followup_status     AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'DOCTOR_ASSIGNED', 'PLAN_APPROVED',
                                         'CLOSED');

CREATE TYPE deletion_status     AS ENUM ('SUBMITTED', 'DEFERRED', 'PROCESSING', 'REJECTED', 'COMPLETED');
CREATE TYPE deletion_action     AS ENUM ('DELETE', 'ANONYMIZE', 'RETAIN_LOCKED');

CREATE TYPE notify_channel      AS ENUM ('PUSH', 'EMAIL', 'IN_APP');
CREATE TYPE timer_status        AS ENUM ('PENDING', 'FIRED', 'CANCELLED');
CREATE TYPE decision_code       AS ENUM ('F1A', 'F1B', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9');
CREATE TYPE cancel_reason_code  AS ENUM ('PATIENT_REQUEST', 'SCREENING_EMERGENCY', 'CONSENT_WITHDRAWN',
                                         'NURSE_SIDE_FAILURE', 'NO_NURSE_AVAILABLE', 'DEPOSIT_TIMEOUT');

-- =====================================================================
-- @module: 1. Bệnh viện & cấu hình
-- =====================================================================
CREATE TABLE hospital (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text NOT NULL UNIQUE,
    name            text NOT NULL,
    tax_code        text,
    status          hospital_status NOT NULL DEFAULT 'ACTIVE',
    contract_start  date,
    contract_end    date,
    ai_enabled      boolean NOT NULL DEFAULT true,       -- BR-10: BV có thể tắt AI
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE hospital IS 'Bệnh viện (tenant) ký hợp đồng với nền tảng, đứng tên nhận tiền (UC80, BR-05)';

CREATE TABLE facility (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id          uuid NOT NULL REFERENCES hospital(id),
    name                 text NOT NULL,
    address              text NOT NULL,
    lat                  numeric(9,6) NOT NULL,
    lng                  numeric(9,6) NOT NULL,
    service_radius_km    numeric(5,1) NOT NULL DEFAULT 15,  -- BR-06
    max_travel_minutes   int NOT NULL DEFAULT 45,           -- BR-06
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE facility IS 'Cơ sở của bệnh viện; BN chọn cơ sở khi đặt lịch, vùng phục vụ tính theo cơ sở (BR-06)';

CREATE TABLE hospital_payment_account (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id        uuid NOT NULL REFERENCES hospital(id),
    gateway            text NOT NULL,                   -- tên cổng thanh toán
    merchant_id        text NOT NULL,
    account_holder     text NOT NULL,
    is_active          boolean NOT NULL DEFAULT true,
    linked_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (gateway, merchant_id)
);
COMMENT ON TABLE hospital_payment_account IS 'Tài khoản nhận tiền của BV liên kết cổng thanh toán (UC110)';

CREATE TABLE system_parameter (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             text NOT NULL,                      -- vd service_window.weekday, ack_timeout_minutes
    value           jsonb NOT NULL,
    effective_from  timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid,
    note            text,
    UNIQUE (key, effective_from)
);
COMMENT ON TABLE system_parameter IS 'Tham số chung do Admin nền tảng cấu hình theo ngày hiệu lực (UC109)';

CREATE TABLE hospital_setting (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    key             text NOT NULL,                      -- vd revenue_share_pct, deposit_pct, refund_table, max_open_orders
    value           jsonb NOT NULL,
    effective_from  timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid,
    UNIQUE (hospital_id, key, effective_from)
);
COMMENT ON TABLE hospital_setting IS 'Cấu hình riêng BV có ngày hiệu lực: tỷ lệ chia, mức phạt / hoàn, khung giờ trong khung chung… (UC108)';

-- =====================================================================
-- @module: 2. Tài khoản & phân quyền
-- =====================================================================
CREATE TABLE user_account (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               citext NOT NULL UNIQUE,         -- BR-20: chỉ email
    password_hash       text,
    account_type        account_type NOT NULL,
    status              account_status NOT NULL DEFAULT 'UNVERIFIED',
    email_verified_at   timestamptz,
    mfa_method          mfa_method,                     -- bắt buộc với ĐD, BS, QT BV, Admin (UC83)
    mfa_secret_enc      text,
    failed_login_count  int NOT NULL DEFAULT 0,
    locked_until        timestamptz,                    -- sai 5 lần / 15 phút (UC15)
    last_login_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (account_type = 'PATIENT' OR status <> 'ACTIVE' OR mfa_method IS NOT NULL)
);
COMMENT ON TABLE user_account IS 'Tài khoản đăng nhập bằng email cho mọi tác nhân (UC1, UC14, UC69)';

CREATE TABLE email_code (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           citext NOT NULL,
    account_id      uuid REFERENCES user_account(id),
    purpose         email_code_purpose NOT NULL,
    code_hash       text NOT NULL,
    expires_at      timestamptz NOT NULL,               -- 5 phút; đặt lại mật khẩu 15 phút; kích hoạt 72h
    attempt_count   int NOT NULL DEFAULT 0,             -- sai 3 lần → khóa 15 phút (luồng 02)
    used_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON email_code (email, purpose, created_at DESC);
COMMENT ON TABLE email_code IS 'Mã / link gửi qua email: đăng ký, 2 lớp, quên mật khẩu, kích hoạt, xác thực lại (BR-20)';

CREATE TABLE hospital_admin_role (
    account_id      uuid NOT NULL REFERENCES user_account(id),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    sub_role        hospital_sub_role NOT NULL,
    granted_by      uuid REFERENCES user_account(id),
    granted_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, hospital_id, sub_role)
);
COMMENT ON TABLE hospital_admin_role IS 'Vai trò con của Quản trị BV: trưởng / điều phối / kế toán / nhân sự – chất lượng (trang 13)';

CREATE TABLE terms_version (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version         text NOT NULL UNIQUE,
    content_url     text NOT NULL,
    is_material     boolean NOT NULL,                   -- trọng yếu → hỏi lại (BR-17, Q-47)
    effective_at    timestamptz NOT NULL
);

CREATE TABLE terms_acceptance (
    account_id        uuid NOT NULL REFERENCES user_account(id),
    terms_version_id  uuid NOT NULL REFERENCES terms_version(id),
    accepted_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, terms_version_id)
);
COMMENT ON TABLE terms_acceptance IS 'Đồng ý điều khoản theo phiên bản (UC138)';

CREATE TABLE audit_log (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_account_id   uuid REFERENCES user_account(id),
    actor_role         text,
    hospital_id        uuid REFERENCES hospital(id),
    action             text NOT NULL,                   -- view_profile, approve_staff, edit_report…
    entity_type        text NOT NULL,
    entity_id          uuid,
    patient_profile_id uuid,                            -- truy cập hồ sơ BN (BR-09)
    detail             jsonb,                           -- không chứa mật khẩu, token, nội dung sức khỏe thừa
    ip_address         inet,
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (entity_type, entity_id);
CREATE INDEX ON audit_log (patient_profile_id, created_at);
COMMENT ON TABLE audit_log IS 'Nhật ký kiểm toán & truy cập hồ sơ, chỉ ghi thêm (UC17, BR-09, BR-21)';

-- =====================================================================
-- @module: 3. Nhân sự (điều dưỡng, bác sĩ)
-- =====================================================================
CREATE TABLE staff_profile (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id          uuid NOT NULL REFERENCES hospital(id),
    facility_id          uuid NOT NULL REFERENCES facility(id),
    account_id           uuid UNIQUE REFERENCES user_account(id),   -- tạo khi 'Đã duyệt'
    staff_type           staff_type NOT NULL,
    email                citext NOT NULL,
    full_name            text NOT NULL,
    gender               gender,
    date_of_birth        date,
    license_no           text NOT NULL,                 -- số CCHN
    license_expiry       date,
    department           text,                          -- khoa (bác sĩ)
    specialty            text,
    bio                  text,                          -- thông tin nghề nghiệp hiển thị cho BN
    status               staff_status NOT NULL DEFAULT 'DRAFT',
    current_version      int NOT NULL DEFAULT 1,
    info_due_at          timestamptz,                   -- hạn bổ sung 7 ngày
    approved_at          timestamptz,
    activated_at         timestamptz,
    is_available_now     boolean NOT NULL DEFAULT false, -- 'Đang rảnh' (UC9)
    available_changed_at timestamptz,
    reputation_score     numeric(6,2) NOT NULL DEFAULT 100,
    priority_score       numeric(6,2) NOT NULL DEFAULT 100,  -- điểm gốc xếp hạng ghép đơn
    rating_avg           numeric(3,2),
    rating_count         int NOT NULL DEFAULT 0,
    created_by           uuid REFERENCES user_account(id),
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_staff_license_active ON staff_profile (license_no)
    WHERE status NOT IN ('REJECTED', 'INFO_EXPIRED', 'INACTIVE');
CREATE INDEX ix_staff_license_expiry ON staff_profile (license_expiry)
    WHERE status IN ('APPROVED', 'SUSPENDED');          -- job quét hạn CCHN hằng ngày (BR-21)
CREATE UNIQUE INDEX ux_staff_email_active ON staff_profile (email)
    WHERE status NOT IN ('REJECTED', 'INFO_EXPIRED', 'INACTIVE');
COMMENT ON TABLE staff_profile IS 'Hồ sơ nhân sự ĐD / BS gắn BV; trạng thái xác minh 2 bước (UC5–UC12, UC139, BR-21)';

CREATE TABLE staff_document (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    profile_version int NOT NULL,
    doc_type        text NOT NULL,                      -- cchn, degree, certificate (không có CCCD – BR-20)
    file_url        text NOT NULL,                      -- khóa đối tượng trên object storage, cấp signed URL có hạn
    file_hash       text NOT NULL,                      -- SHA-256, đối chiếu khi tranh chấp (BR-21)
    file_size       bigint NOT NULL,
    valid_until     date,
    uploaded_by     uuid REFERENCES user_account(id),
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_review_event (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    profile_version int NOT NULL,
    from_status     staff_status,
    to_status       staff_status NOT NULL,
    actor_id        uuid REFERENCES user_account(id),
    actor_role      text,
    reason          text,
    missing_items   jsonb,                              -- mục cần bổ sung
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staff_review_event IS 'Lịch sử duyệt / bổ sung / từ chối / khóa hồ sơ nhân sự (BR-21)';

CREATE TABLE nurse_skill (
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    service_id      uuid NOT NULL,                      -- FK thêm sau (service)
    PRIMARY KEY (staff_id, service_id)
);

CREATE TABLE nurse_service_area (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    center_lat      numeric(9,6) NOT NULL,
    center_lng      numeric(9,6) NOT NULL,
    radius_km       numeric(5,1) NOT NULL
);

CREATE TABLE nurse_availability (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    slot            tstzrange NOT NULL,                 -- trong khung giờ BR-03, tối đa 14 ngày tới
    created_at      timestamptz NOT NULL DEFAULT now(),
    EXCLUDE USING gist (staff_id WITH =, slot WITH &&)
);
COMMENT ON TABLE nurse_availability IS 'Lịch trống điều dưỡng khai báo cho 14 ngày tới (UC114)';

CREATE TABLE doctor_on_call_shift (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    facility_id     uuid NOT NULL REFERENCES facility(id),
    shift           tstzrange NOT NULL,
    is_backup       boolean NOT NULL DEFAULT false,     -- đầu mối dự phòng SOS (Q-48)
    EXCLUDE USING gist (staff_id WITH =, shift WITH &&)
);
COMMENT ON TABLE doctor_on_call_shift IS 'Lịch trực bác sĩ: phân loại khi AI lỗi, duyệt y lệnh, đầu mối SOS';

CREATE TABLE staff_lock (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    scope           staff_lock_scope NOT NULL,
    reason          text NOT NULL,                      -- no_ack, bomb, complaint_serious, report_overdue, cash_overdue, br02_4th…
    source_type     text,
    source_id       uuid,
    starts_at       timestamptz NOT NULL DEFAULT now(),
    auto_release_at timestamptz,                        -- vd 24h sau bom ca (Q-43); null = vô thời hạn
    released_at     timestamptz,
    released_by     uuid REFERENCES user_account(id),
    release_reason  text
);
CREATE INDEX ON staff_lock (staff_id) WHERE released_at IS NULL;
COMMENT ON TABLE staff_lock IS 'Tạm khóa kỹ thuật nhận ca (BR-01, BR-02, BR-05, BR-11, BR-22)';

CREATE TABLE staff_score_event (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    score_kind      text NOT NULL CHECK (score_kind IN ('reputation', 'priority', 'revenue_share')),
    delta           numeric(6,2) NOT NULL,              -- vd −20% ưu tiên, −15 điểm % tỷ lệ chia
    remaining_orders int,                               -- giảm tỷ lệ chia cho 3 ca tiếp theo
    expires_at      timestamptz,                        -- hồi phục khi ra khỏi cửa sổ 30 ngày
    violation_id    uuid,                               -- FK thêm sau
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- @module: 4. Bệnh nhân & đồng ý dữ liệu
-- =====================================================================
CREATE TABLE patient_profile (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_account_id  uuid REFERENCES user_account(id), -- null khi chủ tài khoản đã gỡ liên kết
    full_name         text NOT NULL,
    date_of_birth     date,                             -- tự khai, không xác minh (BR-20)
    gender            gender,
    relationship      relationship_type NOT NULL,
    relative_email    citext,                           -- người thân người lớn tự đồng ý qua email
    medical_notes     text,                             -- tiền sử tóm tắt (dữ liệu sức khỏe)
    is_active         boolean NOT NULL DEFAULT true,    -- false khi rút đồng ý / gỡ liên kết
    unlinked_at       timestamptz,
    anonymized_at     timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON patient_profile (owner_account_id);
COMMENT ON TABLE patient_profile IS 'Hồ sơ người được chăm sóc; một tài khoản quản lý nhiều hồ sơ người thân (UC3, UC4)';

CREATE TABLE patient_address (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES patient_profile(id),
    label           text,
    address_line    text NOT NULL,
    lat             numeric(9,6) NOT NULL,
    lng             numeric(9,6) NOT NULL,
    is_default      boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patient_consent (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          uuid NOT NULL REFERENCES patient_profile(id),
    terms_version_id    uuid NOT NULL REFERENCES terms_version(id),
    mode                consent_mode NOT NULL,
    status              consent_status NOT NULL DEFAULT 'PENDING',
    consenter_email     citext NOT NULL,
    representative_declared boolean NOT NULL DEFAULT false, -- cam kết người đại diện hợp pháp
    requested_at        timestamptz NOT NULL DEFAULT now(),
    respond_due_at      timestamptz,                    -- người thân đồng ý trong 24h
    granted_at          timestamptz,
    withdrawn_at        timestamptz,
    withdraw_verified_by text                           -- otp_email / email_link
);
CREATE UNIQUE INDEX ux_consent_current ON patient_consent (profile_id) WHERE status IN ('PENDING', 'GRANTED');
COMMENT ON TABLE patient_consent IS 'Consent xử lý dữ liệu sức khỏe theo từng hồ sơ (UC2, UC106, BR-17)';

CREATE TABLE medical_order (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id         uuid NOT NULL REFERENCES patient_profile(id),
    hospital_id        uuid NOT NULL REFERENCES hospital(id),
    file_url           text NOT NULL,                   -- khóa đối tượng trên object storage
    file_hash          text NOT NULL,                   -- căn cứ pháp lý cho dịch vụ đã làm (BR-15)
    issued_by_text     text,                            -- bác sĩ / nơi chỉ định
    issued_on          date,
    valid_until        date,
    review_status      review_status NOT NULL DEFAULT 'PENDING',
    reviewed_by        uuid REFERENCES staff_profile(id),
    review_due_at      timestamptz,                     -- 30 phút (BR-15)
    reviewed_at        timestamptz,
    review_note        text,
    uploaded_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE medical_order IS 'Chỉ định / y lệnh BN tải lên cho dịch vụ cần y lệnh, bác sĩ trực kiểm tra (UC136, UC137)';

CREATE TABLE patient_abuse_flag (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES user_account(id),
    flagged_at      timestamptz NOT NULL DEFAULT now(),
    event_count     int NOT NULL,                       -- ≥ 2 sự việc / 90 ngày cuộn
    feedback        text,                               -- BN phản hồi trong 7 ngày
    cleared_at      timestamptz,
    cleared_by      uuid REFERENCES user_account(id),
    clear_reason    text
);
CREATE UNIQUE INDEX ux_abuse_flag_open ON patient_abuse_flag (account_id) WHERE cleared_at IS NULL;
COMMENT ON TABLE patient_abuse_flag IS 'Cờ lạm dụng theo tài khoản BN, chỉ đổi người quyết khi quá hạn (BR-19)';

-- =====================================================================
-- @module: 5. Dịch vụ & bảng giá
-- =====================================================================
CREATE TABLE care_report_template (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    name            text NOT NULL,
    version         int NOT NULL,
    fields          jsonb NOT NULL,                     -- [{key, label, type, required}]
    approved_by     uuid REFERENCES user_account(id),   -- chuyên môn BV phê duyệt (Q-49)
    approved_at     timestamptz,
    UNIQUE (hospital_id, name, version)
);
COMMENT ON TABLE care_report_template IS 'Biểu mẫu báo cáo chăm sóc theo loại dịch vụ, có trường bắt buộc (BR-22)';

CREATE TABLE service (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id          uuid NOT NULL REFERENCES hospital(id),
    code                 text NOT NULL,
    name                 text NOT NULL,
    description          text,
    duration_minutes     int NOT NULL CHECK (duration_minutes > 0),
    allowed_at_home      boolean NOT NULL DEFAULT true,   -- BR-15
    requires_medical_order boolean NOT NULL DEFAULT false,
    addon_class          addon_class,                     -- phân loại khi phát sinh trong ca (07C)
    is_supply            boolean NOT NULL DEFAULT false,  -- vật tư
    report_template_id   uuid REFERENCES care_report_template(id),
    is_active            boolean NOT NULL DEFAULT true,
    UNIQUE (hospital_id, code)
);
COMMENT ON TABLE service IS 'Danh mục dịch vụ / vật tư của BV với cờ được phép tại nhà và cần y lệnh (UC84, BR-15)';

CREATE TABLE service_price (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id         uuid NOT NULL REFERENCES service(id),
    facility_id        uuid REFERENCES facility(id),      -- null = áp dụng toàn BV
    price              numeric(14,0) NOT NULL CHECK (price >= 0),
    home_visit_min_fee numeric(14,0),                     -- phí đến nhà tối thiểu (Q-03)
    effective_from     timestamptz NOT NULL,
    effective_to       timestamptz
);
CREATE INDEX ON service_price (service_id, effective_from DESC);

ALTER TABLE nurse_skill ADD FOREIGN KEY (service_id) REFERENCES service(id);

-- =====================================================================
-- @module: 6. Đặt lịch & điều phối
-- =====================================================================
CREATE TABLE care_order (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  text NOT NULL UNIQUE,
    booker_account_id     uuid NOT NULL REFERENCES user_account(id),
    booked_by_admin_id    uuid REFERENCES user_account(id),  -- đặt hộ qua tổng đài (UC135)
    profile_id            uuid NOT NULL REFERENCES patient_profile(id),
    hospital_id           uuid NOT NULL REFERENCES hospital(id),
    facility_id           uuid NOT NULL REFERENCES facility(id),
    service_id            uuid NOT NULL REFERENCES service(id),
    medical_order_id      uuid REFERENCES medical_order(id),
    parent_order_id       uuid REFERENCES care_order(id),    -- đơn con làm phần còn lại sau dừng ca (BR-16)
    terms_version_id      uuid REFERENCES terms_version(id), -- đơn chạy theo điều khoản đã đồng ý
    booking_type          booking_type NOT NULL,
    status                order_status NOT NULL DEFAULT 'DRAFT',
    payment_status        payment_status NOT NULL DEFAULT 'NONE',
    end_type              order_end_type,
    -- thời gian
    scheduled_start       timestamptz,                       -- null với đặt ngay
    duration_minutes      int NOT NULL,
    care_window           tstzrange,                         -- giờ hẹn → + thời lượng + 30' đệm (BR-14)
    departure_due_at      timestamptz,                       -- giờ phải xuất phát (BR-07)
    eta                   timestamptz,
    -- địa chỉ (chụp lại lúc đặt)
    address_id            uuid REFERENCES patient_address(id),
    address_text          text NOT NULL,
    lat                   numeric(9,6) NOT NULL,
    lng                   numeric(9,6) NOT NULL,
    -- ưu tiên & điều phối
    preferred_gender      gender,
    preferred_nurse_id    uuid REFERENCES staff_profile(id),
    assigned_nurse_id     uuid REFERENCES staff_profile(id),
    triage_result         triage_result,
    reschedule_count      int NOT NULL DEFAULT 0 CHECK (reschedule_count <= 2),
    -- tiền (chụp giá lúc đặt)
    base_price            numeric(14,0) NOT NULL,
    deposit_amount        numeric(14,0) NOT NULL DEFAULT 0,  -- 30%, tối thiểu 50.000đ; đơn con = 0
    deposit_due_at        timestamptz,                       -- 15 phút
    total_amount          numeric(14,0),                     -- dịch vụ + phát sinh sau chốt
    statement_confirm_mode confirm_mode,
    statement_confirmed_at timestamptz,
    payment_due_at        timestamptz,                       -- 'Chờ thanh toán' 24h
    -- hủy
    cancelled_at          timestamptz,
    cancelled_by          party_type,
    cancel_reason_code    cancel_reason_code,
    cancel_reason         text,                              -- ghi chú chi tiết
    refund_pct            int CHECK (refund_pct BETWEEN 0 AND 100),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (booking_type = 'INSTANT' OR scheduled_start IS NOT NULL),
    CHECK (cancelled_at IS NULL OR cancel_reason_code IS NOT NULL),
    EXCLUDE USING gist (profile_id WITH =, care_window WITH &&)
        WHERE (parent_order_id IS NULL AND status NOT IN ('CANCELLED', 'COMPLETED', 'DRAFT'))
);
CREATE INDEX ON care_order (hospital_id, status, scheduled_start);
CREATE INDEX ON care_order (assigned_nurse_id, scheduled_start);
CREATE INDEX ON care_order (booker_account_id) WHERE payment_status IN ('BALANCE_DUE_24H', 'IN_DEBT');
COMMENT ON TABLE care_order IS 'Đơn chăm sóc (hẹn trước / đặt ngay / đơn con); vòng đời ca và trạng thái tiền tách riêng (luồng 04–09, 15)';

CREATE TABLE order_status_history (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES care_order(id),
    field           text NOT NULL CHECK (field IN ('status', 'payment_status')),
    from_value      text,
    to_value        text NOT NULL,
    actor_type      party_type NOT NULL,
    actor_id        uuid,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON order_status_history (order_id, created_at);

CREATE TABLE triage_assessment (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid REFERENCES care_order(id),
    profile_id      uuid NOT NULL REFERENCES patient_profile(id),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    stage           text NOT NULL CHECK (stage IN ('booking', 'pre_visit_update')), -- luồng 04/05 hoặc 07A
    symptoms        jsonb NOT NULL,
    source          triage_source NOT NULL,
    result          triage_result,
    confidence      numeric(4,3),
    rule_version    text NOT NULL,                      -- phiên bản bộ quy tắc / danh mục dấu hiệu nguy hiểm
    model_version   text,                               -- null khi bác sĩ phân loại hoặc AI tắt
    supersedes_id   uuid REFERENCES triage_assessment(id), -- phân loại lại: dòng mới trỏ dòng gốc, không sửa tại chỗ
    resulting_cancellation_id uuid REFERENCES care_order(id), -- đơn bị hủy do kết quả EMERGENCY (07A)
    resulting_sos_incident_id uuid,                     -- FK thêm sau (sos_incident)
    nurse_notified_at timestamptz,                      -- 07A không khẩn cấp: đã báo ĐD
    doctor_id       uuid REFERENCES staff_profile(id),  -- bác sĩ trực phân loại khi AI lỗi (UC23)
    due_at          timestamptz,                        -- 10 phút
    callback_done_at timestamptz,                       -- 'cần NVYT đánh giá sớm'
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (resulting_cancellation_id IS NULL OR (resulting_cancellation_id = order_id AND result = 'EMERGENCY'))
);
CREATE INDEX ON triage_assessment (order_id, created_at);
CREATE INDEX ON triage_assessment (hospital_id, created_at) WHERE result = 'EMERGENCY';
-- 3.1a: mỗi đơn chỉ có một dòng sàng lọc khẩn cấp dẫn tới hủy → không sinh 2 lần hủy / 2 lệnh hoàn
CREATE UNIQUE INDEX ux_triage_one_cancellation ON triage_assessment (resulting_cancellation_id)
    WHERE resulting_cancellation_id IS NOT NULL;
COMMENT ON TABLE triage_assessment IS 'Phân loại triệu chứng 4 nhóm bằng AI hoặc bác sĩ trực; chỉ được bổ sung, không hạ mức (UC21–UC23, BR-10)';

CREATE TABLE order_assignment (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    nurse_id        uuid NOT NULL REFERENCES staff_profile(id),
    method          assignment_method NOT NULL,
    status          assignment_status NOT NULL,
    rank_score      numeric(8,3),                       -- điểm xếp hạng (AI hỗ trợ)
    requested_at    timestamptz NOT NULL DEFAULT now(),
    respond_due_at  timestamptz,                        -- 30' chỉ định; 5' 'Đã nhận đơn'; 30'/5' mời thay
    responded_at    timestamptz,
    slot_hold_until timestamptz,                        -- giữ slot tạm thời (UC28)
    reconfirmed_at  timestamptz,                        -- xác nhận lại T−2h (UC118)
    released_at     timestamptz,
    release_reason  text
);
CREATE INDEX ON order_assignment (order_id, requested_at);
CREATE INDEX ON order_assignment (nurse_id, status);
COMMENT ON TABLE order_assignment IS 'Mỗi lượt mời / gán ĐD cho đơn: BN chọn, tự gán, mời thay, điều thủ công (UC25, UC31–32, UC37, UC78, UC113–115)';

CREATE TABLE replacement_case (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid NOT NULL REFERENCES care_order(id),
    original_nurse_id   uuid NOT NULL REFERENCES staff_profile(id),
    source              replacement_source NOT NULL,
    reason_text         text,
    reported_at         timestamptz NOT NULL DEFAULT now(),
    needs_replacement   boolean NOT NULL,
    new_assignment_id   uuid REFERENCES order_assignment(id),
    patient_choice      patient_choice,
    choice_due_at       timestamptz,                    -- 15' (còn > 3h: 30')
    chosen_at           timestamptz,
    force_majeure       boolean,                        -- QT BV xác nhận (UC88)
    reviewed_by         uuid REFERENCES user_account(id),
    review_due_at       timestamptz,                    -- 24h nhắc / 72h quá hạn (F6)
    reviewed_at         timestamptz,
    closed_at           timestamptz
);
COMMENT ON TABLE replacement_case IS 'Báo nghỉ / đổi người / bom ca: tìm người thay và xét vi phạm một lần (luồng 06)';

CREATE TABLE order_reschedule (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    old_start       timestamptz NOT NULL,
    new_start       timestamptz NOT NULL,
    old_nurse_id    uuid REFERENCES staff_profile(id),
    new_nurse_id    uuid REFERENCES staff_profile(id),
    counts_toward_limit boolean NOT NULL DEFAULT true, -- 'đổi giờ' khi thay người không tính (BR-13)
    status          text NOT NULL CHECK (status IN ('pending_nurse', 'done', 'cancelled')),
    requested_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE order_reschedule IS 'Đổi lịch đơn đặt trước đã cọc, tối đa 2 lần (UC120, BR-13)';

-- =====================================================================
-- @module: 7. Thực hiện ca chăm sóc
-- =====================================================================
CREATE TABLE care_visit (
    order_id            uuid PRIMARY KEY REFERENCES care_order(id),
    nurse_id            uuid NOT NULL REFERENCES staff_profile(id),
    departed_at         timestamptz,                    -- bấm 'Xuất phát' (UC38)
    late_extensions     int NOT NULL DEFAULT 0 CHECK (late_extensions <= 2),
    arrived_at          timestamptz,
    checkin_at          timestamptz,
    checkin_method      checkin_method,
    checkin_photo_url   text,
    checkin_postcheck_by uuid REFERENCES user_account(id), -- QT BV hậu kiểm 24h
    patient_absent_at   timestamptz,                    -- UC89
    started_at          timestamptz,                    -- UC41
    initial_assessment  jsonb,                          -- trạng thái ban đầu theo biểu mẫu
    ended_at            timestamptz                     -- UC42 'Đã kết thúc'
);
COMMENT ON TABLE care_visit IS 'Diễn biến ca tại nhà: xuất phát, check-in, bắt đầu, kết thúc (luồng 07B)';

CREATE TABLE visit_location_point (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES care_order(id),
    nurse_id        uuid NOT NULL REFERENCES staff_profile(id),
    lat             numeric(9,6) NOT NULL,
    lng             numeric(9,6) NOT NULL,
    recorded_at     timestamptz NOT NULL
);
CREATE INDEX ON visit_location_point (order_id, recorded_at);
COMMENT ON TABLE visit_location_point IS 'Vị trí ĐD từ lúc xuất phát đến check-in; phát hiện tắt định vị > 10 phút (UC38, UC77)';

CREATE TABLE visit_code (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    purpose         visit_code_purpose NOT NULL,
    ref_id          uuid,                               -- addon_request / care_stop khi cần
    code_hash       text NOT NULL,
    expires_at      timestamptz NOT NULL,
    used_at         timestamptz
);
COMMENT ON TABLE visit_code IS 'Mã hiển thị trên app BN để xác nhận trong ca: check-in, bảng kê, phát sinh, dừng ca (BR-20)';

CREATE TABLE care_report (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         uuid NOT NULL UNIQUE REFERENCES care_order(id),
    template_id      uuid NOT NULL REFERENCES care_report_template(id),
    hospital_id      uuid NOT NULL REFERENCES hospital(id),
    profile_id       uuid NOT NULL REFERENCES patient_profile(id),
    data             jsonb NOT NULL DEFAULT '{}',       -- hoạt động, thời điểm, sự kiện
    status           report_status NOT NULL DEFAULT 'DRAFT',
    missing_fields   text[],
    submitted_at     timestamptz,
    completed_at     timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE care_report IS 'Báo cáo chăm sóc bắt buộc; đủ trường → ca Hoàn tất, lưu vào hồ sơ BN tại BV (UC43, UC44, BR-22)';

CREATE TABLE care_report_revision (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       uuid NOT NULL REFERENCES care_report(id),
    edited_by       uuid NOT NULL REFERENCES user_account(id),
    reason          text NOT NULL,
    old_data        jsonb NOT NULL,
    new_data        jsonb NOT NULL,
    edited_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE handover (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    from_nurse_id   uuid REFERENCES staff_profile(id),
    to_party        text NOT NULL,                      -- nurse / ems_115 / family
    to_nurse_id     uuid REFERENCES staff_profile(id),
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE handover IS 'Bàn giao khi thay người hoặc dừng ca: người giao, người nhận, nội dung (BR-22)';

CREATE TABLE addon_request (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           uuid NOT NULL REFERENCES care_order(id),
    service_id         uuid NOT NULL REFERENCES service(id),
    quantity           numeric(8,2) NOT NULL DEFAULT 1,
    unit_price         numeric(14,0) NOT NULL,          -- lấy từ bảng giá, không nhập tự do
    addon_class        addon_class NOT NULL,
    status             addon_status NOT NULL,
    proposed_by        party_type NOT NULL,
    checklist          jsonb,                           -- nhánh A
    approver_id        uuid REFERENCES staff_profile(id), -- nhánh B, hạn 10 phút
    approval_due_at    timestamptz,
    decided_at         timestamptz,
    reject_reason      text,
    patient_confirm_mode confirm_mode,
    patient_confirmed_at timestamptz,
    performed_by       uuid REFERENCES staff_profile(id),
    performed_at       timestamptz,
    result_note        text,
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE addon_request IS 'Dịch vụ phát sinh trong ca nhánh A / B / C (UC91, luồng 07C)';

CREATE TABLE care_stop (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           uuid NOT NULL UNIQUE REFERENCES care_order(id),
    initiated_by       party_type NOT NULL,
    reason             stop_reason NOT NULL,
    patient_state      text,
    provisional_fee    numeric(14,0) NOT NULL,          -- tạm tính theo lý do ĐD chọn
    final_fee          numeric(14,0),                   -- QT BV chỉ giữ hoặc giảm
    child_order_id     uuid REFERENCES care_order(id),
    reviewed_by        uuid REFERENCES user_account(id),
    review_due_at      timestamptz,                     -- 12h nhắc, 24h quá hạn (F9)
    reviewed_at        timestamptz,
    reason_verified    boolean,                         -- hậu kiểm 'không an toàn'; sai → vi phạm (Q-46)
    stopped_at         timestamptz NOT NULL DEFAULT now(),
    CHECK (final_fee IS NULL OR final_fee <= provisional_fee)
);
COMMENT ON TABLE care_stop IS 'Dừng ca giữa chừng: lý do, phí tạm tính / chốt, đơn con (UC127, UC128, BR-16)';

CREATE TABLE chat_message (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id        uuid NOT NULL REFERENCES care_order(id),
    sender_account_id uuid NOT NULL REFERENCES user_account(id),
    body            text,
    attachment_url  text,
    call_event      text,                               -- bắt đầu / kết thúc cuộc gọi trong app
    sent_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON chat_message (order_id, sent_at);
COMMENT ON TABLE chat_message IS 'Chat / gọi BN – ĐD trong app theo đơn, không dùng SĐT (UC133)';

CREATE TABLE nurse_rating (
    order_id        uuid PRIMARY KEY REFERENCES care_order(id),
    nurse_id        uuid NOT NULL REFERENCES staff_profile(id),
    rater_account_id uuid NOT NULL REFERENCES user_account(id),
    stars           smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE nurse_rating IS 'Đánh giá ĐD, không bắt buộc (UC50)';

-- =====================================================================
-- @module: 8. Bảng kê, thanh toán & hoàn tiền
-- =====================================================================
CREATE TABLE order_line (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    line_type       line_type NOT NULL,
    service_id      uuid REFERENCES service(id),
    addon_request_id uuid REFERENCES addon_request(id),
    description     text NOT NULL,
    quantity        numeric(8,2) NOT NULL DEFAULT 1,
    unit_price      numeric(14,0) NOT NULL,
    charge_pct      int NOT NULL DEFAULT 100,           -- 50% hạng mục dở dang do BN (BR-16)
    amount          numeric(14,0) NOT NULL,             -- số ban đầu
    final_amount    numeric(14,0),                      -- sau khiếu nại / dừng ca
    status          line_status NOT NULL DEFAULT 'PERFORMED',
    deposit_allocated numeric(14,0) NOT NULL DEFAULT 0  -- cọc phân bổ cho dòng (Q-30)
);
CREATE INDEX ON order_line (order_id);
COMMENT ON TABLE order_line IS 'Dòng bảng kê ca: dịch vụ gốc, phát sinh, vật tư, phí đến nhà (UC93)';

CREATE TABLE line_dispute (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id         uuid NOT NULL REFERENCES order_line(id),
    decision_code   decision_code NOT NULL CHECK (decision_code IN ('F1A', 'F1B')),
    reason          text NOT NULL,
    opened_at       timestamptz NOT NULL DEFAULT now(),
    remind_at       timestamptz,                        -- 48h
    due_at          timestamptz NOT NULL,               -- 5 ngày
    outcome         text CHECK (outcome IN ('keep', 'reduce', 'waive')),
    reduced_amount  numeric(14,0),
    decided_by      uuid REFERENCES user_account(id),
    decided_level   handler_level,
    decided_at      timestamptz
);
COMMENT ON TABLE line_dispute IS 'Khiếu nại dòng bảng kê trước (F1a) / sau thanh toán trong 24h (F1b)';

CREATE TABLE payment_transaction (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid NOT NULL REFERENCES care_order(id),
    hospital_id         uuid NOT NULL REFERENCES hospital(id),
    payment_account_id  uuid REFERENCES hospital_payment_account(id),
    purpose             payment_purpose NOT NULL,
    method              payment_method NOT NULL,
    amount              numeric(14,0) NOT NULL CHECK (amount > 0),
    status              txn_status NOT NULL DEFAULT 'PENDING',
    attempt_no          smallint NOT NULL DEFAULT 1,    -- tối đa 3 lần qua cổng
    gateway             text,                           -- null với tiền mặt
    gateway_txn_id      text,
    paid_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON payment_transaction (hospital_id, paid_at);
CREATE UNIQUE INDEX ux_payment_gateway_txn ON payment_transaction (gateway, gateway_txn_id)
    WHERE gateway_txn_id IS NOT NULL;                   -- webhook idempotent (3.1b)
COMMENT ON TABLE payment_transaction IS 'Giao dịch cọc / phần còn lại qua cổng hoặc tiền mặt; tiền về TK bệnh viện (UC45, UC46, UC121)';

CREATE TABLE gateway_webhook_event (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway         text NOT NULL,
    event_id        text NOT NULL,
    event_type      text NOT NULL,
    signature_valid boolean NOT NULL,
    payload         jsonb NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz,
    UNIQUE (gateway, event_id)                          -- chống xử lý trùng
);
COMMENT ON TABLE gateway_webhook_event IS 'Kết quả giao dịch / hoàn tiền do cổng gửi về (UC47, luồng 11 phần A)';

CREATE TABLE refund (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           uuid NOT NULL REFERENCES care_order(id),
    hospital_id        uuid NOT NULL REFERENCES hospital(id),
    payment_txn_id     uuid REFERENCES payment_transaction(id),
    kind               refund_kind NOT NULL,
    amount             numeric(14,0) NOT NULL CHECK (amount > 0),
    reason             text NOT NULL,
    status             refund_status NOT NULL DEFAULT 'CREATED',
    gateway_refund_id  text,
    evidence_url       text,                            -- chứng từ hoàn thủ công (khóa object storage)
    evidence_hash      text,                            -- chứng minh chứng từ không bị thay sau khi chốt
    CHECK (evidence_url IS NULL OR evidence_hash IS NOT NULL),
    decision_code      decision_code,
    created_by         uuid REFERENCES user_account(id),-- null = hệ thống tự tạo
    manual_due_at      timestamptz,                     -- F8: 3 ngày làm việc
    completed_at       timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE refund IS 'Lệnh hoàn tiền: tự động theo BR-04, ngoại lệ, thủ công sau thanh toán (UC90)';

CREATE TABLE deposit_exception_request (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    requester_id    uuid NOT NULL REFERENCES user_account(id),
    requested_pct   int NOT NULL CHECK (requested_pct BETWEEN 0 AND 100),
    reason          text NOT NULL,
    status          request_status NOT NULL DEFAULT 'PENDING',
    approved_pct    int,
    decided_by      uuid REFERENCES user_account(id),
    remind_at       timestamptz,                        -- 24h
    due_at          timestamptz NOT NULL,               -- 48h (F2)
    decided_at      timestamptz,
    refund_id       uuid REFERENCES refund(id)
);
COMMENT ON TABLE deposit_exception_request IS 'BN xin ngoại lệ hoàn cọc, QT BV duyệt (UC36, F2)';

CREATE TABLE cash_collection (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           uuid NOT NULL UNIQUE REFERENCES care_order(id),
    nurse_id           uuid NOT NULL REFERENCES staff_profile(id),
    nurse_amount       numeric(14,0) NOT NULL,          -- ĐD nhập (UC122)
    patient_amount     numeric(14,0),                   -- BN xác nhận (UC123)
    status             cash_match_status NOT NULL DEFAULT 'WAITING_PATIENT',
    resolved_amount    numeric(14,0),                   -- QT BV chốt khi lệch (F5)
    resolved_by        uuid REFERENCES user_account(id),
    resolve_due_at     timestamptz,
    payment_txn_id     uuid REFERENCES payment_transaction(id),
    collected_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE cash_collection IS 'Thu tiền mặt tại nhà, hai bên cùng xác nhận số tiền (UC122, UC123)';

CREATE TABLE cash_remittance (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id        uuid NOT NULL REFERENCES hospital(id),
    nurse_id           uuid NOT NULL REFERENCES staff_profile(id),
    declared_amount    numeric(14,0) NOT NULL,          -- ĐD bấm 'Đã nộp' (UC124)
    received_amount    numeric(14,0),                   -- thủ quỹ kiểm đếm (UC125)
    cashier_id         uuid REFERENCES user_account(id),
    status             remittance_status NOT NULL DEFAULT 'DECLARED',
    minutes_url        text,                            -- biên bản chênh lệch
    declared_at        timestamptz NOT NULL DEFAULT now(),
    received_at        timestamptz
);
COMMENT ON TABLE cash_remittance IS 'ĐD nộp tiền mặt về thủ quỹ BV, hạn 48h (luồng 10)';

CREATE TABLE financial_entry (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    order_id        uuid REFERENCES care_order(id),
    nurse_id        uuid REFERENCES staff_profile(id),  -- dùng cho sổ tiền mặt ĐD đang giữ
    entry_type      entry_type NOT NULL,
    amount          numeric(14,0) NOT NULL,             -- dương = tăng, âm = giảm
    source_type     text,                               -- payment_transaction, refund, cash_remittance…
    source_id       uuid,
    decision_code   decision_code,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON financial_entry (hospital_id, entry_type, created_at);
CREATE INDEX ON financial_entry (nurse_id, entry_type) WHERE nurse_id IS NOT NULL;
COMMENT ON TABLE financial_entry IS 'Sổ bút toán chỉ ghi thêm: cọc 4 nhóm, thu, hoàn, tiền mặt ĐD giữ / nộp, bù công (BR-04, BR-18)';

CREATE TABLE patient_invoice (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           uuid NOT NULL REFERENCES care_order(id),
    hospital_id        uuid NOT NULL REFERENCES hospital(id),
    kind               invoice_kind NOT NULL DEFAULT 'NORMAL',
    original_invoice_id uuid REFERENCES patient_invoice(id),
    total_amount       numeric(14,0) NOT NULL,
    deposit_deducted   numeric(14,0) NOT NULL DEFAULT 0,
    external_invoice_no text,                           -- số HĐĐT từ hệ thống hóa đơn BV
    status             invoice_status NOT NULL DEFAULT 'PENDING',
    issued_at          timestamptz
);
COMMENT ON TABLE patient_invoice IS 'Hóa đơn điện tử BV xuất cho BN, gồm hóa đơn điều chỉnh (UC126)';

-- =====================================================================
-- @module: 9. Đối soát & phí nền tảng
-- =====================================================================
CREATE TABLE reconciliation_period (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    period_month    date NOT NULL,                      -- ngày đầu tháng
    status          recon_status NOT NULL DEFAULT 'OPEN',
    totals          jsonb,                              -- cổng, tiền mặt, hoàn, cọc 4 nhóm
    statement_source text CHECK (statement_source IN ('api', 'upload')),
    statement_file_url text,                            -- sao kê dự phòng (UC111)
    closed_at       timestamptz,
    UNIQUE (hospital_id, period_month)
);
COMMENT ON TABLE reconciliation_period IS 'Kỳ đối chiếu tháng theo BV (UC48, luồng 11 phần B)';

CREATE TABLE reconciliation_discrepancy (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id       uuid NOT NULL REFERENCES reconciliation_period(id),
    order_id        uuid REFERENCES care_order(id),
    description     text NOT NULL,
    amount          numeric(14,0) NOT NULL,
    explanation     text,
    due_at          timestamptz NOT NULL,               -- 7 ngày (F7)
    resolution      text CHECK (resolution IN ('agreed', 'auto_accepted', 'carried_over')),
    carried_to_period_id uuid REFERENCES reconciliation_period(id),
    resolved_at     timestamptz
);

CREATE TABLE platform_fee_invoice (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    period_id       uuid NOT NULL UNIQUE REFERENCES reconciliation_period(id),
    gross_value     numeric(16,0) NOT NULL,             -- tổng giá trị ca hoàn thành, gồm phát sinh & tiền mặt
    fee_pct         numeric(5,2) NOT NULL,
    fixed_fee       numeric(14,0) NOT NULL DEFAULT 0,
    amount          numeric(16,0) NOT NULL,
    status          fee_invoice_status NOT NULL DEFAULT 'DRAFT',
    due_date        date,
    issued_at       timestamptz,
    paid_at         timestamptz
);
COMMENT ON TABLE platform_fee_invoice IS 'Hóa đơn phí nền tảng gửi BV (UC95, BR-05)';

CREATE TABLE nurse_earning_statement (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    nurse_id        uuid NOT NULL REFERENCES staff_profile(id),
    period_id       uuid NOT NULL REFERENCES reconciliation_period(id),
    gross_earning   numeric(14,0) NOT NULL,
    compensation    numeric(14,0) NOT NULL DEFAULT 0,  -- bù công (cọc giữ lại, BN vắng…)
    deduction       numeric(14,0) NOT NULL DEFAULT 0,  -- khoản ĐD chịu sau khiếu nại, ≤ 30% / kỳ (Q-10)
    net_earning     numeric(14,0) NOT NULL,
    approved_by     uuid REFERENCES user_account(id),
    approved_at     timestamptz,
    UNIQUE (nurse_id, period_id)
);

CREATE TABLE nurse_earning_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id    uuid NOT NULL REFERENCES nurse_earning_statement(id),
    order_id        uuid NOT NULL REFERENCES care_order(id),
    order_value     numeric(14,0) NOT NULL,
    share_pct       numeric(5,2) NOT NULL,              -- đã trừ giảm tỷ lệ chia do vi phạm
    amount          numeric(14,0) NOT NULL
);
COMMENT ON TABLE nurse_earning_item IS 'Chi tiết thu nhập ĐD theo đơn (UC96, UC97)';

-- =====================================================================
-- @module: 10. Khiếu nại, vi phạm, sự cố & SOS
-- =====================================================================
CREATE TABLE staff_violation (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id         uuid NOT NULL REFERENCES staff_profile(id),
    hospital_id      uuid NOT NULL REFERENCES hospital(id),
    order_id         uuid REFERENCES care_order(id),
    replacement_case_id uuid REFERENCES replacement_case(id),
    violation_type   violation_type NOT NULL,
    counter_group    text NOT NULL CHECK (counter_group IN ('BR01', 'BR02', 'BR22', 'other')),
    lead_time_minutes int,
    status           violation_status NOT NULL DEFAULT 'PENDING_REVIEW',
    decision_code    decision_code,
    reviewed_by      uuid REFERENCES user_account(id),
    reviewed_at      timestamptz,
    occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON staff_violation (staff_id, occurred_at);
CREATE INDEX ON staff_violation (staff_id, counter_group, occurred_at);
-- 3.1e: vi phạm một đơn chỉ xét một lần cho mỗi nhóm bộ đếm (luồng 06)
CREATE UNIQUE INDEX ux_violation_once_per_order ON staff_violation (order_id, counter_group)
    WHERE order_id IS NOT NULL AND status = 'CONFIRMED';
COMMENT ON TABLE staff_violation IS 'Nhật ký vi phạm ĐD; đếm cửa sổ 30 ngày cuộn theo nhóm BR-01 / BR-02 (UC33, UC72, UC79, UC88)';

ALTER TABLE staff_score_event ADD FOREIGN KEY (violation_id) REFERENCES staff_violation(id);

CREATE TABLE no_ack_event (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        uuid NOT NULL REFERENCES staff_profile(id),
    assignment_id   uuid NOT NULL REFERENCES order_assignment(id),
    violation_id    uuid REFERENCES staff_violation(id), -- lần thứ 3 / 30 ngày → ghi 1 vi phạm, đếm về 0
    occurred_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE no_ack_event IS 'Lần không bấm Đã nhận đơn trong 5 phút (BR-01)';

CREATE TABLE complaint (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code               text NOT NULL UNIQUE,
    hospital_id        uuid REFERENCES hospital(id),
    order_id           uuid REFERENCES care_order(id),
    complainant_account_id uuid NOT NULL REFERENCES user_account(id),
    complainant_type   party_type NOT NULL,             -- BN hoặc ĐD / QT BV (báo cáo hành vi BN)
    target_type        complaint_target NOT NULL,
    target_staff_id    uuid REFERENCES staff_profile(id),
    target_profile_id  uuid REFERENCES patient_profile(id),
    category           text NOT NULL,
    is_serious         boolean NOT NULL DEFAULT false,  -- an toàn, bạo lực, quấy rối, gian lận
    content            text NOT NULL,                   -- chuyển nguyên văn cho BV
    attachments        jsonb,
    status             complaint_status NOT NULL DEFAULT 'NEW',
    handler_level      handler_level,
    handler_id         uuid REFERENCES user_account(id),
    due_at             timestamptz,                     -- 3 / 5 ngày làm việc (F3)
    lock_confirm_due_at timestamptz,                    -- giữ / gỡ tạm khóa trong 4h
    conclusion         text,
    outcome            text CHECK (outcome IN ('upheld', 'partially_upheld', 'not_upheld')),
    compensation_amount numeric(14,0),
    liable_party       text CHECK (liable_party IN ('hospital', 'nurse', 'none')),
    decision_code      decision_code,
    parent_complaint_id uuid REFERENCES complaint(id),  -- phúc tra 1 lần (F4)
    submitted_at       timestamptz NOT NULL DEFAULT now(),
    concluded_at       timestamptz,
    closed_at          timestamptz
);
CREATE INDEX ON complaint (hospital_id, status);
COMMENT ON TABLE complaint IS 'Khiếu nại về ĐD / nền tảng, báo cáo hành vi BN, phúc tra (UC51–53, UC98–101, BR-11)';

CREATE TABLE complaint_event (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    uuid NOT NULL REFERENCES complaint(id),
    actor_id        uuid REFERENCES user_account(id),
    action          text NOT NULL,                      -- forward, remind, take_over, lock, unlock, conclude…
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incident_report (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    order_id        uuid REFERENCES care_order(id),
    reporter_id     uuid NOT NULL REFERENCES user_account(id),
    description     text NOT NULL,
    severity        text,
    actions_taken   text,
    occurred_at     timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE incident_report IS 'Sự cố tại nhà, ghi nhận riêng khỏi khiếu nại (UC134)';

CREATE TABLE sos_incident (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id       uuid REFERENCES hospital(id),
    order_id          uuid REFERENCES care_order(id),
    profile_id        uuid REFERENCES patient_profile(id),
    triggered_by      uuid REFERENCES user_account(id), -- null khi hệ thống kích hoạt
    source            sos_source NOT NULL,
    lat               numeric(9,6),                     -- nếu người dùng cho phép
    lng               numeric(9,6),
    status            sos_status NOT NULL DEFAULT 'NEW',
    ack_by            uuid REFERENCES user_account(id),
    ack_due_at        timestamptz,                      -- 5 phút
    ack_at            timestamptz,
    escalated_at      timestamptz,
    incident_report_id uuid REFERENCES incident_report(id),
    outcome           text,
    triggered_at      timestamptz NOT NULL DEFAULT now(),
    closed_at         timestamptz
);
COMMENT ON TABLE sos_incident IS 'SOS & ứng phó khẩn cấp; hệ thống không tự gọi 115 (UC92, UC140, BR-23)';

CREATE TABLE sos_escalation_event (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_incident_id     uuid NOT NULL REFERENCES sos_incident(id),
    level               smallint NOT NULL CHECK (level >= 1), -- 1 = đầu mối trực chính, 2 = dự phòng… (Q-48)
    notified_account_id uuid REFERENCES user_account(id),
    channel             notify_channel NOT NULL,
    sent_at             timestamptz NOT NULL,
    ack_at              timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON sos_escalation_event (sos_incident_id, level);
COMMENT ON TABLE sos_escalation_event IS 'Từng nấc báo SOS: đầu mối trực → quá 5 phút chưa xác nhận → đầu mối dự phòng, chỉ ghi thêm (BR-23)';

ALTER TABLE triage_assessment ADD FOREIGN KEY (resulting_sos_incident_id) REFERENCES sos_incident(id);

-- =====================================================================
-- @module: 11. AI rủi ro & tái khám
-- =====================================================================
CREATE TABLE risk_assessment (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       uuid NOT NULL REFERENCES care_report(id),
    hospital_id     uuid NOT NULL REFERENCES hospital(id),
    source          text NOT NULL CHECK (source IN ('ai', 'fallback_high')), -- AI lỗi / BV tắt AI → coi như cao
    attempts        smallint NOT NULL DEFAULT 1,
    risk_level      risk_level NOT NULL,
    summary         jsonb,
    model_version   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE risk_assessment IS 'AI phân tích rủi ro từ báo cáo chăm sóc (UC54)';

CREATE TABLE risk_alert (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id   uuid NOT NULL REFERENCES risk_assessment(id),
    doctor_id       uuid NOT NULL REFERENCES staff_profile(id),
    status          alert_status NOT NULL DEFAULT 'NEW',
    due_at          timestamptz NOT NULL,               -- 2h; quá 4h → QT BV phân công bác sĩ khác
    reassigned_from uuid REFERENCES staff_profile(id),
    doctor_conclusion text,
    needs_followup  boolean,
    adjusted_level  risk_level,
    reviewed_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE risk_alert IS 'Cảnh báo rủi ro cao gửi bác sĩ phụ trách / trực (UC55, UC68, UC103)';

CREATE TABLE followup_case (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id           uuid NOT NULL REFERENCES risk_alert(id),
    profile_id         uuid NOT NULL REFERENCES patient_profile(id),
    status             followup_status NOT NULL DEFAULT 'PROPOSED',
    chosen_hospital_id uuid REFERENCES hospital(id),
    patient_response_at timestamptz,
    assigned_doctor_id uuid REFERENCES staff_profile(id),  -- QT BV phân công trong 24h (UC13)
    assigned_by        uuid REFERENCES user_account(id),
    plan               jsonb,                              -- kế hoạch tái khám (UC60)
    plan_approved_at   timestamptz,
    closed_at          timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE followup_case IS 'Đề xuất → xác nhận → phân công → kế hoạch tái khám (UC56, UC57, UC13, UC60)';

CREATE TABLE doctor_access_grant (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id       uuid NOT NULL REFERENCES staff_profile(id),
    profile_id      uuid NOT NULL REFERENCES patient_profile(id),
    hospital_id     uuid NOT NULL REFERENCES hospital(id), -- chỉ lịch sử tại BV này (Q-20)
    followup_id     uuid REFERENCES followup_case(id),
    valid_from      timestamptz NOT NULL DEFAULT now(),
    valid_until     timestamptz NOT NULL,
    revoked_at      timestamptz,
    revoked_by      uuid REFERENCES user_account(id)
);
CREATE INDEX ON doctor_access_grant (doctor_id, profile_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE doctor_access_grant IS 'Quyền có thời hạn cho bác sĩ xem lịch sử chăm sóc tại BV mình; BN thu hồi được (UC58, UC59, UC102)';

-- =====================================================================
-- @module: 12. Dữ liệu cá nhân (xóa dữ liệu)
-- =====================================================================
CREATE TABLE data_deletion_request (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_account_id uuid REFERENCES user_account(id), -- null khi người thân yêu cầu qua link email
    requester_email    citext NOT NULL,
    scope              text NOT NULL CHECK (scope IN ('account', 'profile', 'unlink_profile')),
    profile_id         uuid REFERENCES patient_profile(id),
    verified_at        timestamptz,                         -- OTP email / link email
    status             deletion_status NOT NULL DEFAULT 'SUBMITTED',
    blockers           jsonb,                               -- đơn đang chạy, khiếu nại, công nợ, hoàn tiền, tái khám
    clock_started_at   timestamptz,                         -- hết ràng buộc → tính 72h
    due_at             timestamptz,
    warned_24h_at      timestamptz,
    overdue_at         timestamptz,
    reviewed_by        uuid REFERENCES user_account(id),
    rejection_reason   text,
    completed_at       timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE data_deletion_request IS 'Yêu cầu xóa dữ liệu, xử lý trong 72h (UC61–UC65, UC105, BR-12)';

CREATE TABLE data_deletion_item (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      uuid NOT NULL REFERENCES data_deletion_request(id),
    hospital_id     uuid REFERENCES hospital(id),           -- cả bản đã chia sẻ cho BV
    data_category   text NOT NULL,                          -- care_report, payment_doc, chat, address…
    action          deletion_action NOT NULL,
    legal_basis     text,                                   -- lý do phải lưu theo luật (UC104)
    decided_by      uuid REFERENCES user_account(id),
    done_at         timestamptz
);

-- =====================================================================
-- @module: 13. Thông báo, hẹn giờ & quyết định tự động
-- =====================================================================
CREATE TABLE notification (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_id    uuid REFERENCES user_account(id),
    recipient_email citext,                                 -- người thân chưa có tài khoản
    channel         notify_channel NOT NULL,
    type            text NOT NULL,
    entity_type     text,
    entity_id       uuid,
    payload         jsonb,                                  -- không chứa nội dung sức khỏe thừa
    sent_at         timestamptz,
    read_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON notification (recipient_id, created_at DESC);

CREATE TABLE scheduled_timer (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timer_type      text NOT NULL,          -- ack_5m, deposit_15m, nurse_reply_30m, reconfirm_t2h, report_2h_24h,
                                            -- payment_24h, cash_48h, sos_ack_5m, alert_2h_4h, deletion_72h…
    entity_type     text NOT NULL,
    entity_id       uuid NOT NULL,
    due_at          timestamptz NOT NULL,
    status          timer_status NOT NULL DEFAULT 'PENDING',
    fired_at        timestamptz,
    cancelled_reason text
);
CREATE INDEX ON scheduled_timer (due_at) WHERE status = 'PENDING';
CREATE UNIQUE INDEX ux_timer_one_pending ON scheduled_timer (timer_type, entity_type, entity_id)
    WHERE status = 'PENDING';                           -- 3.1c
COMMENT ON TABLE scheduled_timer IS 'Bộ hẹn giờ ⏱ của các luồng; worker quét due_at để chạy hành động hết hạn';

CREATE TABLE overdue_decision (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_code   decision_code NOT NULL,
    entity_type     text NOT NULL,
    entity_id       uuid NOT NULL,
    hospital_id     uuid REFERENCES hospital(id),
    responsible_role text NOT NULL,
    deadline_at     timestamptz NOT NULL,
    patient_flagged boolean NOT NULL DEFAULT false,         -- BN có cờ lạm dụng → Admin quyết
    default_applied text,                                   -- null khi chưa tới hạn / chưa quyết
    reason          text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    decided_at      timestamptz,
    CHECK (decided_at IS NULL OR default_applied IS NOT NULL)
);
CREATE INDEX ON overdue_decision (responsible_role, deadline_at) WHERE decided_at IS NULL;
COMMENT ON TABLE overdue_decision IS 'Quyết định tài chính tự động khi quá hạn, lưu mã Fx + mốc + lý do (BR-18, trang 14)';
