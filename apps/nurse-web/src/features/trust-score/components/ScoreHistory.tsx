import React from 'react';
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
  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
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
      ) : (
        <div>
          {history.map((item) => {
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
