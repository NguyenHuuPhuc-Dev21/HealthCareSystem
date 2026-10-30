-- ============================================================================
-- HealthCareSystem — On-Demand Nursing
-- Database schema (PostgreSQL 16)
--
-- Sources (reconciled in this order):
--   1. ERD_Diagram.drawio — "Detailed ERD" page: 25 tables
--      (16 tables from SRS v2.0 §7 + 9 added tables marked "(+)" in the ERD)
--   2. SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated,
--      28/10/2026), §7 (16 tables), §5.1 (system_configs), §5.2 (SLA matrix)
--   3. docs/development/development_checklist.md — Golden Rules
--      (integer VND money, append-only ledger, profile_status source of truth)
--
-- Deviations from the ERD drawing are deliberate and listed in
-- Ghi-chu-doi-chieu-ERD-SRS.md in this folder (D-01 … D-12).
--
-- Tables marked [Phase 2] exist in the schema (the ERD draws them) but no MVP
-- flow may write to them: contracts, contract_applications (FR-BOOK-04/05).
--
-- Apply on an empty database:
--   psql -v ON_ERROR_STOP=1 -d <database> -f schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- nurse double-booking exclusion

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE gender_enum AS ENUM ('MALE', 'FEMALE', 'OTHER');

CREATE TYPE user_role_enum AS ENUM ('PATIENT', 'NURSE', 'ADMIN');

CREATE TYPE kyc_status_enum AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

CREATE TYPE user_status_enum AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');

CREATE TYPE nurse_tier_enum AS ENUM ('TIER_1_BASIC', 'TIER_2_SPECIALIST');

CREATE TYPE profile_status_enum AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED');

CREATE TYPE doc_type_enum AS ENUM ('CCCD', 'DEGREE', 'GPHN', 'RETIREMENT_DECISION');

CREATE TYPE verification_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE mobility_status_enum AS ENUM ('NORMAL', 'PARTIAL', 'BEDRIDDEN');

CREATE TYPE location_type_enum AS ENUM ('HOSPITAL', 'HOME');

CREATE TYPE privacy_request_type_enum AS ENUM ('DELETE', 'ANONYMIZE');

CREATE TYPE privacy_request_status_enum AS ENUM ('PENDING', 'DONE', 'REJECTED');

CREATE TYPE service_type_enum AS ENUM ('TASK_BASED', 'SHIFT_BASED', 'CONTRACT');

CREATE TYPE service_unit_enum AS ENUM ('PER_TIME', 'PER_HOUR', 'PER_SHIFT');

CREATE TYPE holiday_type_enum AS ENUM ('TET', 'PUBLIC_HOLIDAY');

CREATE TYPE matching_mode_enum AS ENUM ('RADAR_DISPATCH', 'JOB_BOARD');

CREATE TYPE payment_method_enum AS ENUM ('BANK_TRANSFER', 'CASH');

