-- =====================================================================
-- 0009 — Review tags support for two-way ratings (FR-RATE-01)
--
-- Enables nurses and customers to tag feedback points (e.g. 'Hợp tác tốt',
-- 'Thông tin đúng', 'Môi trường sạch sẽ') alongside rating and comment.
-- =====================================================================

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN reviews.tags IS
    'Quick feedback tags selected by the reviewer (e.g., cooperation, punctuality, hygiene). FR-RATE-01.';
