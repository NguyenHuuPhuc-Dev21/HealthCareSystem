/**
 * disputes — two-way disputes on a shift, rebuttal, Admin resolution, and deposit-penalty appeals.
 * BE-3 · Phase 6 · FR-DISP-01 · FR-DISP-02 (MVP: 100% refund or 100% release) · ADR-0004 D3.
 * Contract: docs/api/disputes.api.md
 *
 *  POST  /bookings/:id/disputes              customer or nurse; IN_PROGRESS or ≤ SETTLEMENT_COOLING_HOURS after check-out.
 *                                            Under the booking lock: dispute_status = OPEN → the settlement is frozen.
 *  POST  /disputes/:id/evidence-upload-urls  presigned PUT URLs (dispute-evidence, ≤ 5 files)
 *  POST  /disputes/:id/rebuttal              the counter-party, once, before rebuttal_due_at → UNDER_REVIEW
 *  GET   /nurse/disputes · /patient/disputes · /disputes/:id · /admin/disputes
 *  PATCH /admin/disputes/:id/resolve         RESOLVED_NURSE → 85% released (settlements) / penalty appeal upheld → PENALTY_REVERSAL
 *                                            RESOLVED_CUSTOMER → 100% escrow refund, −TRUST_PENALTY_DISPUTE_UPHELD,
 *                                            optional deposit damages (DISPUTE_UPHELD, not appealable)
 * Every resolution is audited (RESOLVE_DISPUTE).
 */
import { AuditAction, PenaltyReason, type DisputeCategory, type DisputeDto, type DisputeEvidenceDto, type DisputeStatus, type PresignedUploadUrlDto, type SystemConfigKey } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { buildObjectKey, createDownloadUrl, createUploadUrl, objectKeyBelongsTo } from '../../core/storage';
import { deductPenalty, reversePenalty } from '../deposits/deposits.ledger';
import { refundEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { applyTrustScoreChange } from '../reviews-trustscore/reviews-trustscore.service';
import { settleShift } from '../settlements/settlements.service';
import { contentTypeOf, isParty, openError, rebuttalError } from './disputes.policy';
import * as repo from './disputes.repo';
import { DISPUTE_CATEGORIES, MAX_EVIDENCE_FILES, PENALTY_APPEAL, type DisputeRow, type OpenDisputeBody, type ResolveBody, type ResolveResult } from './disputes.types';

const UNIQUE_VIOLATION = '23505';
/** Operational limit of the lists (not a business number). */
export const MAX_DISPUTES_LISTED = 100;

export const disputeKeys = {
  refund: (disputeId: string) => `escrow-refund:dispute:${disputeId}`,
  damages: (disputeId: string) => `deposit-penalty:DISPUTE_UPHELD:${disputeId}`,
};

export interface DisputesDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  now?: () => number;
  configNumber?: (key: SystemConfigKey) => Promise<number>;
  /** Presigned GET for an evidence key (tests inject a fake; storage not configured → the key itself). */
  downloadUrl?: (key: string) => Promise<string>;
  /** Presigned PUT for a new evidence key. */
  uploadUrl?: (key: string, contentType: string) => Promise<string>;
}