CREATE TYPE execution_status_enum AS ENUM
    ('DRAFT', 'MATCHING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

CREATE TYPE payment_status_enum AS ENUM
    ('UNPAID', 'ESCROW_HELD', 'SETTLED', 'REFUNDED', 'PARTIALLY_SETTLED');

CREATE TYPE booking_dispute_status_enum AS ENUM
    ('NONE', 'OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_NURSE', 'RESOLVED_PARTIAL');

CREATE TYPE offer_type_enum AS ENUM ('RADAR', 'DIRECT_REQUEST', 'JOB_BOARD');

CREATE TYPE offer_status_enum AS ENUM ('SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'LOST_RACE');

CREATE TYPE adjustment_type_enum AS ENUM ('EXTENSION', 'CONDITION_SURCHARGE');

CREATE TYPE adjustment_status_enum AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'PAID');

CREATE TYPE wallet_status_enum AS ENUM ('ACTIVE', 'FROZEN');

CREATE TYPE balance_type_enum AS ENUM ('AVAILABLE', 'ESCROW_LOCKED', 'DEPOSIT');

CREATE TYPE tx_type_enum AS ENUM
    ('TOPUP', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'COMMISSION_PAYMENT',
     'PENALTY_DEDUCT', 'URGENT_BONUS', 'REFUND', 'PARTIAL_SETTLE', 'WITHDRAW');

CREATE TYPE tx_status_enum AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TYPE withdrawal_status_enum AS ENUM ('WITHDRAW_REQUESTED', 'WITHDRAWN', 'REJECTED');

CREATE TYPE voucher_status_enum AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

CREATE TYPE dispute_status_enum AS ENUM
    ('OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_NURSE', 'RESOLVED_PARTIAL');

CREATE TYPE reviewer_role_enum AS ENUM ('PATIENT', 'NURSE');

CREATE TYPE message_type_enum AS ENUM ('TEXT', 'IMAGE', 'VOICE_CALL_LOG', 'SYSTEM_ALERT');

CREATE TYPE notification_channel_enum AS ENUM ('PUSH_FCM', 'IN_APP', 'SMS_FALLBACK');

CREATE TYPE notification_priority_enum AS ENUM ('NORMAL', 'HIGH');

CREATE TYPE delivery_status_enum AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TYPE availability_type_enum AS ENUM ('RECURRING_AVAILABLE', 'TIME_OFF_EXCEPTION');

CREATE TYPE config_data_type_enum AS ENUM ('NUMBER', 'STRING', 'BOOLEAN', 'JSON');

CREATE TYPE audit_action_enum AS ENUM
    ('VIEW_MEDICAL_RECORD', 'APPROVE_GPHN', 'RESOLVE_DISPUTE',
     'UPDATE_CONFIG', 'DELETE_PATIENT_DATA', 'GRANT_RECORD_ACCESS');

CREATE TYPE contract_status_enum AS ENUM
    ('OPEN', 'TRIAL', 'ACTIVE', 'PAUSED', 'TERMINATED', 'COMPLETED');

CREATE TYPE application_status_enum AS ENUM ('APPLIED', 'TRIAL', 'SELECTED', 'REJECTED');

-- ============================================================================
-- 1. IDENTITY — users, nurse_profiles, nurse_credentials, nurse_availabilities
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    phone VARCHAR(20) NOT NULL UNIQUE, -- login identity (phone + OTP)
    email VARCHAR(255),
    password_hash VARCHAR(255), -- NULL for OTP-only accounts (see notes D-09)
    full_name VARCHAR(150) NOT NULL,
    avatar_url VARCHAR(500),
    gender gender_enum, -- (+) in ERD
    role user_role_enum NOT NULL,
    kyc_status kyc_status_enum NOT NULL DEFAULT 'UNVERIFIED',
    cccd_number VARCHAR(20),
    kyc_documents JSONB, -- (+) in ERD: CCCD front/back, selfie (private storage keys)
    status user_status_enum NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_cccd_number ON users (cccd_number)
WHERE
    cccd_number IS NOT NULL;

COMMENT ON TABLE users IS 'SRS §7 table 1. Account root; phone is the login identity.  users.status is never used for nurse job eligibility — see nurse_profiles.profile_status.';

CREATE TABLE nurse_profiles (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    tier nurse_tier_enum NOT NULL DEFAULT 'TIER_1_BASIC',
    gphn_number VARCHAR(50),
    gphn_expiry_date DATE,
    scope_of_practice VARCHAR(255),
    years_of_exp INT NOT NULL DEFAULT 0 CHECK (years_of_exp >= 0),
    is_retired_medical_staff BOOLEAN NOT NULL DEFAULT FALSE,
    current_lat NUMERIC(10, 7),
    current_lng NUMERIC(10, 7),
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    trust_score INT NOT NULL DEFAULT 100 CHECK (trust_score BETWEEN 0 AND 100),
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
    profile_status profile_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
    suspended_reason VARCHAR(255), -- (+) in ERD
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- added (D-07)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- added (D-07)
);

CREATE INDEX idx_nurse_profiles_gphn_expiry ON nurse_profiles (gphn_expiry_date);

CREATE INDEX idx_nurse_profiles_status_tier ON nurse_profiles (profile_status, tier);

COMMENT ON TABLE nurse_profiles IS 'SRS §7 table 2. profile_status is the SINGLE SOURCE OF TRUTH  for job eligibility (development checklist §1.2). gphn_expiry_date drives the daily tier sweep.';

CREATE TABLE nurse_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    nurse_id UUID NOT NULL REFERENCES nurse_profiles (user_id) ON DELETE CASCADE,
    doc_type doc_type_enum NOT NULL,
    file_url VARCHAR(500) NOT NULL, -- private object storage key, never a public URL
    issued_date DATE,
    expiry_date DATE,
    verification_status verification_status_enum NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users (id), -- the reviewing Admin
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- added (D-07): orders GPHN renewals
    CHECK (
        issued_date IS NULL
        OR expiry_date IS NULL
        OR expiry_date >= issued_date
    )
);

