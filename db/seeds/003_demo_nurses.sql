-- =====================================================================
-- 003 — Demo nurse profiles for search / matching test suites
--       (Phase 2, BE-1 / Dev A — development checklist "Phase 2 · BE-1")
-- FR-SEARCH-01 · FR-SCHED-01 · FR-AUTH-02 · BR-21 §2.5
--
-- 15 synthetic nurses that together cover every rule nurse-search (BE-3) and
-- availability-engine (BE-2) must respect. Nobody here is a real person.
--
--   #  Phone       Status                Tier  What the row is for
--   01 0911000001  ACTIVE                T2    baseline Tier 2, Quận 1
--   02 0911000002  ACTIVE                T2    retired badge + valid GPHN, Quận 7
--   03 0911000003  ACTIVE                T2    has a TIME_OFF_EXCEPTION (seed date + 3 days)
--   04 0911000004  ACTIVE                T2    GPHN expires in 20 days (still Tier 2 today)
--   05 0911000005  ACTIVE                T2    Hà Nội — out of radius for HCMC searches
--   06 0911000006  ACTIVE                T1    baseline Tier 1, no GPHN
--   07 0911000007  ACTIVE                T1    retired badge WITHOUT GPHN → never Tier 2
--   08 0911000008  ACTIVE                T1    GPHN expired → already demoted to Tier 1
--   09 0911000009  ACTIVE                T1    newcomer Tier 1 (2 years), same area as 01
--   10 0911000010  ACTIVE                T1    Tier 1 with a middling TrustScore / rating
--   11 0911000011  ACTIVE                T2    low TrustScore / rating, offline, no schedule
--   12 0911000012  PENDING_VERIFICATION  —     first submission waiting in the Admin queue
--   13 0911000013  PENDING_VERIFICATION  —     first submission incl. GPHN, waiting
--   14 0911000014  SUSPENDED             T2    must never appear in search or matching
--   15 0911000015  BANNED                T1    must never appear; login is blocked
--
-- Eligible in HCMC BEFORE the availability filter (ACTIVE + qualifying tier):
--   non-invasive service: 01 02 03 04 06 07 08 09 10 11      invasive service: 01 02 03 04 11
-- Nurse 11 has no schedule, so the availability engine then removes it for any time slot.
--
-- Notes
--  * Tier and nurse_profiles.gphn_* hold APPROVED data only (see migration 0005), so the
--    rows are consistent with what credential-review would have written.
--  * No nurse deposit: the team dropped the 300,000 VND deposit requirement, so every
--    wallets.deposit_balance here stays at its default 0 and no row depends on it.
--  * rating_avg is set directly: there are no bookings/reviews behind it yet.
--  * file_url values are well-formed private object keys, but no file exists in storage.
--  * Dates written with CURRENT_DATE are fixed on the day the seed is first applied
--    (a seed file runs once). Recreate the database to refresh them.
--  * Seeds are skipped with `npm run db:migrate -- --no-seeds` (production).
-- =====================================================================

