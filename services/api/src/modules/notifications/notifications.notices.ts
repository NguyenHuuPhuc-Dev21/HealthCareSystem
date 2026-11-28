/**
 * notifications — the messages BE-3's money and dispute flows send (BE-3 · Phase 6 · FR-NOTIF-01, ADR-0004).
 * Pure builders: the calling module decides when (always after its transaction committed) and to whom.
 *
 * Nurse types come from NurseNotificationType (nurse-web routes on them). Customer types are listed in the
 * README until patient-web (FE-1) defines its own union.
 * Bodies carry amounts and booking codes only — never clinical detail (Tier 4 data stays out of push).
 */
import { NotificationPriority, type NurseNotificationType } from '@healthcare-system/shared';
import type { Notice } from './notifications.types';

/** Customer-side types (patient-web). */
export type CustomerNotificationType = 'DISPUTE_OPENED' | 'DISPUTE_UPDATED' | 'DISPUTE_RESOLVED' | 'BOOKING_EXPIRED';

export function vnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

function nurse(n: Omit<Notice, 'type'> & { type: NurseNotificationType }): Notice {
  return n;
}

function customer(n: Omit<Notice, 'type'> & { type: CustomerNotificationType }): Notice {
  return n;
}

interface DisputeRef {
  disputeId: string;
  bookingId: string;
  bookingCode: string;
}

const disputeData = (d: DisputeRef) => ({ disputeId: d.disputeId, bookingId: d.bookingId, bookingCode: d.bookingCode });

// ---- disputes (FR-DISP-01/02) -----------------------------------------------------------------

/** To the other side of a newly opened dispute. Urgent: the rebuttal clock is running. */
export function disputeOpened(to: { userId: string; isNurse: boolean }, d: DisputeRef & { rebuttalHours: number }): Notice {
  const base = {
    userId: to.userId,
    bookingId: d.bookingId,
    priority: NotificationPriority.HIGH,
    data: disputeData(d),
  };
  return to.isNurse
    ? nurse({ ...base, type: 'DISPUTE_OPENED', title: `Khách hàng mở khiếu nại ca ${d.bookingCode}`, body: `Vui lòng gửi phản hồi và bằng chứng trong ${d.rebuttalHours} giờ. Quyết toán ca này tạm dừng cho tới khi có kết quả.` })
    : customer({ ...base, type: 'DISPUTE_OPENED', title: `Điều dưỡng mở khiếu nại ca ${d.bookingCode}`, body: `Bạn có ${d.rebuttalHours} giờ để gửi phản hồi và bằng chứng.` });
}

/** To the opener when the other side submitted its rebuttal. */
export function disputeRebutted(to: { userId: string; isNurse: boolean }, d: DisputeRef): Notice {
  const base = { userId: to.userId, bookingId: d.bookingId, data: disputeData(d), title: `Đã có phản hồi cho khiếu nại ca ${d.bookingCode}` };
  const body = 'Bên kia đã gửi phản hồi. Khiếu nại đang chờ quản trị viên xem xét.';
  // nurse-web has no separate "updated" type: DISPUTE_OPENED routes to the same dispute page.
  return to.isNurse ? nurse({ ...base, type: 'DISPUTE_OPENED', body }) : customer({ ...base, type: 'DISPUTE_UPDATED', body });
}

export interface DisputeOutcome extends DisputeRef {
  outcome: 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE';
  refunded: number;
  released: number;
  trustScoreDelta: number;
  depositDeducted: number;
}

/** Both parties get the decision; the nurse also gets the deposit deduction as its own notice (ADR-0004). */
export function disputeResolved(nurseId: string, customerId: string, o: DisputeOutcome): Notice[] {
  const data = disputeData(o);
  const out: Notice[] = [];
  if (o.outcome === 'RESOLVED_CUSTOMER') {
    const parts = ['Quản trị viên xử khiếu nại nghiêng về khách hàng.'];
    if (o.trustScoreDelta !== 0) parts.push(`TrustScore ${o.trustScoreDelta}.`);
    out.push(nurse({ userId: nurseId, bookingId: o.bookingId, type: 'DISPUTE_RESOLVED', title: `Kết quả khiếu nại ca ${o.bookingCode}`, body: parts.join(' '), data }));
    out.push(
      customer({
        userId: customerId,
        bookingId: o.bookingId,
        type: 'DISPUTE_RESOLVED',
        title: `Kết quả khiếu nại ca ${o.bookingCode}`,
        body: o.refunded > 0 ? `Khiếu nại được chấp nhận. ${vnd(o.refunded)} đã được hoàn lại cho bạn.` : 'Khiếu nại được chấp nhận.',
        data,
      }),
    );
    if (o.depositDeducted > 0) {
      out.push(
        nurse({
          userId: nurseId,
          bookingId: o.bookingId,
          type: 'DEPOSIT_PENALTY',
          title: `Trừ ký quỹ ${vnd(o.depositDeducted)}`,
          body: `Bồi thường theo kết quả khiếu nại ca ${o.bookingCode}. Khoản này theo phán quyết khiếu nại nên không kháng cáo được.`,
          data,
        }),
      );
    }
  } else {
    out.push(
      nurse({
        userId: nurseId,
        bookingId: o.bookingId,
        type: 'DISPUTE_RESOLVED',
        title: `Kết quả khiếu nại ca ${o.bookingCode}`,
        body: o.released > 0 ? `Khiếu nại được xử cho bạn. ${vnd(o.released)} đã được chuyển vào ví.` : 'Khiếu nại được xử cho bạn. Tiền ca sẽ được quyết toán sau khi bạn check-out.',
        data,
      }),
    );
    out.push(customer({ userId: customerId, bookingId: o.bookingId, type: 'DISPUTE_RESOLVED', title: `Kết quả khiếu nại ca ${o.bookingCode}`, body: 'Quản trị viên xử khiếu nại nghiêng về điều dưỡng.', data }));
  }
  return out;
}