CREATE INDEX idx_nurse_credentials_nurse ON nurse_credentials (nurse_id, verification_status);

COMMENT ON TABLE nurse_credentials IS 'SRS §7 table 3. A renewed GPHN is a new row in PENDING  until an Admin approves it (FR-AUTH-01/02).';

CREATE TABLE nurse_availabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    nurse_id UUID NOT NULL REFERENCES nurse_profiles (user_id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday … 6 = Saturday
    specific_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    availability_type availability_type_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time),
    CHECK (
        (
            availability_type = 'RECURRING_AVAILABLE'
            AND day_of_week IS NOT NULL
            AND specific_date IS NULL
        )
        OR (
            availability_type = 'TIME_OFF_EXCEPTION'
            AND specific_date IS NOT NULL
            AND day_of_week IS NULL
        )
    )
);

CREATE INDEX idx_availabilities_nurse ON nurse_availabilities (nurse_id, availability_type);

COMMENT ON TABLE nurse_availabilities IS 'SRS §7 table 10 (FR-SCHED-01). Recurring weekly windows  or one-off time-off dates; the availability engine subtracts confirmed bookings + 60-min travel buffer.';

-- ============================================================================
-- 2. PATIENTS & PRIVACY — patient_profiles, privacy_requests (+)
-- ============================================================================

CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    customer_id UUID NOT NULL REFERENCES users (id),
    full_name VARCHAR(150) NOT NULL,
    dob DATE,
    gender gender_enum,
    weight_kg NUMERIC(5, 1) CHECK (weight_kg > 0),
    mobility_status mobility_status_enum NOT NULL DEFAULT 'NORMAL',
    medical_history TEXT,
    is_infectious BOOLEAN NOT NULL DEFAULT FALSE,
    address_text VARCHAR(500),
    location_type location_type_enum NOT NULL,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    data_consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_ip VARCHAR(45), -- (+) in ERD
    consent_device_id VARCHAR(255), -- (+) in ERD
    deleted_at TIMESTAMPTZ, -- soft delete / anonymization (Decree 13/2023)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- added (D-07)
    CHECK (
        data_consent_accepted = FALSE
        OR consent_timestamp IS NOT NULL
    )
);

CREATE INDEX idx_patient_profiles_customer ON patient_profiles (customer_id)
WHERE
    deleted_at IS NULL;

COMMENT ON TABLE patient_profiles IS 'SRS §7 table 4 (FR-AUTH-03). The condition declaration is  binding: it drives pricing (heavy-patient surcharge) and on-site verification.';

