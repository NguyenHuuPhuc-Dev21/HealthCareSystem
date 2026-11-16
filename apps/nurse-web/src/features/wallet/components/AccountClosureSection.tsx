import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  X,
} from 'lucide-react';
import {
  DEFAULT_DEPOSIT_REFUND_HOLD_DAYS,
  DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS,
  DepositRefundStatus,
} from '@healthcare-system/shared';
import type { BankAccountDto, DepositRefundPendingReason, DepositRefundRequestDto } from '@healthcare-system/shared';
import { formatDateTime, formatVND } from '../../../lib/formatters';
import { REFUND_STATUS_LABELS } from '../deposit-labels';

export interface AccountClosureSectionProps {
  refundRequest: DepositRefundRequestDto | null;
  depositBalance: number;
  bankAccount: BankAccountDto | null;
  onRequestClosure: () => Promise<void>;
  onCancelRequest: (id: string) => Promise<void>;
}

export const AccountClosureSection: React.FC<AccountClosureSectionProps> = ({
  refundRequest,
  depositBalance,
  bankAccount,
  onRequestClosure,
  onCancelRequest,
}) => {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [confirmedUnderstood, setConfirmedUnderstood] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const hasOpenRequest =
    refundRequest &&
    refundRequest.status !== DepositRefundStatus.CANCELLED;

  const handleOpenModal = () => {
    setConfirmedUnderstood(false);
    setActionError(null);
    setModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmedUnderstood || submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await onRequestClosure();
      setModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Không thể tạo yêu cầu ngừng hợp tác. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCancelModal = () => {
    setCancelError(null);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!refundRequest || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await onCancelRequest(refundRequest.id);
      setCancelModalOpen(false);
    } catch (err: any) {
      setCancelError(err.message || 'Không thể hủy yêu cầu ngừng hợp tác. Vui lòng thử lại.');
    } finally {
      setCancelling(false);
    }
  };

  const conditionsList: { key: DepositRefundPendingReason; label: string; link?: string }[] = [
    { key: 'ACTIVE_BOOKING', label: 'Không còn ca đã nhận hoặc đang làm' },
    { key: 'HOLD_DAYS', label: `Đã qua ${DEFAULT_DEPOSIT_REFUND_HOLD_DAYS} ngày kể từ ca cuối cùng` },
    { key: 'OPEN_DISPUTE', label: 'Không có khiếu nại đang mở hoặc đang phân xử' },
    { key: 'UNPAID_COMMISSION', label: 'Không còn nợ hoa hồng ca tiền mặt', link: '/shifts' },
  ];

  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 28,
        borderTop: '2px dashed var(--border-hairline, #CBD5E1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: 0 }}>
            Ngừng hợp tác &amp; Hoàn trả ký quỹ
          </h3>
          <p style={{ fontSize: '14.5px', color: 'var(--text-secondary, #64748B)', margin: '4px 0 0' }}>
            Quy trình minh bạch khi bạn muốn dừng công việc điều dưỡng trên nền tảng (ADR-0004 D3)
          </p>
        </div>

        {!hasOpenRequest && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenModal}
            style={{
              padding: '8px 18px',
              fontSize: '14.5px',
              fontWeight: 700,
              borderRadius: 10,
              color: '#DC2626',
              borderColor: '#FCA5A5',
            }}
          >
            <LogOut size={16} />
            <span>Ngừng hợp tác và hoàn ký quỹ</span>
          </button>
        )}
      </div>

      {/* Hiển thị chi tiết yêu cầu đang mở */}
      {hasOpenRequest && refundRequest && (
        <div
          className="card"
          style={{
            marginTop: 18,
            padding: '22px 24px',
            background:
              refundRequest.status === DepositRefundStatus.READY
                ? '#F0FDF4'
                : refundRequest.status === DepositRefundStatus.REJECTED
                ? '#FEF2F2'
                : '#F8FAFC',
            border: `1px solid ${
              refundRequest.status === DepositRefundStatus.READY
                ? '#86EFAC'
                : refundRequest.status === DepositRefundStatus.REJECTED
                ? '#FECACA'
                : 'var(--border-hairline, #E2E8F0)'
            }`,
            borderRadius: 14,
          }}
        >
          {/* Trạng thái yêu cầu */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '15px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
                Trạng thái:
              </span>
              <span
                style={{
                  fontSize: '14.5px',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 8,
                  background:
                    refundRequest.status === DepositRefundStatus.READY
                      ? '#DCFCE7'
                      : refundRequest.status === DepositRefundStatus.REJECTED
                      ? '#FEE2E2'
                      : '#FEF3C7',
                  color:
                    refundRequest.status === DepositRefundStatus.READY
                      ? '#15803D'
                      : refundRequest.status === DepositRefundStatus.REJECTED
                      ? '#B91C1C'
                      : '#92400E',
                }}
              >
                {REFUND_STATUS_LABELS[refundRequest.status] || refundRequest.status}
              </span>
            </div>

            {(refundRequest.status === DepositRefundStatus.REQUESTED ||
              refundRequest.status === DepositRefundStatus.WAITING_HOLD) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenCancelModal}
                disabled={cancelling}
                style={{ padding: '6px 14px', fontSize: '13.5px', borderRadius: 8, fontWeight: 700 }}
              >
                Hủy yêu cầu ngừng hợp tác
              </button>
            )}
          </div>

          {/* Cảnh báo nợ nếu có */}
          {refundRequest.debtAmount > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 16px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 10,
                color: '#991B1B',
                fontSize: '14.5px',
                lineHeight: 1.5,
              }}
            >
              <b>Lưu ý số dư nợ:</b> Bạn đang có số dư ký quỹ âm (nợ {formatVND(refundRequest.debtAmount)}). Khoản này
              không được hoàn và cần được thanh toán trước khi đóng tài khoản.
            </div>
          )}

          {/* Bị từ chối */}
          {refundRequest.status === DepositRefundStatus.REJECTED && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 16px',
                background: '#FEF2F2',
                borderRadius: 10,
                color: '#991B1B',
                fontSize: '14.5px',
              }}
            >
              <b>Lý do từ chối:</b> {refundRequest.rejectReason || 'Thông tin tài khoản ngân hàng chưa trùng khớp.'}
              <div style={{ marginTop: 4, color: '#B91C1C', fontSize: '13.5px' }}>
                Tiền ký quỹ vẫn thuộc quyền sở hữu của bạn. Vui lòng liên hệ hỗ trợ để cập nhật thông tin chi trả.
              </div>
            </div>
          )}

          {/* Sẵn sàng chi trả */}
          {refundRequest.status === DepositRefundStatus.READY && (
            <div style={{ marginTop: 14, fontSize: '15px', color: '#166534', lineHeight: 1.5 }}>
              Số tiền hoàn: <b>{formatVND(refundRequest.refundAmount || depositBalance)}</b>. Sẽ được chuyển về tài
              khoản ngân hàng trong vòng <b>{DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS} ngày làm việc</b>
              {refundRequest.dueBy && ` (chậm nhất ngày ${formatDateTime(refundRequest.dueBy)})`}.
            </div>
          )}

          {/* 4 Điều kiện kiểm tra */}
          <div style={{ marginTop: 18 }}>
            <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--navy, #0F172A)', margin: '0 0 10px' }}>
              Kiểm tra 4 điều kiện "Sẵn sàng hoàn":
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conditionsList.map((cond) => {
                const isPending = (refundRequest.pendingReasons || []).includes(cond.key);

                return (
                  <div
                    key={cond.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: isPending ? '#FFFBEB' : '#ffffff',
                      border: `1px solid ${isPending ? '#FDE68A' : 'var(--border-hairline, #E2E8F0)'}`,
                      borderRadius: 10,
                      fontSize: '14.5px',
                    }}
                  >
                    {isPending ? (
                      <Clock size={18} color="#D97706" style={{ flexShrink: 0 }} />
                    ) : (
                      <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0 }} />
                    )}

                    <span
                      style={{
                        color: isPending ? '#92400E' : 'var(--navy, #0F172A)',
                        fontWeight: isPending ? 700 : 500,
                        flex: 1,
                      }}
                    >
                      {cond.label}
                    </span>

                    {isPending && cond.link && (
                      <Link
                        to={cond.link}
                        style={{
                          fontSize: '13px',
                          color: 'var(--brand-jade, #166B58)',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        Xử lý ngay
                      </Link>
                    )}

                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: isPending ? '#B45309' : '#15803D',
                      }}
                    >
                      {isPending ? 'Đang chờ' : 'Đạt'}
                    </span>
                  </div>
                );
              })}
            </div>

            {refundRequest.eligibleAt && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: '14px',
                  color: 'var(--text-secondary, #64748B)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Calendar size={16} />
                <span>
                  Thời điểm sớm nhất đủ điều kiện hoàn: <b>{formatDateTime(refundRequest.eligibleAt)}</b>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal xác nhận 5 ý khi bấm Ngừng hợp tác */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 560,
              background: '#ffffff',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: 'var(--text-secondary, #64748B)',
              }}
              aria-label="Đóng modal"
            >
              <X size={22} />
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: '0 0 10px' }}>
              Xác nhận ngừng hợp tác &amp; hoàn ký quỹ
            </h3>

            <div
              style={{
                padding: '12px 16px',
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: 12,
                color: '#92400E',
                fontSize: '14px',
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              ⚠️ Vui lòng đọc kỹ <b>5 điều khoản quan trọng</b> trước khi gửi yêu cầu:
            </div>

            {actionError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  borderRadius: 8,
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                {actionError}
              </div>
            )}

            {/* 5 Ý quan trọng theo ADR-0004 D3 */}
            <ol
              style={{
                paddingLeft: 20,
                margin: '0 0 18px',
                fontSize: '14.5px',
                color: 'var(--navy, #0F172A)',
                lineHeight: 1.6,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <li>
                Từ thời điểm gửi yêu cầu, bạn sẽ <b>không nhận thêm bất kỳ ca mới nào</b>.
              </li>
              <li>
                Ký quỹ được hoàn khi đủ cả <b>4 điều kiện an toàn</b>: không còn ca đang làm, qua 7 ngày từ ca cuối,
                không có khiếu nại đang mở, không nợ hoa hồng tiền mặt.
              </li>
              <li>
                Số tiền hoàn bằng <b>số dư ký quỹ thực tế</b> ({formatVND(depositBalance)}). Nếu đang có số dư nợ thì
                không hoàn và cần thanh toán hết nợ.
              </li>
              <li>
                Chi trả trong vòng <b>{DEFAULT_DEPOSIT_REFUND_SLA_WORKING_DAYS} ngày làm việc</b> kể từ khi "Sẵn sàng
                hoàn", chuyển vào tài khoản ngân hàng đã đăng ký:{' '}
                <b>
                  {bankAccount ? `${bankAccount.bankName} (${bankAccount.accountMasked})` : 'Tài khoản ngân hàng của bạn'}
                </b>.
              </li>
              <li>
                Bạn có thể <b>hủy yêu cầu</b> bất cứ lúc nào khi trạng thái chưa chuyển sang "Sẵn sàng hoàn".
              </li>
            </ol>

            {/* Checkbox "Tôi hiểu" */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--surface-subtle, #F8FAFC)',
                borderRadius: 10,
                border: '1px solid var(--border-hairline, #E2E8F0)',
                cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              <input
                type="checkbox"
                checked={confirmedUnderstood}
                onChange={(e) => setConfirmedUnderstood(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2 }}
              />
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--navy, #0F172A)' }}>
                Tôi đã đọc, hiểu rõ 5 điều trên và đồng ý ngừng hợp tác.
              </span>
            </label>

            {/* Footer buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                style={{ padding: '8px 18px', fontSize: '14.5px', borderRadius: 10 }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSubmit}
                disabled={!confirmedUnderstood || submitting}
                style={{
                  padding: '8px 22px',
                  fontSize: '14.5px',
                  fontWeight: 800,
                  borderRadius: 10,
                  background: '#DC2626',
                  borderColor: '#DC2626',
                }}
              >
                {submitting ? 'Đang gửi...' : 'Xác nhận ngừng hợp tác'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận HỦY yêu cầu ngừng hợp tác */}
      {cancelModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#ffffff',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: 'var(--text-secondary, #64748B)',
              }}
              aria-label="Đóng modal"
            >
              <X size={22} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#FEF3C7',
                  color: '#D97706',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: 0 }}>
                  Hủy yêu cầu ngừng hợp tác?
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary, #64748B)', margin: '2px 0 0' }}>
                  Tiếp tục hoạt động điều dưỡng trên CareNest
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14.5px', color: 'var(--navy, #0F172A)', lineHeight: 1.6, margin: '0 0 16px' }}>
              Khi bạn hủy yêu cầu ngừng hợp tác, tài khoản của bạn sẽ được kích hoạt lại quyền nhận ca làm việc bình
              thường (theo mức ký quỹ hiện tại). Bạn vẫn có thể gửi lại yêu cầu ngừng hợp tác bất cứ lúc nào trong tương
              lai nếu muốn.
            </p>

            {cancelError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  borderRadius: 8,
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                {cancelError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
                style={{ padding: '8px 18px', fontSize: '14.5px', borderRadius: 10 }}
              >
                Giữ yêu cầu
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                style={{
                  padding: '8px 20px',
                  fontSize: '14.5px',
                  fontWeight: 800,
                  borderRadius: 10,
                  background: 'var(--brand-jade, #166B58)',
                  borderColor: 'var(--brand-jade, #166B58)',
                }}
              >
                {cancelling ? 'Đang hủy...' : 'Xác nhận hủy yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
