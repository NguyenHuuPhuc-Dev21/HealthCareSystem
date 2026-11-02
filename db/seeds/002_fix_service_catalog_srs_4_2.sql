-- =====================================================================
-- Fix script — service catalog alignment with SRS v2.0 Updated §4.2
-- For databases ALREADY seeded with the original
-- db/seeds/001_reference_and_demo.sql (commit 156862d).
--
-- Why this exists: seed 001's INSERTs all end with
-- ON CONFLICT (code) DO NOTHING, so re-running the corrected seed does
-- NOT update rows already present. Fresh databases get the corrected
-- rows from seed 001 directly and do not need this script; databases
-- seeded before the seed correction need the UPDATEs below.
-- Item 4 (SRV_WOUND_CARE tier) is intentionally NOT applied — it is
-- pending team confirmation (see the commented block below).
-- =====================================================================

-- 1. SRV_IV_INJECTION — narrow to what §4.2 Group 2 allows
--    (subcutaneous / intramuscular only; high-anaphylaxis-risk IV
--    drugs are Group 3 prohibited, see the new row below).
UPDATE service_categories
SET name = 'Tiêm dưới da / Tiêm bắp theo đơn (insulin, thuốc duy trì)'
WHERE code = 'SRV_IV_INJECTION';

INSERT INTO service_categories
  (id, code, name, service_type, is_invasive, is_prohibited,
   required_tier, base_price, unit, is_active)
VALUES
  ('50000000-0000-0000-0000-000000000022',
   'SRV_IV_HIGH_RISK',
   'Tiêm / truyền tĩnh mạch thuốc nguy cơ sốc phản vệ cao (Nghiêm cấm)',
   'TASK_BASED', TRUE, TRUE, 'TIER_2_SPECIALIST', 0, 'PER_TIME', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 2. SRV_CATHETER_INSERT — narrow to care of ALREADY-PLACED tubes
--    (§4.2 allows hygiene/replacement of an already-placed urinary
--    catheter and feeding via an already-placed gastric tube; new
--    insertion is a different procedure). The code name itself
--    ('..._INSERT') remains misleading — if the team renames the code,
--    do it in the same change, not later.
UPDATE service_categories
SET name = 'Chăm sóc sonde đã đặt sẵn (vệ sinh/thay sonde tiểu, cho ăn qua sonde dạ dày)'
WHERE code = 'SRV_CATHETER_INSERT';

-- 3. SRV_IV_INFUSION — restore the §4.2 maintenance-fluid limit
--    (saline / Ringer / Glucose) in the catalog name.
UPDATE service_categories
SET name = 'Truyền dịch duy trì tại nhà theo y lệnh (muối / Ringer / Glucose)'
WHERE code = 'SRV_IV_INFUSION';

-- 4. SRV_WOUND_CARE — PENDING TEAM CONFIRMATION, do not apply yet.
--    Seed 001 lists it as TIER_1_BASIC; §4.2 places wound care in
--    Group 2 (Tier 2). If the team intended a deliberate Tier-1
--    "basic wound care" addition outside the SRS, keep TIER_1_BASIC
--    and record it as an explicit SRS supplement instead. Otherwise:
-- UPDATE service_categories
-- SET required_tier = 'TIER_2_SPECIALIST'
-- WHERE code = 'SRV_WOUND_CARE';

-- 5. Note: Group 3 in the seed is still not the complete §4.2
--    prohibited list (contrast agents, chemotherapy, abscess
--    incision, emergency suturing, home anaesthesia, new
--    prescriptions are not seeded as rows). Booking code must not
--    treat "absent from the catalog" as "allowed".