CREATE TABLE privacy_requests ( -- (+) added table
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    customer_id UUID NOT NULL REFERENCES users (id),
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles (id),
    request_type privacy_request_type_enum NOT NULL,
    status privacy_request_status_enum NOT NULL DEFAULT 'PENDING',
    processed_by UUID REFERENCES users (id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_privacy_requests_customer ON privacy_requests (customer_id, status);

-- ============================================================================
-- 3. CATALOG & PRICING INPUTS — service_categories, public_holidays (+)
-- ============================================================================

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    service_type service_type_enum NOT NULL,
    is_invasive BOOLEAN NOT NULL DEFAULT FALSE, -- hard tier gate (Tier 2 only)
    is_prohibited BOOLEAN NOT NULL DEFAULT FALSE, -- can never be booked
    required_tier nurse_tier_enum NOT NULL DEFAULT 'TIER_1_BASIC', -- SRS §7 values (D-01)
    base_price BIGINT NOT NULL CHECK (base_price >= 0), -- integer VND (D-05)
    unit service_unit_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- added (D-07)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- added (D-07)
);

COMMENT ON TABLE service_categories IS 'SRS §7 table 5 (§4.2 catalog, 3 groups).  is_prohibited = TRUE rows exist only so the booking path can block them.';

CREATE TABLE public_holidays ( -- (+) added table
    holiday_date DATE PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    holiday_type holiday_type_enum NOT NULL, -- TET = major (+300%), PUBLIC_HOLIDAY = minor (+200%)
    surcharge_rate NUMERIC(5, 2) NOT NULL CHECK (surcharge_rate >= 0) -- 3.00 for TET, 2.00 otherwise
);

COMMENT ON TABLE public_holidays IS 'Holiday calendar feeding pricing-engine (FR-BOOK-01).  Which dates belong here beyond Tết is an open SRS item (OD register) — no rows are seeded.';

-- ============================================================================
-- 4. CONTRACTS [Phase 2] — contracts (+), contract_applications (+)
--    Drawn in the ERD; no MVP flow writes here (FR-BOOK-04/05 are Phase 2).
-- ============================================================================

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    customer_id UUID NOT NULL REFERENCES users (id),
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles (id),
    service_id UUID NOT NULL REFERENCES service_categories (id),
    selected_nurse_id UUID REFERENCES users (id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status contract_status_enum NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE TABLE contract_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    contract_id UUID NOT NULL REFERENCES contracts (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    trial_booking_id UUID, -- FK added after bookings exists (below)
    status application_status_enum NOT NULL DEFAULT 'APPLIED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contract_id, nurse_id) -- added (D-11): one application per nurse per contract
);

-- ============================================================================
-- 5. BOOKINGS & SHIFT EXECUTION — bookings, booking_offers (+), shift_logs,
--    booking_adjustments (+)
-- ============================================================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES users (id),
    patient_profile_id UUID NOT NULL REFERENCES patient_profiles (id),
    nurse_id UUID REFERENCES users (id), -- NULL until matched
    service_id UUID NOT NULL REFERENCES service_categories (id),
    contract_id UUID REFERENCES contracts (id), -- (+) in ERD [Phase 2 link]
    matching_mode matching_mode_enum NOT NULL,
    payment_method payment_method_enum NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    hold_expires_at TIMESTAMPTZ, -- (+) in ERD: payment hold, start + 15 min
    prescription_image_url VARCHAR(500), -- private storage key
    prescription_issued_date DATE,
    prescription_verified_by_nurse BOOLEAN NOT NULL DEFAULT FALSE,
    base_amount BIGINT NOT NULL CHECK (base_amount >= 0),
    surcharge_amount BIGINT NOT NULL DEFAULT 0 CHECK (surcharge_amount >= 0),
    urgent_bonus_amount BIGINT NOT NULL DEFAULT 0 CHECK (urgent_bonus_amount >= 0),
    platform_fee BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    execution_status execution_status_enum NOT NULL DEFAULT 'DRAFT',
    payment_status payment_status_enum NOT NULL DEFAULT 'UNPAID',
    dispute_status booking_dispute_status_enum NOT NULL DEFAULT 'NONE',
    commission_due_at TIMESTAMPTZ, -- (+) in ERD: CASH orders, check-out + 24h
    settled_at TIMESTAMPTZ, -- (+) in ERD
    cancelled_by UUID REFERENCES users (id),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ, -- (+) in ERD
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- added (D-07)
    CHECK (end_time > start_time)
);

CREATE INDEX idx_bookings_customer ON bookings (customer_id, created_at DESC);

CREATE INDEX idx_bookings_nurse_schedule ON bookings (nurse_id, start_time)
WHERE
    nurse_id IS NOT NULL;

CREATE INDEX idx_bookings_execution ON bookings (execution_status, start_time);

CREATE INDEX idx_bookings_patient ON bookings (patient_profile_id);

CREATE INDEX idx_bookings_contract ON bookings (contract_id)
WHERE
    contract_id IS NOT NULL;

-- A nurse can never hold two overlapping CONFIRMED / IN_PROGRESS bookings.
ALTER TABLE bookings
ADD CONSTRAINT ex_bookings_nurse_no_overlap EXCLUDE USING gist (
    nurse_id
    WITH
        =,
        tstzrange (start_time, end_time)
    WITH
        &&
)
WHERE (
        nurse_id IS NOT NULL
        AND execution_status IN ('CONFIRMED', 'IN_PROGRESS')
    );

COMMENT ON TABLE bookings IS 'SRS §7 table 6 — the central table. Three INDEPENDENT status axes  (execution / payment / dispute). Amount columns are an immutable price snapshot taken at creation;  PARTIALLY_SETTLED and RESOLVED_PARTIAL are Phase-2 values no MVP flow may produce.';

ALTER TABLE contract_applications
ADD CONSTRAINT fk_contract_applications_trial_booking FOREIGN KEY (trial_booking_id) REFERENCES bookings (id);

CREATE TABLE booking_offers ( -- (+) added table
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    offer_type offer_type_enum NOT NULL, -- RADAR | DIRECT_REQUEST | JOB_BOARD
    radius_km INT CHECK (
        radius_km IS NULL
        OR radius_km IN (5, 10)
    ), -- RADAR rounds only (D-10)
    round_no INT NOT NULL DEFAULT 1 CHECK (round_no >= 1),
    status offer_status_enum NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ
);

CREATE INDEX idx_booking_offers_booking ON booking_offers (booking_id, status);

CREATE INDEX idx_booking_offers_nurse ON booking_offers (nurse_id, status);

COMMENT ON TABLE booking_offers IS 'One row per dispatch attempt (FR-BOOK-03): Radar rounds  (5 km then 10 km), direct invites (15-min response window) and Job Board broadcasts.  LOST_RACE records nurses who accepted after the first-accept lock was taken.';

CREATE TABLE shift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings (id),
    checkin_time TIMESTAMPTZ,
    checkin_lat NUMERIC(10, 7),
    checkin_lng NUMERIC(10, 7),
    is_mock_location_detected BOOLEAN NOT NULL DEFAULT FALSE,
    checkin_selfie_url VARCHAR(500), -- private storage key, server timestamp + GPS stamped
    condition_mismatch_reported BOOLEAN NOT NULL DEFAULT FALSE,
    checkout_time TIMESTAMPTZ, -- anchor of the +12h record-access and +24h settlement clocks
    vital_signs_log JSONB,
    care_activities_log JSONB,
    handover_note TEXT, -- (+) in ERD
    emergency_incident_log JSONB
);

