-- =====================================================================
-- 0028 · Maintenance embargo (BE-2 · Phase 8 · NFR-AVAIL-01 / CT-23)
--
-- SRS: "ưu tiên không bảo trì hệ thống vào khung giờ chuyển giao ca đêm 19:00 - 21:00".
-- `npm run db:migrate` (NODE_ENV=production) and `npm run ops:embargo-check` (first step of every deploy) refuse to
-- run inside this window, Vietnam time. Kept in system_configs so ops can adjust it without a release.
-- Values are 'HH:MM', same day, start < end. Runbook: docs/runbooks/maintenance-embargo.md
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('MAINTENANCE_EMBARGO_START', '19:00', 'STRING',
     'Start of the no-maintenance window (shift handover, Vietnam time) — no migration / deploy / restart (NFR-AVAIL-01)'),
    ('MAINTENANCE_EMBARGO_END', '21:00', 'STRING',
     'End of the no-maintenance window (exclusive, Vietnam time) (NFR-AVAIL-01)')
ON CONFLICT (config_key) DO NOTHING;
