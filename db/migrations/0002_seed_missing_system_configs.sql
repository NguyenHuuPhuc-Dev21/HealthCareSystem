-- =====================================================================
-- 0002 — Seed the system_configs keys that packages/shared declares
--        (SYSTEM_CONFIG_KEYS) but 0001 did not insert.
--
-- Owner: BE-1 (Dev A) · Phase 0
-- Why: core/config fails fast when a key is missing (no hardcoded
-- fallbacks — Golden Rule "Zero Hardcoding"). 0001 seeded only the 11
-- §5.1 Table 2 keys; these 5 values come from the functional
-- requirements text of SRS v2.0 (Updated, 28/10/2026):
--   RECORD_ACCESS_EXPIRY_HOURS  12  FR-PRIV-01 / RISK-03 (close record view 12h after check-out)
--   RADAR_INITIAL_RADIUS_KM      5  FR-BOOK-03 (Radar: 5 km first)
--   RADAR_EXPANDED_RADIUS_KM    10  FR-BOOK-03 (then expand to 10 km)
--   RADAR_EXPANSION_DELAY_MIN    5  FR-BOOK-03 (expand after the first 5 minutes)
--   TRAVEL_BUFFER_MINUTES       60  FR-SCHED-01 (60-minute travel buffer)
--
-- Forward-only: never edit this file after it is merged; add 0003+.
-- ON CONFLICT DO NOTHING keeps values an Admin may already have changed.
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('RECORD_ACCESS_EXPIRY_HOURS', '12', 'NUMBER',
     'Hours after check-out until the assigned nurse loses medical-record access (FR-PRIV-01)'),
    ('RADAR_INITIAL_RADIUS_KM', '5', 'NUMBER',
     'Radar dispatch initial search radius in km (FR-BOOK-03)'),
    ('RADAR_EXPANDED_RADIUS_KM', '10', 'NUMBER',
     'Radar dispatch expanded search radius in km (FR-BOOK-03)'),
    ('RADAR_EXPANSION_DELAY_MIN', '5', 'NUMBER',
     'Minutes before Radar expands from the initial to the expanded radius (FR-BOOK-03)'),
    ('TRAVEL_BUFFER_MINUTES', '60', 'NUMBER',
     'Minimum travel buffer between two shifts of the same nurse, in minutes (FR-SCHED-01)')
ON CONFLICT (config_key) DO NOTHING;
