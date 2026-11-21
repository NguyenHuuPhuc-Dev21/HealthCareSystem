import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, History, Star } from 'lucide-react';
import type { TrustScoreHistoryItem, TrustScoreReason } from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';

export interface ScoreHistoryProps {
  history: TrustScoreHistoryItem[];
  loading?: boolean;
}

const REASON_LABELS: Record<TrustScoreReason, string> = {
  GOOD_RATING_RECOVERY: 'Được đánh giá tốt (≥ 4★)',
  CANCEL_OVER_12H: 'Hủy ca trước giờ hẹn > 12h',
  CANCEL_WITHIN_12H: 'Hủy ca gấp trong vòng 12h',
  DISPUTE_UPHELD: 'Khiếu nại khách hàng được xác nhận đúng',
  ADMIN_ADJUSTMENT: 'Điều chỉnh bởi Quản trị viên',
};

export const ScoreHistory: React.FC<ScoreHistoryProps> = ({ history, loading = false }) => {
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all');

  const positiveCount = history.filter((h) => h.delta > 0).length;
  const negativeCount = history.filter((h) => h.delta < 0).length;

  const filteredHistory = history.filter((item) => {
    if (filter === 'positive') return item.delta > 0;
    if (filter === 'negative') return item.delta < 0;
    return true;
  });

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          borderBottom: '1px solid var(--border-hairline)',
          paddingBottom: 10,
        }}
      >
        <h2
          style={{
            color: 'var(--ink-primary)',
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Lịch sử thay đổi điểm
        </h2>
        <span
          className="chip grey tabular-nums"
          style={{ fontSize: 12.5, padding: '2px 8px', borderRadius: 999 }}
        >
          {loading ? 'Đang tải...' : `${history.length} biến động`}
        </span>
      </div>

      {/* Bộ lọc nhanh: Tất cả / Cộng điểm / Bị trừ */}
      {!loading && history.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              background: filter === 'all' ? 'var(--brand-jade, #166B58)' : '#F1F5F9',
              color: filter === 'all' ? '#ffffff' : 'var(--ink-secondary, #64748B)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Tất cả ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('positive')}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              background: filter === 'positive' ? '#15803D' : '#F0FDF4',
              color: filter === 'positive' ? '#ffffff' : '#166534',
              border: filter === 'positive' ? 'none' : '1px solid #BBF7D0',
              cursor: 'pointer',
            }}
          >
            Cộng điểm (+{positiveCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('negative')}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              background: filter === 'negative' ? '#DC2626' : '#FEF2F2',
              color: filter === 'negative' ? '#ffffff' : '#991B1B',
              border: filter === 'negative' ? 'none' : '1px solid #FECACA',
              cursor: 'pointer',
            }}
          >
            Bị trừ (−{negativeCount})
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)' }}>
          Đang tải lịch sử điểm uy tín...
        </div>
      ) : history.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            color: 'var(--ink-muted)',
          }}
        >
          <History size={36} style={{ opacity: 0.35, marginBottom: 8 }} aria-hidden="true" />
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>Chưa có biến động điểm nào</div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Điểm khởi tạo được bảo toàn. Các thay đổi sau ca hoàn tất hoặc sự cố sẽ hiển thị tại đây.
          </p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--ink-muted)', fontSize: 14 }}>
          Không có biến động nào phù hợp với bộ lọc đã chọn.
        </div>
      ) : (
        <div>
          {filteredHistory.map((item) => {
            const isPositive = item.delta > 0;
            const isWarning = item.delta === -5;

            const label = REASON_LABELS[item.reason] || item.reason;

            return (
              <div key={item.id} className="tx-row">
                <span
                  className={`tic ${isPositive ? '' : isWarning ? 'pending' : 'rejected'}`}
                  aria-hidden="true"
                >
                  {isPositive ? (
                    <Star size={19} />
                  ) : isWarning ? (
                    <AlertTriangle size={19} />
                  ) : (
                    <AlertCircle size={19} />
                  )}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: 'var(--ink-primary)',
                      fontSize: 15,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.bookingCode ? `Ca ${item.bookingCode}` : 'Hệ thống'} · {label}
                  </div>

                  <div
                    style={{
                      color: 'var(--ink-muted)',
                      fontSize: 13,
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="tabular-nums">{formatDateTime(item.createdAt)}</span>
                    {item.note && (
                      <>
                        <span>•</span>
                        <span>{item.note}</span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className="tabular-nums font-display"
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    color: isPositive
                      ? 'var(--color-success)'
                      : isWarning
                      ? 'var(--accent-ochre)'
                      : 'var(--alert-crimson)',
                  }}
                >
                  {isPositive ? `+${item.delta}` : `${item.delta}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
