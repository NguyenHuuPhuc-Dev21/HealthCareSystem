/**
 * Data access for privacy-consent (SQL-first, ADR-0002). Parameterised SQL only.
 * Every function takes the caller's Queryable (pool or transaction client).
 */
import type { Queryable } from "../../core/database";
import type { ConsentStateRow } from "./privacy-consent.types";

export async function findConsentState(
  db: Queryable,
  patientProfileId: string,
): Promise<ConsentStateRow | null> {
  const { rows } = await db.query<ConsentStateRow>(
    "SELECT id, data_consent_accepted, deleted_at FROM patient_profiles WHERE id = $1",
    [patientProfileId],
  );
  return rows[0] ?? null;
}
