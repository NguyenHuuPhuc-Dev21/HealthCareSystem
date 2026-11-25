-- =====================================================================
-- 0025 — Deposit shortfall suspension (BE-2 · Phase 5 · deposits)
-- SRS v2.0 §3 (nurse profile lifecycle) · FR-PAY-03 · BR-04 §2.2 · ADR-0004 D2
--
-- SRS lifecycle: "ACTIVE → SUSPENDED: … đang thiếu hụt tiền ký quỹ (deposit_balance < 300.000 VNĐ do bị trừ tiền
-- phạt)" and "SUSPENDED → ACTIVE: khi điều dưỡng nạp bù đủ ký quỹ". FR-PAY-03: a penalty that takes the deposit
-- below MIN_NURSE_DEPOSIT blocks new jobs until topped up; a penalty larger than the balance is booked as debt.
--
-- Done as a trigger on wallets.deposit_balance so EVERY writer is covered in its own transaction (deposits'
-- deductPenalty / confirmTopup / reversePenalty, settlements' DEPOSIT_WITHHOLD, disputes, cancellation-policy…),
-- with nothing to remember in each module:
--
--   SUSPEND  (deposit decreased, i.e. a penalty) the new balance is below MIN_NURSE_DEPOSIT and the nurse is not
--            covered by the ADR-0004 grace period — grace covers a short deposit only while it is still ≥ 0 (a debt
--            is never covered: BR-04 unchanged) and the grace window / shift quota is not used up.
--            Only an ACTIVE profile is suspended (reason DEPOSIT_SHORTFALL); another suspension reason is kept.
--            A nurse who asked to close her account (closure_requested_at) is not suspended: she takes no new jobs
--            anyway, and the closing refund (DEPOSIT_REFUND) empties the deposit by design.
--   REACTIVATE (deposit increased: top-up, penalty reversal, withholding) the balance is back at
--            MIN_NURSE_DEPOSIT or more → a profile SUSPENDED for DEPOSIT_SHORTFALL becomes ACTIVE again.
--            Other suspension reasons (COMMISSION_OVERDUE, TRUST_SCORE_BELOW_THRESHOLD) are left to their owners.
--
-- The eligibility gate (matching-radar depositAllows, used by Radar, Job Board, direct requests and nurse search)
-- still checks the balance itself; this status is what the SRS state machine, the apps and Admin see.
-- Forward-only: never edit this file after it is merged; add 0026+.
-- =====================================================================

CREATE OR REPLACE FUNCTION wallets_sync_deposit_suspension() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    min_deposit NUMERIC;
    grace_max NUMERIC;
    in_grace BOOLEAN;
BEGIN
    IF NEW.deposit_balance = OLD.deposit_balance THEN
        RETURN NEW;
    END IF;
    SELECT config_value::numeric INTO min_deposit FROM system_configs WHERE config_key = 'MIN_NURSE_DEPOSIT';
    IF min_deposit IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.deposit_balance < OLD.deposit_balance THEN
        IF NEW.deposit_balance < min_deposit AND NEW.closure_requested_at IS NULL THEN
            SELECT config_value::numeric INTO grace_max FROM system_configs WHERE config_key = 'DEPOSIT_GRACE_MAX_SHIFTS';
            in_grace := NEW.deposit_balance >= 0
                        AND NEW.deposit_grace_expires_at IS NOT NULL AND NEW.deposit_grace_expires_at > now()
                        AND COALESCE(NEW.deposit_grace_shifts_used, 0) < COALESCE(grace_max, 0);
            IF NOT in_grace THEN
                UPDATE nurse_profiles
                   SET profile_status = 'SUSPENDED', suspended_reason = 'DEPOSIT_SHORTFALL', updated_at = now()
                 WHERE user_id = NEW.user_id AND profile_status = 'ACTIVE';
            END IF;
        END IF;
    ELSIF NEW.deposit_balance >= min_deposit THEN
        UPDATE nurse_profiles
           SET profile_status = 'ACTIVE', suspended_reason = NULL, updated_at = now()
         WHERE user_id = NEW.user_id AND profile_status = 'SUSPENDED' AND suspended_reason = 'DEPOSIT_SHORTFALL';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallets_deposit_suspension ON wallets;
CREATE TRIGGER trg_wallets_deposit_suspension
    AFTER UPDATE OF deposit_balance ON wallets
    FOR EACH ROW EXECUTE FUNCTION wallets_sync_deposit_suspension();

COMMENT ON FUNCTION wallets_sync_deposit_suspension() IS
    'SRS v2.0 nurse lifecycle: a penalty that leaves deposit_balance < MIN_NURSE_DEPOSIT (outside the ADR-0004 grace, '
    'or any debt) suspends the profile (DEPOSIT_SHORTFALL); topping back up to MIN_NURSE_DEPOSIT reactivates it.';