COMMENT ON TABLE shift_logs IS 'SRS §7 table 7 (FR-SHIFT-01/02/04/05). One log per booking.  checkout_time is the single anchor for the record-access closure and settlement/dispute windows.';

CREATE TABLE booking_adjustments ( -- (+) added table
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    requested_by UUID NOT NULL REFERENCES users (id),
    adjustment_type adjustment_type_enum NOT NULL, -- EXTENSION | CONDITION_SURCHARGE
    extra_hours INT CHECK (extra_hours > 0),
    extra_amount BIGINT NOT NULL DEFAULT 0 CHECK (extra_amount >= 0),
    status adjustment_status_enum NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CHECK (
        adjustment_type <> 'EXTENSION'
        OR extra_hours IS NOT NULL
    )
);

CREATE INDEX idx_booking_adjustments_booking ON booking_adjustments (booking_id, status);

COMMENT ON TABLE booking_adjustments IS 'Shift extensions (FR-SHIFT-03, 1-hour blocks) and  condition-mismatch surcharge requests (FR-SHIFT-02) as auditable request/response rows.';

-- ============================================================================
-- 6. MONEY — wallets, wallet_transactions, withdrawal_requests (+), vouchers (+)
-- ============================================================================

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL UNIQUE REFERENCES users (id),
    available_balance BIGINT NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    escrow_locked_balance BIGINT NOT NULL DEFAULT 0 CHECK (escrow_locked_balance >= 0),
    deposit_balance BIGINT NOT NULL DEFAULT 0, -- MAY go negative: booked penalty debt (FR-PAY-03)
    wallet_status wallet_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- added (D-07)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE wallets IS 'SRS §7 table 8. Three strictly separate balances. deposit_balance is  used ONLY for SLA penalties (PENALTY_DEDUCT) — never for cash-job commission. Balances change  only through wallet_transactions, inside an ACID transaction with row locking.';

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    wallet_id UUID NOT NULL REFERENCES wallets (id),
    booking_id UUID REFERENCES bookings (id),
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    tx_type tx_type_enum NOT NULL,
    balance_type balance_type_enum NOT NULL, -- added (D-06): which of the 3 balances moved
    amount BIGINT NOT NULL CHECK (amount > 0), -- magnitude in VND; direction follows tx_type
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    status tx_status_enum NOT NULL DEFAULT 'COMPLETED', -- values defined in D-04
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions (wallet_id, created_at);