export class DisputesService {
  constructor(private readonly deps: DisputesDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private cfg(key: SystemConfigKey): Promise<number> {
    return (this.deps.configNumber ?? getConfigNumber)(key);
  }

  private async signed(key: string): Promise<string> {
    try {
      return this.deps.downloadUrl ? await this.deps.downloadUrl(key) : (await createDownloadUrl(key)).url;
    } catch {
      return key;
    }
  }

  // ---- open -------------------------------------------------------------------

  async open(actorId: string, bookingId: string, body: OpenDisputeBody): Promise<{ dispute_id: string }> {
    const category = body.category ?? null;
    if (category !== null && !(DISPUTE_CATEGORIES as readonly string[]).includes(category)) {
      throw badRequest('VALIDATION_ERROR', 'Unknown dispute category');
    }
    checkEvidence(body.evidenceKeys, actorId);
    const nowMs = this.nowMs();
    const [windowHours, rebuttalHours] = await Promise.all([this.cfg('SETTLEMENT_COOLING_HOURS'), this.cfg('DISPUTE_REBUTTAL_HOURS')]);
    try {
      const id = await this.deps.withTx(async (db) => {
        const b = await repo.lockBooking(db, bookingId);
        if (!b) throw forbidden('FORBIDDEN', 'You do not have access to this booking'); // no existence leak
        const err = openError(b, actorId, windowHours, nowMs);
        if (err === 'NOT_A_PARTY') throw forbidden('FORBIDDEN', 'You do not have access to this booking');
        if (err) throw conflict(err, 'A dispute cannot be opened for this booking now');
        const at = new Date(nowMs);
        const disputeId = await repo.insertDispute(db, {
          bookingId,
          raisedBy: actorId,
          category,
          description: body.description.trim(),
          evidence: body.evidenceKeys,
          rebuttalDueAt: new Date(nowMs + rebuttalHours * 3_600_000),
          at,
        });
        await repo.setBookingDisputeStatus(db, bookingId, 'OPEN'); // freezes the settlement (same lock)
        return disputeId;
      });
      return { dispute_id: id };
    } catch (e) {
      if ((e as { code?: string }).code === UNIQUE_VIOLATION) throw conflict('DISPUTE_EXISTS', 'A dispute is already open for this booking');
      throw e;
    }
  }

  // ---- evidence ------------------------------------------------------------------

  async evidenceUploadUrls(actorId: string, disputeId: string, fileNames: string[]): Promise<PresignedUploadUrlDto[]> {
    const d = await repo.findDispute(this.deps.read, disputeId);
    if (!d || !isParty(d, actorId)) throw notFound('DISPUTE_NOT_FOUND', 'Dispute not found');
    if (d.status !== 'OPEN' && d.status !== 'UNDER_REVIEW') throw conflict('DISPUTE_CLOSED', 'This dispute is already resolved');
    if (fileNames.length < 1 || fileNames.length > MAX_EVIDENCE_FILES) {
      throw badRequest('VALIDATION_ERROR', `Between 1 and ${MAX_EVIDENCE_FILES} files`);
    }
    const out: PresignedUploadUrlDto[] = [];
    for (const fileName of fileNames) {
      const contentType = contentTypeOf(fileName);
      if (!contentType) throw badRequest('UNSUPPORTED_FILE_TYPE', `Only JPG, PNG, WEBP or PDF: ${fileName}`);
      const key = buildObjectKey('dispute-evidence', actorId, contentType);
      const uploadUrl = this.deps.uploadUrl ? await this.deps.uploadUrl(key, contentType) : (await createUploadUrl(key, contentType)).url;
      out.push({ fileId: key, fileName, uploadUrl, publicUrl: key });
    }
    return out;
  }

  // ---- rebuttal ------------------------------------------------------------------

  async rebut(actorId: string, disputeId: string, text: string, evidenceKeys: string[]): Promise<{ updated: boolean }> {
    checkEvidence(evidenceKeys, actorId);
    const nowMs = this.nowMs();
    await this.deps.withTx(async (db) => {
      const d = await repo.lockDispute(db, disputeId);
      if (!d || !isParty(d, actorId)) throw notFound('DISPUTE_NOT_FOUND', 'Dispute not found');
      if (d.reason_code === PENALTY_APPEAL) throw conflict('NOT_APPLICABLE', 'A penalty appeal has no rebuttal');
      const err = rebuttalError(d, actorId, nowMs);
      if (err === 'NOT_COUNTER_PARTY') throw forbidden('NOT_COUNTER_PARTY', 'Only the other side can submit a rebuttal');
      if (err) throw conflict(err, 'The rebuttal cannot be submitted');
      await repo.saveRebuttal(db, d.id, { by: actorId, text: text.trim(), evidence: evidenceKeys, at: new Date(nowMs) });
      await repo.setBookingDisputeStatus(db, d.booking_id, 'UNDER_REVIEW');
    });
    return { updated: true };
  }

  // ---- read ------------------------------------------------------------------------

  async get(actorId: string, isAdmin: boolean, disputeId: string): Promise<DisputeDto> {
    const d = await repo.findDispute(this.deps.read, disputeId);
    if (!d || (!isAdmin && !isParty(d, actorId))) throw notFound('DISPUTE_NOT_FOUND', 'Dispute not found');
    return this.toDto(d);
  }

  async listForNurse(nurseId: string): Promise<DisputeDto[]> {
    return Promise.all((await repo.listForNurse(this.deps.read, nurseId, MAX_DISPUTES_LISTED)).map((d) => this.toDto(d)));
  }

  async listForCustomer(customerId: string): Promise<DisputeDto[]> {
    return Promise.all((await repo.listForCustomer(this.deps.read, customerId, MAX_DISPUTES_LISTED)).map((d) => this.toDto(d)));
  }

  async listForAdmin(status: string | null): Promise<DisputeDto[]> {
    return Promise.all((await repo.listForAdmin(this.deps.read, status, MAX_DISPUTES_LISTED)).map((d) => this.toDto(d)));
  }

  // ---- resolve (Admin) ---------------------------------------------------------------

  async resolve(adminId: string, disputeId: string, body: ResolveBody, ip?: string): Promise<ResolveResult> {
    const note = body.notes.trim();
    if (note.length < 10) throw badRequest('VALIDATION_ERROR', 'Explain the decision (at least 10 characters)');
    const damages = body.depositDeduction ?? 0;
    if (!Number.isSafeInteger(damages) || damages < 0) throw badRequest('VALIDATION_ERROR', 'depositDeduction must be a whole VND amount ≥ 0');
    const nowMs = this.nowMs();
    const at = new Date(nowMs);

    return this.deps.withTx(async (db) => {
      const d = await repo.lockDispute(db, disputeId);
      if (!d) throw notFound('DISPUTE_NOT_FOUND', 'Dispute not found');
      if (d.status !== 'OPEN' && d.status !== 'UNDER_REVIEW') throw conflict('DISPUTE_CLOSED', 'This dispute is already resolved');
      const result: ResolveResult = { updated: true, outcome: body.resolution, refunded: 0, released: false, trustScoreDelta: 0, depositDeducted: 0, penaltyReversed: false };
      let releasedAmount: number | null = null;

      if (d.reason_code === PENALTY_APPEAL) {
        // ADR-0004 D3: an upheld appeal credits the penalty back; a rejected one changes nothing.
        if (damages > 0) throw badRequest('VALIDATION_ERROR', 'No deposit deduction on a penalty appeal');
        if (body.resolution === 'RESOLVED_NURSE' && d.appealed_transaction_id) {
          result.penaltyReversed = (await reversePenalty(db, { penaltyTransactionId: d.appealed_transaction_id, decidedBy: adminId, note })) !== null;
        }
      } else {
        const b = await repo.lockBooking(db, d.booking_id);
        if (!b) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
        await repo.setBookingDisputeStatus(db, b.id, body.resolution);
        if (body.resolution === 'RESOLVED_NURSE') {
          if (damages > 0) throw badRequest('VALIDATION_ERROR', 'No deposit deduction when the nurse is right');
          // Lift the freeze and pay the 85% now when the shift is checked out; otherwise the settlement sweep will.
          const s = await settleShift(db, b.id, 'DISPUTE_RELEASED', nowMs);
          if (s.settled) {
            result.released = true;
            releasedAmount = s.split.net;
          }
        } else {
          if (!b.nurse_id) throw conflict('NO_NURSE', 'The booking has no nurse');
          if (b.payment_method === 'BANK_TRANSFER' && b.payment_status === 'ESCROW_HELD') {
            const held = await repo.escrowHeld(db, b.id, b.customer_id);
            if (held > 0) {
              await refundEscrow(db, { customerId: b.customer_id, bookingId: b.id, amount: held, idempotencyKey: disputeKeys.refund(d.id), externalRef: null });
              await repo.markBookingRefunded(db, b.id);
              result.refunded = held;
            }
          }
          const [penalty, suspendBelow] = await Promise.all([this.cfg('TRUST_PENALTY_DISPUTE_UPHELD'), this.cfg('TRUST_SUSPEND_BELOW')]);
          const t = await applyTrustScoreChange(
            db,
            { nurseId: b.nurse_id, delta: -penalty, reason: 'DISPUTE_UPHELD', bookingId: b.id, note, actorId: adminId },
            suspendBelow,
          );
          result.trustScoreDelta = t.applied ? t.scoreAfter - t.scoreBefore : 0;
          if (damages > 0) {
            await deductPenalty(
              db,
              {
                nurseId: b.nurse_id,
                bookingId: b.id,
                reason: PenaltyReason.DISPUTE_UPHELD,
                amount: damages,
                slaRuleRef: 'FR-DISP-01',
                disputeId: d.id,
                note,
                decidedBy: adminId,
                idempotencyKey: disputeKeys.damages(d.id),
              },
              nowMs,
            );
            result.depositDeducted = damages;
          }
        }
      }

      await repo.saveResolution(db, d.id, {
        outcome: body.resolution,
        by: adminId,
        note,
        refund: result.refunded || null,
        release: releasedAmount,
        trustDelta: result.trustScoreDelta || null,
        deposit: result.depositDeducted || null,
        at,
      });
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.RESOLVE_DISPUTE,
        targetTable: 'disputes',
        targetId: d.id,
        oldValue: { status: d.status },
        newValue: { status: body.resolution, ...result, note },
        ipAddress: ip,
      });
      return result;
    });
  }

  // ---- DTO ---------------------------------------------------------------------------

  private async evidence(keys: string[] | null, uploadedBy: 'PATIENT' | 'NURSE'): Promise<DisputeEvidenceDto[]> {
    return Promise.all(
      (keys ?? []).map(async (key) => ({ id: key, url: await this.signed(key), kind: 'IMAGE' as const, uploadedBy, fileName: key.split('/').pop() })),
    );
  }

  private async toDto(d: DisputeRow): Promise<DisputeDto> {
    const appeal = d.reason_code === PENALTY_APPEAL;
    const openedBy = d.raised_by_role === 'NURSE' ? 'NURSE' : 'PATIENT';
    const resolved = d.status !== 'OPEN' && d.status !== 'UNDER_REVIEW';
    const rebuttalBy = d.rebuttal_by_role === 'NURSE' ? 'NURSE' : 'PATIENT';
    return {
      id: d.id,
      bookingId: d.booking_id,
      bookingCode: d.booking_code,
      openedBy,
      category: (appeal ? 'UNPROFESSIONAL_CONDUCT' : (d.reason_code ?? 'UNPROFESSIONAL_CONDUCT')) as DisputeCategory,
      description: d.description ?? '',
      status: d.status as DisputeStatus,
      evidences: await this.evidence(d.evidence_urls, openedBy),
      nurseRebuttal: d.rebuttal_at
        ? { content: d.rebuttal_text ?? '', submittedAt: new Date(d.rebuttal_at).toISOString(), evidences: await this.evidence(d.rebuttal_evidence_urls, rebuttalBy) }
        : null,
      rebuttalDueAt: !appeal && d.rebuttal_due_at ? new Date(d.rebuttal_due_at).toISOString() : undefined,
      resolution: resolved
        ? {
            outcome: d.status as DisputeStatus,
            note: d.resolution_note ?? '',
            trustScoreDelta: d.trust_score_delta ?? undefined,
            depositDeducted: d.deposit_deducted === null ? undefined : Number(d.deposit_deducted),
            resolvedAt: d.resolved_at ? new Date(d.resolved_at).toISOString() : '',
            refundedToPatient: Number(d.refund_amount ?? 0) > 0,
            releasedToNurse: d.status === 'RESOLVED_NURSE',
          }
        : null,
      kind: appeal ? 'PENALTY_APPEAL' : 'BOOKING',
      appealedTransactionId: d.appealed_transaction_id ?? undefined,
      penaltyAmount: d.penalty_amount === null ? undefined : Number(d.penalty_amount),
      penaltyReason: d.penalty_reason ?? undefined,
      slaRule: d.sla_rule_ref ?? undefined,
      createdAt: new Date(d.created_at).toISOString(),
      updatedAt: new Date(d.updated_at).toISOString(),
    };
  }
}

/** Evidence keys must be dispute-evidence objects this user uploaded (presigned via evidence-upload-urls). */
function checkEvidence(keys: string[], userId: string): void {
  if (keys.length > MAX_EVIDENCE_FILES) throw badRequest('VALIDATION_ERROR', `At most ${MAX_EVIDENCE_FILES} evidence files`);
  for (const k of keys) {
    if (!k.startsWith('dispute-evidence/') || !objectKeyBelongsTo(k, userId)) {
      throw new AppError(400, 'INVALID_EVIDENCE', 'Evidence must be uploaded through evidence-upload-urls');
    }
  }
}

let singleton: DisputesService | null = null;

export function getDisputesService(): DisputesService {
  if (!singleton) singleton = new DisputesService({ read: { query }, withTx: (fn) => withTransaction((c) => fn(c)) });
  return singleton;
}
