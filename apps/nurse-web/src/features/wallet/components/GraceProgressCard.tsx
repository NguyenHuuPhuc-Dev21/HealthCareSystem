import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import type { DepositStatusDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';

export interface GraceProgressCardProps {
  status: DepositStatusDto & { totalWithheld?: number };
}

function calculateDaysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 3600 * 1000)));
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Chưa xác định';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

export const GraceProgressCard: React.FC<GraceProgressCardProps> = ({ status }) => {
  const { grace, minDeposit, shortfall, canAcceptCash, totalWithheld = 0 } = status;

  // Nếu không active và cũng không còn thiếu ký quỹ (tức là đã đủ 300k bình thường) thì không cần hiện card này
  if (!grace.active && shortfall <= 0) {
    return null;
  }

  const remainingShifts = Math.max(0, grace.maxShifts - grace.shiftsUsed);
  const daysLeft = calculateDaysLeft(grace.expiresAt);
  const isExpired = !grace.active && shortfall > 0;

  if (isExpired) {
    return (
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#B45309' }}>
          <AlertCircle size={22} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#92400E' }}>
            Giai đoạn làm quen đã kết thúc
          </h3>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '14.5px', color: '#78350F', lineHeight: 1.5 }}>
          Bạn đã dùng hết {grace.maxShifts} ca làm quen hoặc đã quá thời hạn 30 ngày. Vui lòng nạp thêm{' '}
          <b>{formatVND(shortfall)}</b> để tiếp tục nhận ca mới. Các ca đã xác nhận từ trước vẫn được giữ nguyên.
        </p>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        background: '#F0F9FF',
        border: '1px solid #BAE6FD',
        borderRadius: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0284C7' }}>
          <Sparkles size={22} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: '17.5px', fontWeight: 800, color: '#0369A1' }}>
            Giai đoạn làm quen (Ân hạn ký quỹ — ADR-0004)
          </h3>
        </div>

        <span
          style={{
            background: '#E0F2FE',
            color: '#0369A1',
            fontSize: '14px',
            fontWeight: 800,
            padding: '4px 12px',
            borderRadius: 8,
            border: '1px solid #BAE6FD',
          }}
        >
          Ca chuyển khoản: {grace.shiftsUsed} / {grace.maxShifts} đã dùng
        </span>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: '15px', color: '#0C4A6E', lineHeight: 1.5 }}>
        Bạn đang trong giai đoạn làm quen: còn nhận được <b>{remainingShifts} ca chuyển khoản</b>, đến hết ngày{' '}
        <b>{formatDate(grace.expiresAt)}</b> (còn {daysLeft} ngày). Mỗi ca hoàn thành, hệ thống tự động giữ lại{' '}
        <b>{Math.round(grace.withholdRate * 100)}% phần thực nhận</b> vào ký quỹ cho tới khi tích lũy đủ{' '}
        {formatVND(minDeposit)}.
      </p>

      {/* Thông số chi tiết */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px dashed #BAE6FD',
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          fontSize: '14px',
          color: '#075985',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={16} color="#0284C7" />
          Đã giữ lại: <b>{formatVND(totalWithheld || status.depositBalance)}</b>
        </span>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} color="#0284C7" />
          Hạn chót: <b>{formatDate(grace.expiresAt)}</b>
        </span>

        {!canAcceptCash && (
          <span style={{ color: '#B45309', fontWeight: 700 }}>
            ⚠️ Ca tiền mặt cần ký quỹ đủ {formatVND(minDeposit)}.
          </span>
        )}
      </div>
    </div>
  );
};