CREATE INDEX idx_wallet_tx_booking ON wallet_transactions (booking_id)
WHERE
    booking_id IS NOT NULL;

COMMENT ON TABLE wallet_transactions IS 'SRS §7 table 9 — the append-only ledger.  COMMISSION_PAYMENT (nurse self-pays the 15% cash-job commission via payment link) is strictly  distinct from PENALTY_DEDUCT (SLA penalty taken from the deposit). PARTIAL_SETTLE is Phase 2 only.';

CREATE TABLE withdrawal_requests ( -- (+) added table
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    wallet_id UUID NOT NULL REFERENCES wallets (id),
    transaction_id UUID NOT NULL REFERENCES wallet_transactions (id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    bank_name VARCHAR(100) NOT NULL,
    bank_account_no VARCHAR(30) NOT NULL,
    account_holder VARCHAR(150) NOT NULL,
    status withdrawal_status_enum NOT NULL DEFAULT 'WITHDRAW_REQUESTED',
    reviewed_by UUID REFERENCES users (id),
    reject_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawal_requests_wallet ON withdrawal_requests (wallet_id, status);

CREATE TABLE vouchers ( -- (+) added table
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    code VARCHAR(30) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id), -- the customer receiving the voucher
    source_booking_id UUID NOT NULL REFERENCES bookings (id), -- the no-show booking that funded it
    used_booking_id UUID REFERENCES bookings (id),
    amount BIGINT NOT NULL DEFAULT 50000 CHECK (amount > 0), -- NO_SHOW_PENALTY (SRS §5.2 row 8)
    status voucher_status_enum NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ, -- validity length is an open SRS item (OD register)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vouchers_user ON vouchers (user_id, status);

COMMENT ON TABLE vouchers IS 'The no-show penalty (50,000 VND taken from the nurse deposit) becomes  a customer voucher (§5.2 row 8). This table settles the voucher-entity question the SRS left open.';

-- ============================================================================
-- 7. AFTER THE SHIFT — disputes, reviews, conversations_messages,
--    notifications, record_access_grants (+)
-- ============================================================================

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    raised_by_id UUID NOT NULL REFERENCES users (id),
    reason_code VARCHAR(50),
    description TEXT,
    evidence_urls JSONB, -- private storage keys, max 5 files (FR-DISP-01)
    status dispute_status_enum NOT NULL DEFAULT 'OPEN',
    refund_amount BIGINT CHECK (refund_amount >= 0),
    release_amount BIGINT CHECK (release_amount >= 0),
    resolved_by UUID REFERENCES users (id),
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CHECK (
        evidence_urls IS NULL
        OR (
            jsonb_typeof(evidence_urls) = 'array'
            AND jsonb_array_length(evidence_urls) <= 5
        )
    )
);

CREATE INDEX idx_disputes_booking ON disputes (booking_id, status);

CREATE INDEX idx_disputes_open ON disputes (status)
WHERE
    status IN ('OPEN', 'UNDER_REVIEW');

COMMENT ON TABLE disputes IS 'SRS §7 table 11 (FR-DISP-01). Opening a dispute freezes settlement.  MVP resolutions are 100% refund or 100% release; RESOLVED_PARTIAL is Phase 2 (FR-DISP-02).';

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    reviewer_id UUID NOT NULL REFERENCES users (id),
    reviewee_id UUID NOT NULL REFERENCES users (id),
    reviewer_role reviewer_role_enum NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT FALSE, -- blind until both submit or 7 days pass
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id, reviewer_id),
    CHECK (reviewer_id <> reviewee_id)
);

CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id, is_visible);

COMMENT ON TABLE reviews IS 'SRS §7 table 12 (FR-RATE-01). Reviews open at booking COMPLETED,  not at settlement. Visibility is flipped only by the visibility job, never at read time.';

CREATE TABLE conversations_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    sender_id UUID NOT NULL REFERENCES users (id),
    receiver_id UUID NOT NULL REFERENCES users (id),
    message_type message_type_enum NOT NULL,
    content TEXT,
    call_duration_sec INT CHECK (call_duration_sec >= 0),
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE, -- (+) in ERD: phone number / external link detected
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_booking ON conversations_messages (booking_id, created_at);

COMMENT ON TABLE conversations_messages IS 'SRS §7 table 13 (FR-CHAT-01). In-app chat/calls with  masked phone numbers; rows are retained as dispute evidence and are never hard-deleted.';

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES users (id),
    booking_id UUID REFERENCES bookings (id),
    title VARCHAR(200) NOT NULL,
    body TEXT,
    channel notification_channel_enum NOT NULL,
    priority notification_priority_enum NOT NULL DEFAULT 'NORMAL', -- (+) in ERD
    delivery_status delivery_status_enum NOT NULL DEFAULT 'PENDING',
    acked_at TIMESTAMPTZ, -- (+) in ERD: drives the 60-second SMS fallback watcher
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (
    user_id,
    is_read,
    created_at DESC
);

CREATE INDEX idx_notifications_fallback ON notifications (delivery_status, created_at)
WHERE
    delivery_status = 'PENDING';

COMMENT ON TABLE notifications IS 'SRS §7 table 14 (FR-NOTIF-01). Urgent events are sent  priority = HIGH; if unacknowledged after 60 s the fallback watcher raises an SMS_FALLBACK row.';

