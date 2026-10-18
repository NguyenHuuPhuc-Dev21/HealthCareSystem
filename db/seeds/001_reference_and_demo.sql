-- =====================================================================
-- Canonical Reference Dataset: Encounter #MH-8824
-- Da Nang General Hospital Home-Care Pilot Scenario
-- Source: docs/testing/test-strategy.md Section 7
-- =====================================================================

-- Pilot Hospital Tenant
INSERT INTO hospital (id, name, legal_name, tax_code, status, created_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Da Nang General Hospital',
  'Benh Vien Da Khoa Da Nang',
  '0400123456',
  'ACTIVE',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Pilot Facility
INSERT INTO facility (id, hospital_id, name, address, latitude, longitude, service_radius_km, created_at)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Main Campus - Hai Chau',
  '124 Hai Phong, Thach Thang, Hai Chau, Da Nang',
  16.0748,
  108.2140,
  15.0,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Pilot Service Offering: Post-Surgical Wound Dressing
INSERT INTO service (id, hospital_id, code, name, base_price, requires_prescription, created_at)
VALUES (
  's0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'CARE-WOUND-01',
  'Post-Surgical Wound Dressing & Care',
  400000,
  false,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Effective Date Configuration: 30% Deposit, Min 50,000 VND
INSERT INTO hospital_config (id, hospital_id, config_key, config_value, effective_from)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'DEPOSIT_PERCENTAGE',
  '{"value": 30, "min_amount_vnd": 50000}',
  '2026-01-01 00:00:00+00'
) ON CONFLICT DO NOTHING;
