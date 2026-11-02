-- =====================================================================
-- HealthCareSystem — On-Demand Nursing Marketplace Reference Seed
-- Baseline: SRS Version 2.0 (Updated 28/10/2026) §4.2, §5.1, §7
-- =====================================================================

-- 1. Service Catalog (§4.2)
-- Group 1: Non-invasive (Tier 1 & Tier 2 eligible)
INSERT INTO service_categories (id, code, name, service_type, is_invasive, is_prohibited, required_tier, base_price, unit, is_active)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'SRV_WOUND_CARE', 'Thay băng & Chăm sóc vết thương cơ bản', 'TASK_BASED', FALSE, FALSE, 'TIER_1_BASIC', 200000, 'PER_TIME', TRUE),
  ('50000000-0000-0000-0000-000000000002', 'SRV_ELDER_BATHING', 'Tắm gội & Vệ sinh toàn thân người cao tuổi', 'TASK_BASED', FALSE, FALSE, 'TIER_1_BASIC', 250000, 'PER_TIME', TRUE),
  ('50000000-0000-0000-0000-000000000003', 'SRV_SHIFT_4H', 'Ca chăm sóc phục hồi 4 giờ ban ngày', 'SHIFT_BASED', FALSE, FALSE, 'TIER_1_BASIC', 400000, 'PER_SHIFT', TRUE),
  ('50000000-0000-0000-0000-000000000004', 'SRV_SHIFT_8H', 'Ca chăm sóc toàn diện 8 giờ', 'SHIFT_BASED', FALSE, FALSE, 'TIER_1_BASIC', 750000, 'PER_SHIFT', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Group 2: Invasive with medical order (Tier 2 Specialist with valid GPHN only)
INSERT INTO service_categories (id, code, name, service_type, is_invasive, is_prohibited, required_tier, base_price, unit, is_active)
VALUES
  ('50000000-0000-0000-0000-000000000010', 'SRV_IV_INFUSION', 'Truyền dịch duy trì tại nhà theo y lệnh (muối / Ringer / Glucose)', 'TASK_BASED', TRUE, FALSE, 'TIER_2_SPECIALIST', 350000, 'PER_TIME', TRUE),
  ('50000000-0000-0000-0000-000000000011', 'SRV_CATHETER_INSERT', 'Chăm sóc sonde đã đặt sẵn (vệ sinh/thay sonde tiểu, cho ăn qua sonde dạ dày)', 'TASK_BASED', TRUE, FALSE, 'TIER_2_SPECIALIST', 300000, 'PER_TIME', TRUE),
  ('50000000-0000-0000-0000-000000000012', 'SRV_IV_INJECTION', 'Tiêm dưới da / Tiêm bắp theo đơn (insulin, thuốc duy trì)', 'TASK_BASED', TRUE, FALSE, 'TIER_2_SPECIALIST', 180000, 'PER_TIME', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Group 3: Prohibited services (Never bookable, hard-blocked at API)
INSERT INTO service_categories (id, code, name, service_type, is_invasive, is_prohibited, required_tier, base_price, unit, is_active)
VALUES
  ('50000000-0000-0000-0000-000000000020', 'SRV_BLOOD_TRANSFUSION', 'Truyền máu tại nhà (Nghiêm cấm)', 'TASK_BASED', TRUE, TRUE, 'TIER_2_SPECIALIST', 0, 'PER_TIME', FALSE),
  ('50000000-0000-0000-0000-000000000021', 'SRV_MINOR_SURGERY', 'Tiểu phẫu / Phẫu thuật tại nhà (Nghiêm cấm)', 'TASK_BASED', TRUE, TRUE, 'TIER_2_SPECIALIST', 0, 'PER_TIME', FALSE),
  ('50000000-0000-0000-0000-000000000022', 'SRV_IV_HIGH_RISK', 'Tiêm / truyền tĩnh mạch thuốc nguy cơ sốc phản vệ cao (Nghiêm cấm)', 'TASK_BASED', TRUE, TRUE, 'TIER_2_SPECIALIST', 0, 'PER_TIME', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 2. Public Holidays (Sample Tet & Major Holiday Seed)
INSERT INTO public_holidays (holiday_date, name, holiday_type, surcharge_rate)
VALUES
  ('2026-02-16', 'Tết Nguyên Đán Bính Ngọ (Mùng 1)', 'TET', 3.00),
  ('2026-02-17', 'Tết Nguyên Đán Bính Ngọ (Mùng 2)', 'TET', 3.00),
  ('2026-02-18', 'Tết Nguyên Đán Bính Ngọ (Mùng 3)', 'TET', 3.00),
  ('2026-04-30', 'Ngày Giải phóng miền Nam', 'PUBLIC_HOLIDAY', 2.00),
  ('2026-05-01', 'Ngày Quốc tế Lao động', 'PUBLIC_HOLIDAY', 2.00),
  ('2026-09-02', 'Ngày Quốc khánh', 'PUBLIC_HOLIDAY', 2.00)
ON CONFLICT (holiday_date) DO NOTHING;

-- 3. Synthetic Seed Accounts
-- Admin
INSERT INTO users (id, phone, email, full_name, role, kyc_status, status)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  '0901000001',
  'admin@healthcare.local',
  'Hệ thống Quản trị Y tế',
  'ADMIN',
  'VERIFIED',
  'ACTIVE'
) ON CONFLICT (phone) DO NOTHING;

-- Nurse Tier 2 (Retired Doctor / Nurse with active GPHN)
INSERT INTO users (id, phone, email, full_name, role, kyc_status, status)
VALUES (
  '60000000-0000-0000-0000-000000000002',
  '0902000002',
  'nurse.retired@healthcare.local',
  'BS. Nguyễn Văn An (Nghỉ hưu)',
  'NURSE',
  'VERIFIED',
  'ACTIVE'
) ON CONFLICT (phone) DO NOTHING;

INSERT INTO nurse_profiles (
  user_id, tier, gphn_number, gphn_expiry_date, scope_of_practice, years_of_exp,
  is_retired_medical_staff, trust_score, rating_avg, profile_status
) VALUES (
  '60000000-0000-0000-0000-000000000002',
  'TIER_2_SPECIALIST',
  '012345/BYT-CCHN',
  '2028-12-31',
  'Nội khoa & Điều dưỡng đa khoa',
  30,
  TRUE,
  100,
  5.0,
  'ACTIVE'
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO wallets (user_id, available_balance, escrow_locked_balance, deposit_balance, wallet_status)
VALUES (
  '60000000-0000-0000-0000-000000000002',
  1500000,
  0,
  300000,
  'ACTIVE'
) ON CONFLICT (user_id) DO NOTHING;

-- Customer (Patient Family)
INSERT INTO users (id, phone, email, full_name, role, kyc_status, status)
VALUES (
  '60000000-0000-0000-0000-000000000003',
  '0903000003',
  'customer@healthcare.local',
  'Trần Thị Mai (Người nhà bệnh nhân)',
  'PATIENT',
  'VERIFIED',
  'ACTIVE'
) ON CONFLICT (phone) DO NOTHING;

INSERT INTO wallets (user_id, available_balance, escrow_locked_balance, deposit_balance, wallet_status)
VALUES (
  '60000000-0000-0000-0000-000000000003',
  5000000,
  0,
  0,
  'ACTIVE'
) ON CONFLICT (user_id) DO NOTHING;