-- 1. Accounts ---------------------------------------------------------
INSERT INTO users (id, phone, full_name, gender, role, kyc_status, cccd_number, status)
VALUES
  ('61000000-0000-0000-0000-000000000001', '0911000001', 'Lê Thị Hồng Nhung',    'FEMALE', 'NURSE', 'VERIFIED', '079190000001', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000002', '0911000002', 'Phạm Văn Đức',         'MALE',   'NURSE', 'VERIFIED', '079165000002', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000003', '0911000003', 'Võ Thị Thanh Tâm',     'FEMALE', 'NURSE', 'VERIFIED', '079192000003', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000004', '0911000004', 'Đặng Thị Kim Oanh',    'FEMALE', 'NURSE', 'VERIFIED', '079188000004', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000005', '0911000005', 'Hoàng Minh Quân',      'MALE',   'NURSE', 'VERIFIED', '001189000005', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000006', '0911000006', 'Nguyễn Thị Bích Ngọc', 'FEMALE', 'NURSE', 'VERIFIED', '079198000006', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000007', '0911000007', 'Trần Văn Lợi',         'MALE',   'NURSE', 'VERIFIED', '079163000007', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000008', '0911000008', 'Bùi Thị Mỹ Hạnh',      'FEMALE', 'NURSE', 'VERIFIED', '079185000008', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000009', '0911000009', 'Huỳnh Thị Diễm My',    'FEMALE', 'NURSE', 'VERIFIED', '079199000009', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000010', '0911000010', 'Đỗ Quốc Bảo',          'MALE',   'NURSE', 'VERIFIED', '079194000010', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000011', '0911000011', 'Lý Thị Thu Trang',     'FEMALE', 'NURSE', 'VERIFIED', '079191000011', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000012', '0911000012', 'Phan Thị Ngọc Ánh',    'FEMALE', 'NURSE', 'PENDING',  '079200000012', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000013', '0911000013', 'Trương Công Thành',    'MALE',   'NURSE', 'PENDING',  '079193000013', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000014', '0911000014', 'Mai Thị Xuân Lan',     'FEMALE', 'NURSE', 'VERIFIED', '079187000014', 'ACTIVE'),
  ('61000000-0000-0000-0000-000000000015', '0911000015', 'Dương Văn Hậu',        'MALE',   'NURSE', 'VERIFIED', '079186000015', 'BANNED')
ON CONFLICT DO NOTHING;

-- 2. Profiles ---------------------------------------------------------
-- Coordinates: district centres in TP.HCM (01–04, 06–15) and Hà Nội (05).
INSERT INTO nurse_profiles (
  user_id, tier, gphn_number, gphn_expiry_date, scope_of_practice, years_of_exp,
  is_retired_medical_staff, current_lat, current_lng, is_online,
  trust_score, rating_avg, profile_status, suspended_reason
)
VALUES
  ('61000000-0000-0000-0000-000000000001', 'TIER_2_SPECIALIST', '004101/HCM-GPHN', DATE '2029-03-31',  'Điều dưỡng đa khoa',        12, FALSE, 10.7769000, 106.7009000, TRUE,  100, 4.80, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000002', 'TIER_2_SPECIALIST', '000872/HCM-GPHN', DATE '2028-09-30',  'Hồi sức & Điều dưỡng nội',  32, TRUE,  10.7340000, 106.7220000, TRUE,  100, 4.90, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000003', 'TIER_2_SPECIALIST', '005233/HCM-GPHN', DATE '2030-01-15',  'Điều dưỡng ngoại khoa',      8, FALSE, 10.8494000, 106.7537000, TRUE,   95, 4.20, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000004', 'TIER_2_SPECIALIST', '003390/HCM-GPHN', CURRENT_DATE + 20,  'Điều dưỡng đa khoa',        15, FALSE, 10.8106000, 106.7091000, TRUE,   98, 4.60, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000005', 'TIER_2_SPECIALIST', '011045/HN-GPHN',  DATE '2029-06-30',  'Điều dưỡng đa khoa',        10, FALSE, 21.0362000, 105.7906000, TRUE,  100, 4.70, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000006', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                         3, FALSE, 10.7840000, 106.6880000, TRUE,  100, 4.50, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000007', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                        35, TRUE,  10.8387000, 106.6653000, TRUE,  100, 4.70, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000008', 'TIER_1_BASIC',      '002764/HCM-GPHN', DATE '2026-06-30',  'Điều dưỡng đa khoa',        18, FALSE, 10.8015000, 106.6526000, TRUE,   90, 4.30, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000009', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                         2, FALSE, 10.7756000, 106.7019000, TRUE,  100, 4.00, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000010', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                         5, FALSE, 10.7295000, 106.7189000, TRUE,   70, 3.60, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000011', 'TIER_2_SPECIALIST', '006618/HCM-GPHN', DATE '2028-12-31',  'Điều dưỡng đa khoa',         6, FALSE, 10.8031000, 106.7144000, FALSE,  55, 3.10, 'ACTIVE', NULL),
  ('61000000-0000-0000-0000-000000000012', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                         1, FALSE, NULL,       NULL,        FALSE, 100, 0,    'PENDING_VERIFICATION', NULL),
  ('61000000-0000-0000-0000-000000000013', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                         9, FALSE, NULL,       NULL,        FALSE, 100, 0,    'PENDING_VERIFICATION', NULL),
  ('61000000-0000-0000-0000-000000000014', 'TIER_2_SPECIALIST', '004977/HCM-GPHN', DATE '2029-02-28',  'Điều dưỡng đa khoa',        11, FALSE, 10.7626000, 106.6820000, FALSE,  40, 3.40, 'SUSPENDED', 'Demo: TrustScore dưới ngưỡng, chờ Admin xem xét'),
  ('61000000-0000-0000-0000-000000000015', 'TIER_1_BASIC',      NULL,              NULL,               NULL,                         4, FALSE, 10.7553000, 106.6657000, FALSE,   0, 2.00, 'BANNED',    'Demo: vi phạm nghiêm trọng')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Wallets (earnings only; deposit_balance is left at 0 — see Notes) ------
INSERT INTO wallets (user_id, available_balance)
VALUES
  ('61000000-0000-0000-0000-000000000001', 1200000),
  ('61000000-0000-0000-0000-000000000002', 3500000),
  ('61000000-0000-0000-0000-000000000003',  800000),
  ('61000000-0000-0000-0000-000000000004',  450000),
  ('61000000-0000-0000-0000-000000000005',  900000),
  ('61000000-0000-0000-0000-000000000006',  250000),
  ('61000000-0000-0000-0000-000000000007', 1800000),
  ('61000000-0000-0000-0000-000000000008',  600000),
  ('61000000-0000-0000-0000-000000000009',       0),
  ('61000000-0000-0000-0000-000000000010',  150000),
  ('61000000-0000-0000-0000-000000000011',  300000),
  ('61000000-0000-0000-0000-000000000012',       0),
  ('61000000-0000-0000-0000-000000000013',       0),
  ('61000000-0000-0000-0000-000000000014',  700000),
  ('61000000-0000-0000-0000-000000000015',       0)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Credentials ------------------------------------------------------
-- 4a. Degrees (every nurse). PENDING for 12 and 13, APPROVED for the others.
INSERT INTO nurse_credentials (id, nurse_id, doc_type, file_url, issued_date, verification_status, reviewed_by, reviewed_at)
SELECT ('62000000-0000-0000-0001-0000000000' || n)::uuid,
       ('61000000-0000-0000-0000-0000000000' || n)::uuid,
       'DEGREE',
       'nurse-degree/61000000-0000-0000-0000-0000000000' || n || '/62000000-0000-0000-0001-0000000000' || n || '.pdf',
       DATE '2010-07-15',
       CASE WHEN n IN ('12', '13') THEN 'PENDING' ELSE 'APPROVED' END::verification_status_enum,
       CASE WHEN n IN ('12', '13') THEN NULL ELSE '60000000-0000-0000-0000-000000000001'::uuid END,
       CASE WHEN n IN ('12', '13') THEN NULL ELSE now() END
  FROM unnest(ARRAY['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']) AS n
 WHERE EXISTS (SELECT 1 FROM users WHERE id = '60000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 4b. GPHN (practising licence). Approved rows mirror nurse_profiles.gphn_*.
INSERT INTO nurse_credentials (
  id, nurse_id, doc_type, file_url, document_number, issuing_authority, scope_of_practice,
  issued_date, expiry_date, verification_status, reviewed_by, reviewed_at
)
SELECT ('62000000-0000-0000-0002-0000000000' || g.n)::uuid,
       ('61000000-0000-0000-0000-0000000000' || g.n)::uuid,
       'GPHN',
       'nurse-gphn/61000000-0000-0000-0000-0000000000' || g.n || '/62000000-0000-0000-0002-0000000000' || g.n || '.pdf',
       g.doc_no, g.authority, g.scope, g.issued, g.expiry,
       g.status::verification_status_enum,
       CASE WHEN g.status = 'APPROVED' THEN '60000000-0000-0000-0000-000000000001'::uuid END,
       CASE WHEN g.status = 'APPROVED' THEN now() END
  FROM (VALUES
         ('01', '004101/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng đa khoa',       DATE '2024-04-01', DATE '2029-03-31',  'APPROVED'),
         ('02', '000872/HCM-GPHN', 'Sở Y tế TP.HCM', 'Hồi sức & Điều dưỡng nội', DATE '2023-10-01', DATE '2028-09-30',  'APPROVED'),
         ('03', '005233/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng ngoại khoa',    DATE '2025-01-16', DATE '2030-01-15',  'APPROVED'),
         ('04', '003390/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng đa khoa',       DATE '2021-12-01', CURRENT_DATE + 20,  'APPROVED'),
         ('05', '011045/HN-GPHN',  'Sở Y tế Hà Nội', 'Điều dưỡng đa khoa',       DATE '2024-07-01', DATE '2029-06-30',  'APPROVED'),
         ('08', '002764/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng đa khoa',       DATE '2021-07-01', DATE '2026-06-30',  'APPROVED'),
         ('11', '006618/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng đa khoa',       DATE '2024-01-01', DATE '2028-12-31',  'APPROVED'),
         ('13', '007702/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng đa khoa',       DATE '2025-05-01', DATE '2030-04-30',  'PENDING'),
         ('14', '004977/HCM-GPHN', 'Sở Y tế TP.HCM', 'Điều dưỡng đa khoa',       DATE '2024-03-01', DATE '2029-02-28',  'APPROVED')
       ) AS g (n, doc_no, authority, scope, issued, expiry, status)
 WHERE EXISTS (SELECT 1 FROM users WHERE id = '60000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 4c. Retirement decisions (honour badge only — never a reason for Tier 2).
INSERT INTO nurse_credentials (id, nurse_id, doc_type, file_url, issued_date, verification_status, reviewed_by, reviewed_at)
SELECT ('62000000-0000-0000-0003-0000000000' || n)::uuid,
       ('61000000-0000-0000-0000-0000000000' || n)::uuid,
       'RETIREMENT_DECISION',
       'nurse-retirement/61000000-0000-0000-0000-0000000000' || n || '/62000000-0000-0000-0003-0000000000' || n || '.pdf',
       DATE '2022-01-01', 'APPROVED', '60000000-0000-0000-0000-000000000001', now()
  FROM unnest(ARRAY['02', '07']) AS n
 WHERE EXISTS (SELECT 1 FROM users WHERE id = '60000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 4d. CCCD front/back for the two nurses still waiting in the Admin queue.
INSERT INTO nurse_credentials (id, nurse_id, doc_type, document_side, file_url, verification_status)
SELECT ('62000000-0000-0000-000' || s.k || '-0000000000' || n)::uuid,
       ('61000000-0000-0000-0000-0000000000' || n)::uuid,
       'CCCD', s.side,
       'kyc-cccd/61000000-0000-0000-0000-0000000000' || n || '/62000000-0000-0000-000' || s.k || '-0000000000' || n || '.jpg',
       'PENDING'
  FROM unnest(ARRAY['12', '13']) AS n
 CROSS JOIN (VALUES ('4', 'FRONT'), ('5', 'BACK')) AS s (k, side)
ON CONFLICT (id) DO NOTHING;

-- 5. Availability (FR-SCHED-01; day_of_week 0 = Sunday … 6 = Saturday) ------
-- Weekday daytime: 01, 03, 04, 05, 06, 08, 09, 10.  Evenings: 02.  Weekend: 07.
-- Nurse 11 is ACTIVE with no schedule at all → never available.
INSERT INTO nurse_availabilities (id, nurse_id, day_of_week, start_time, end_time, availability_type)
SELECT ('63000000-0000-0000-000' || w.dow || '-0000000000' || w.n)::uuid,
       ('61000000-0000-0000-0000-0000000000' || w.n)::uuid,
       w.dow, w.start_time, w.end_time, 'RECURRING_AVAILABLE'
  FROM (
        SELECT n, dow, TIME '08:00' AS start_time, TIME '17:00' AS end_time
          FROM unnest(ARRAY['01','03','04','05','06','08','09','10']) AS n CROSS JOIN generate_series(1, 5) AS dow
        UNION ALL
        SELECT '02', dow, TIME '17:00', TIME '21:00' FROM generate_series(1, 5) AS dow
        UNION ALL
        SELECT '07', dow, TIME '07:00', TIME '19:00' FROM unnest(ARRAY[0, 6]) AS dow
       ) AS w
ON CONFLICT (id) DO NOTHING;

-- Nurse 03 takes a full day off three days after the seed is applied.
INSERT INTO nurse_availabilities (id, nurse_id, specific_date, start_time, end_time, availability_type)
VALUES ('63000000-0000-0000-0009-000000000003', '61000000-0000-0000-0000-000000000003',
        CURRENT_DATE + 3, TIME '00:00', TIME '23:59', 'TIME_OFF_EXCEPTION')
ON CONFLICT (id) DO NOTHING;