CREATE TABLE record_access_grants ( -- (+) added table
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    granted_by UUID NOT NULL REFERENCES users (id), -- the Admin granting exceptional access
    reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_record_grants_booking ON record_access_grants (booking_id, expires_at);

COMMENT ON TABLE record_access_grants IS 'Exceptional, time-limited re-grant of medical-record  access after the normal window (CONFIRMED → check-out +12h) has closed (FR-PRIV-01).  Every grant is also written to audit_logs with action GRANT_RECORD_ACCESS.';

-- ============================================================================
-- 8. PLATFORM — system_configs, audit_logs
-- ============================================================================

CREATE TABLE system_configs (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(500) NOT NULL,
    data_type config_data_type_enum NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users (id) ON DELETE SET NULL, -- NULL only for seed rows (D-08)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_configs IS 'SRS §7 table 15 (§5.1). Every business number is read from  here at runtime — nothing is hardcoded. Seeded below with the §5.1 values.';

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    actor_id UUID REFERENCES users (id), -- NULL for automated system actions (D-08)
    action_type audit_action_enum NOT NULL,
    target_table VARCHAR(100),
    target_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_target ON audit_logs (target_table, target_id);

CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at DESC);

COMMENT ON TABLE audit_logs IS 'SRS §7 table 16. Append-only security audit: medical-record  views, GPHN approvals, dispute resolutions, config changes, data deletions, access grants.';

-- ============================================================================
-- 9. APPEND-ONLY ENFORCEMENT (Golden Rule: the ledger and the audit log
--    are never updated or deleted; corrections are compensating entries)
-- ============================================================================

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_transactions_no_update
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_wallet_transactions_no_delete
    BEFORE DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ============================================================================
-- 10. REFERENCE SEED — system_configs (SRS §5.1)
--     (Service catalog rows and holiday rows are business data, seeded
--      separately in db/seeds — see development checklist Phase 0.)
-- ============================================================================

INSERT INTO
    system_configs (
        config_key,
        config_value,
        data_type,
        description
    )
VALUES (
        'PLATFORM_COMMISSION_RATE',
        '0.15',
        'NUMBER',
        'Platform commission rate (15%)'
    ),
    (
        'MIN_NURSE_DEPOSIT',
        '300000',
        'NUMBER',
        'Upfront nurse deposit required before accepting jobs (VND)'
    ),
    (
        'SURCHARGE_NIGHT_SHIFT',
        '0.20',
        'NUMBER',
        'Night-segment surcharge, hours 22:00-06:00 (+20% of base)'
    ),
    (
        'SURCHARGE_HOLIDAY_MAJOR',
        '3.00',
        'NUMBER',
        'Tet holiday surcharge (+300% of base)'
    ),
    (
        'SURCHARGE_HOLIDAY_MINOR',
        '2.00',
        'NUMBER',
        'Other public-holiday surcharge (+200% of base)'
    ),
    (
        'SURCHARGE_HEAVY_PATIENT',
        '0.15',
        'NUMBER',
        'Heavy / bedridden patient surcharge (+15% of base)'
    ),
    (
        'PAYMENT_TIMEOUT_MINUTES',
        '15',
        'NUMBER',
        'Unpaid booking hold before EXPIRED (minutes)'
    ),
    (
        'SETTLEMENT_COOLING_HOURS',
        '24',
        'NUMBER',
        'Hours after check-out before settlement release'
    ),
    (
        'CHECKIN_MAX_RADIUS_METERS',
        '200',
        'NUMBER',
        'Maximum check-in distance from booking location (meters)'
    ),
    (
        'ICU_TRAVEL_SUPPORT',
        '50000',
        'NUMBER',
        'Travel support when a shift is cancelled for ICU/death reasons (VND)'
    ),
    (
        'NO_SHOW_PENALTY',
        '50000',
        'NUMBER',
        'Nurse no-show penalty, converted to a customer voucher (VND)'
    )
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA — 25 tables (16 SRS §7 + 9 ERD additions marked (+)),
-- 41 enum types, 1 exclusion constraint, 4 append-only triggers.
-- ============================================================================
