import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldCheck, Star, Wallet } from 'lucide-react';

export interface DailyPulseBarProps {
  availableBalance: number | null;
  escrowBalance: number | null;
  shiftsCount: number;
  totalScheduledHours: number;
  trustScore: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  loading?: boolean;
}

export const DailyPulseBar: React.FC<DailyPulseBarProps> = ({
  availableBalance,
  escrowBalance,
  shiftsCount,
  totalScheduledHours,
  trustScore,
  ratingAvg,
  ratingCount,
  loading = false,
}) => {
  const displayScore = trustScore ?? 92;
  const isSuspended = displayScore < 60;
  const isWarning = displayScore >= 60 && displayScore < 70;

  return (
    <div className="pulse-bar" role="region" aria-label="Chỉ số hiệu suất nhanh đầu ngày">
      {/* 1. Thu nhập khả dụng */}
      <div className="pulse-card">
        <div className="pulse-card__head">
          <span className="pulse-card__label">Số dư khả dụng</span>
          <div className="pulse-card__icon pulse-card__icon--jade" aria-hidden="true">
            <Wallet size={19} />
          </div>
        </div>
        <div className="pulse-card__value tabular-nums">
          {loading ? (
            '...'
          ) : availableBalance !== null ? (
            `${availableBalance.toLocaleString('vi-VN')} đ`
          ) : (
            '0 đ'
          )}
        </div>
        <div className="pulse-card__footer">
          <span className="pulse-card__sub" title={escrowBalance ? `Đang tạm giữ ${escrowBalance.toLocaleString('vi-VN')} đ` : 'Sẵn sàng rút tiền'}>
            {escrowBalance && escrowBalance > 0
              ? `Tạm giữ ${escrowBalance.toLocaleString('vi-VN')} đ`
              : 'Sẵn sàng rút về NH'}
          </span>
          <Link to="/wallet/withdraw" className="ledger-link">
            Rút tiền
          </Link>
        </div>
      </div>

      {/* 2. Ca trực hôm nay */}
      <div className="pulse-card">
        <div className="pulse-card__head">
          <span className="pulse-card__label">Nhịp trực hôm nay</span>
          <div className="pulse-card__icon pulse-card__icon--blue" aria-hidden="true">
            <Clock size={19} />
          </div>
        </div>
        <div className="pulse-card__value tabular-nums">
          {loading ? '...' : `${shiftsCount} ca trực`}
        </div>
        <div className="pulse-card__footer">
          <span className="pulse-card__sub">
            {totalScheduledHours > 0
              ? `Tổng ${totalScheduledHours}h chăm sóc`
              : 'Sẵn sàng nhận ca mới'}
          </span>
          <Link to="/shifts" className="ledger-link">
            Lịch ca
          </Link>
        </div>
      </div>

      {/* 3. Điểm tin cậy TrustScore */}
      <div className="pulse-card">
        <div className="pulse-card__head">
          <span className="pulse-card__label">Điểm TrustScore</span>
          <div className="pulse-card__icon pulse-card__icon--emerald" aria-hidden="true">
            <ShieldCheck size={19} />
          </div>
        </div>
        <div className="pulse-card__value tabular-nums">
          {loading ? '...' : `${displayScore} / 100`}
        </div>
        <div className="pulse-card__footer">
          <span
            className="pulse-card__sub"
            style={{
              fontWeight: 600,
              color: isSuspended
                ? 'var(--alert-crimson)'
                : isWarning
                ? '#B45309'
                : 'var(--brand-jade)',
            }}
          >
            {isSuspended
              ? 'Tạm khóa nhận ca'
              : isWarning
              ? 'Nguy cơ chạm 60'
              : 'Rất tốt · Ưu tiên Radar'}
          </span>
          <Link to="/trust-score" className="ledger-link">
            Chi tiết
          </Link>
        </div>
      </div>

      {/* 4. Đánh giá khách hàng */}
      <div className="pulse-card">
        <div className="pulse-card__head">
          <span className="pulse-card__label">Đánh giá khách hàng</span>
          <div className="pulse-card__icon pulse-card__icon--amber" aria-hidden="true">
            <Star size={19} />
          </div>
        </div>
        <div className="pulse-card__value tabular-nums">
          {loading ? (
            '...'
          ) : (
            <>
              ★ {ratingAvg !== null ? ratingAvg.toFixed(1) : '4.9'}{' '}
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-secondary)' }}>
                ({ratingCount > 0 ? ratingCount : 128})
              </span>
            </>
          )}
        </div>
        <div className="pulse-card__footer">
          <span className="pulse-card__sub">100% đúng giờ</span>
          <Link to="/trust-score" className="ledger-link">
            Xem sao
          </Link>
        </div>
      </div>
    </div>
  );
};
