import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import type { DepositPenaltyDto } from '@healthcare-system/shared';
import { formatDateTime, formatVND } from '../../../lib/formatters';
import { PENALTY_REASON_LABELS } from '../deposit-labels';
import { AppealPenaltyModal } from './AppealPenaltyModal';

export interface PenaltyListProps {
  penalties: DepositPenaltyDto[];
  onAppealSubmit: (txId: string, reason: string, evidenceKeys?: string[]) => Promise<void>;
}

function formatRemainingTime(deadlineIso: string | null): { text: string; isExpired: boolean } {
  if (!deadlineIso) return { text: '', isExpired: true };
  const diffMs = new Date(deadlineIso).getTime() - Date.now();
  if (diffMs <= 0) return { text: 'Hết hạn khiếu nại', isExpired: true };

  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));

  if (days > 0) {
    return { text: `còn ${days} ngày ${hours} giờ`, isExpired: false };
  }
  return { text: `còn ${hours} giờ`, isExpired: false };
}

export const PenaltyList: React.FC<PenaltyListProps> = ({ penalties, onAppealSubmit }) => {
  const [selectedPenalty, setSelectedPenalty] = useState<DepositPenaltyDto | null>(null);

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: 'var(--navy, #0F172A)', fontSize: '18px', margin: 0, fontWeight: 800 }}>
            Lịch sử khấu trừ &amp; Quyền khiếu nại
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)', margin: '4px 0 0' }}>
            Minh bạch mọi khoản trừ SLA · Quyền khiếu nại trong vòng 3 ngày làm việc (ADR-0004 D3)
          </p>
        </div>
      </div>

      {penalties.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--brand-jade-soft, #E6F4F1)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 10px',
              color: 'var(--brand-jade, #166B58)',
            }}
          >
            <CheckCircle2 size={28} />
          </div>
          <p style={{ fontWeight: 800, fontSize: '16px', color: 'var(--navy, #0F172A)', margin: 0 }}>
            Không có khoản khấu trừ phạt nào
          </p>
          <p style={{ fontSize: '14px', margin: '4px 0 0' }}>
            Bạn luôn duy trì chất lượng ca trực xuất sắc và tuân thủ đúng cam kết dịch vụ.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
          {penalties.map((item) => {
            const timeInfo = formatRemainingTime(item.appealDeadline);

            return (
              <div
                key={item.transactionId}
                className="tx-row"
                style={{ padding: '16px 4px', alignItems: 'flex-start' }}
              >
                <span className={`tic ${item.reversed ? '' : 'rejected'}`} aria-hidden="true" style={{ marginTop: 2 }}>
                  {item.reversed ? (
                    <RotateCcw size={20} color="var(--brand-jade, #166B58)" />
                  ) : (
                    <AlertTriangle size={20} color="#DC2626" />
                  )}
                </span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ color: 'var(--navy, #0F172A)', fontSize: '15.5px' }}>
                      {PENALTY_REASON_LABELS[item.reason] || item.reason}
                    </b>

                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--surface-subtle, #F1F5F9)',
                        color: 'var(--text-secondary, #64748B)',
                      }}
                    >
                      {item.slaRuleRef}
                    </span>

                    {item.reversed && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: '#DCFCE7',
                          color: '#15803D',
                        }}
                      >
                        Đã hoàn lại (Reversed)
                      </span>
                    )}

                    {item.appealDisputeId && !item.reversed && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: '#FEF3C7',
                          color: '#92400E',
                        }}
                      >
                        Đang khiếu nại ({item.appealDisputeId})
                      </span>
                    )}
                  </div>

                  {item.bookingCode && (
                    <div style={{ marginTop: 4, fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary, #64748B)' }}>Ca trực liên quan: </span>
                      <Link
                        to={`/shifts/${item.bookingId || item.bookingCode}`}
                        style={{
                          color: 'var(--brand-jade, #166B58)',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        {item.bookingCode}
                      </Link>
                    </div>
                  )}

                  {item.note && (
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748B)', fontSize: '14px' }}>
                      {item.note}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: '13px',
                      color: 'var(--muted, #94A3B8)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{formatDateTime(item.createdAt)}</span>

                    {/* Hạn khiếu nại & Nút khiếu nại */}
                    {!item.reversed && !item.appealDisputeId && (
                      <>
                        {item.appealDeadline && !timeInfo.isExpired ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#D97706', fontWeight: 600 }}>
                              Hạn khiếu nại: {timeInfo.text}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setSelectedPenalty(item)}
                              style={{
                                padding: '3px 10px',
                                fontSize: '12.5px',
                                fontWeight: 800,
                                borderRadius: 6,
                                borderColor: 'var(--brand-jade, #166B58)',
                                color: 'var(--brand-jade, #166B58)',
                              }}
                            >
                              Khiếu nại
                            </button>
                          </div>
                        ) : item.appealDeadline && timeInfo.isExpired ? (
                          <span style={{ color: 'var(--muted, #94A3B8)' }}>Hết hạn khiếu nại</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary, #64748B)', fontSize: '12.5px' }}>
                            Đã phân xử qua khiếu nại, không khiếu nại lại
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Số tiền phạt */}
                <div
                  className="amt neg"
                  style={{
                    fontSize: '17px',
                    fontWeight: 900,
                    textDecoration: item.reversed ? 'line-through' : 'none',
                    opacity: item.reversed ? 0.5 : 1,
                  }}
                >
                  -{formatVND(item.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal khiếu nại */}
      {selectedPenalty && (
        <AppealPenaltyModal
          penalty={selectedPenalty}
          onClose={() => setSelectedPenalty(null)}
          onSubmit={async (reason, evidenceKeys) => {
            await onAppealSubmit(selectedPenalty.transactionId, reason, evidenceKeys);
          }}
        />
      )}
    </div>
  );
};