/** Deposit-penalty appeal (deposits → disputes PENALTY_APPEAL). */
export function penaltyAppealResolved(nurseId: string, a: { disputeId: string; bookingId: string; upheld: boolean; amount: number | null }): Notice {
  const data = { disputeId: a.disputeId, bookingId: a.bookingId };
  return a.upheld
    ? nurse({ userId: nurseId, bookingId: a.bookingId, type: 'PENALTY_REVERSED', title: 'Kháng cáo được chấp nhận', body: a.amount ? `${vnd(a.amount)} đã được hoàn lại vào ký quỹ.` : 'Khoản phạt đã được hoàn lại vào ký quỹ.', data })
    : nurse({ userId: nurseId, bookingId: a.bookingId, type: 'DISPUTE_RESOLVED', title: 'Kháng cáo không được chấp nhận', body: 'Khoản trừ ký quỹ được giữ nguyên.', data });
}

// ---- settlements / deposits / withdrawals / commission (FR-PAY-02..04, ADR-0004) --------------

export function settlementDone(nurseId: string, s: { bookingId: string; bookingCode: string; payout: number; withheld: number }): Notice[] {
  const data = { bookingId: s.bookingId, bookingCode: s.bookingCode };
  const out: Notice[] = [
    nurse({
      userId: nurseId,
      bookingId: s.bookingId,
      type: 'SETTLEMENT_DONE',
      title: `Đã quyết toán ca ${s.bookingCode}`,
      body: s.payout > 0 ? `${vnd(s.payout)} đã được chuyển vào số dư khả dụng.` : 'Toàn bộ tiền ca được dùng để bổ sung ký quỹ.',
      data,
    }),
  ];
  if (s.withheld > 0) {
    out.push(
      nurse({
        userId: nurseId,
        bookingId: s.bookingId,
        type: 'DEPOSIT_WITHHELD',
        title: `Giữ lại ${vnd(s.withheld)} vào ký quỹ`,
        body: `Từ tiền ca ${s.bookingCode}, để bổ sung ký quỹ tối thiểu (ADR-0004).`,
        data,
      }),
    );
  }
  return out;
}

export function withdrawalUpdate(nurseId: string, w: { withdrawalId: string; amount: number; status: 'WITHDRAWN' | 'REJECTED'; reason?: string | null }): Notice {
  const data = { withdrawalId: w.withdrawalId };
  return w.status === 'WITHDRAWN'
    ? nurse({ userId: nurseId, type: 'WITHDRAWAL_UPDATE', title: `Đã chuyển ${vnd(w.amount)}`, body: 'Yêu cầu rút tiền đã được chuyển vào tài khoản ngân hàng của bạn.', data })
    : nurse({ userId: nurseId, type: 'WITHDRAWAL_UPDATE', title: 'Yêu cầu rút tiền bị từ chối', body: `${vnd(w.amount)} đã được trả lại số dư khả dụng. Lý do: ${w.reason ?? 'không có'}`, data });
}

export function depositRefundStatus(nurseId: string, r: { requestId: string; status: 'WAITING_HOLD' | 'READY' | 'REFUNDED' | 'REJECTED'; amount?: number | null; reason?: string | null }): Notice {
  const data = { refundRequestId: r.requestId };
  const text: Record<typeof r.status, [string, string]> = {
    WAITING_HOLD: ['Hoàn ký quỹ: đang chờ', 'Yêu cầu hoàn ký quỹ đang chờ hết thời gian giữ hoặc khiếu nại còn mở.'],
    READY: ['Hoàn ký quỹ: đủ điều kiện', 'Yêu cầu hoàn ký quỹ đã đủ điều kiện và đang chờ chuyển khoản.'],
    REFUNDED: [`Đã hoàn ký quỹ ${vnd(r.amount ?? 0)}`, 'Ký quỹ đã được chuyển về tài khoản ngân hàng của bạn.'],
    REJECTED: ['Yêu cầu hoàn ký quỹ bị từ chối', `Lý do: ${r.reason ?? 'không có'}. Ký quỹ vẫn được giữ nguyên, bạn có thể gửi lại yêu cầu.`],
  };
  const [title, body] = text[r.status];
  return nurse({ userId: nurseId, type: 'DEPOSIT_REFUND_STATUS', title, body, data });
}

export function commissionOverdue(nurseId: string): Notice {
  return nurse({
    userId: nurseId,
    type: 'COMMISSION_OVERDUE',
    priority: NotificationPriority.HIGH,
    title: 'Tài khoản tạm khóa: hoa hồng quá hạn',
    body: 'Bạn chưa nộp hoa hồng 15% của ca tiền mặt đúng hạn. Nộp qua VietQR để mở khóa tài khoản ngay.',
    data: {},
  });
}

export function bookingExpired(n: { userId: string; bookingId: string; title: string; body: string }): Notice {
  return customer({ userId: n.userId, bookingId: n.bookingId, type: 'BOOKING_EXPIRED', title: n.title, body: n.body, data: { bookingId: n.bookingId } });
}
