import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import type { CommissionDebtDto } from '@healthcare-system/shared';
import { formatDateTime, formatVND } from '../../../lib/formatters';

export interface CommissionDebtCardProps {
  debt: CommissionDebtDto;
  onPay: (debt: CommissionDebtDto) => void;
  isPaying?: boolean;
}

interface CountdownState {
  text: string;
  isOverdue: boolean;
  isUrgent: boolean; // < 2 hours
}

function computeCountdown(dueAt: string, status: string): CountdownState {
  const diffMs = new Date(dueAt).getTime() - Date.now();

  if (status === 'OVERDUE' || diffMs <= 0) {
    const overdueMs = Math.abs(diffMs);
    const overdueHours = Math.floor(overdueMs / (1000 * 3600));
    const overdueMins = Math.floor((overdueMs % (1000 * 3600)) / (1000 * 60));
    return {
      text: overdueHours > 0
        ? `Quá hạn ${overdueHours} giờ ${overdueMins} phút`
        : `Quá hạn ${overdueMins} phút`,
      isOverdue: true,
      isUrgent: true,
    };
  }

  const hours = Math.floor(diffMs / (1000 * 3600));
  const mins = Math.floor((diffMs % (1000 * 3600)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  const isUrgent = diffMs < 2 * 3600 * 1000; // dưới 2 giờ

  return {
    text: hours > 0
      ? `Còn ${hours.toString().padStart(2, '0')} giờ ${mins.toString().padStart(2, '0')} phút`
      : `Còn ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
    isOverdue: false,
    isUrgent,
  };
}

export const CommissionDebtCard: React.FC<CommissionDebtCardProps> = ({
  debt,
  onPay,
  isPaying = false,
}) => {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    computeCountdown(debt.dueAt, debt.status)
  );

  useEffect(() => {
    if (debt.status === 'PAID') return;

    const timer = setInterval(() => {
      setCountdown(computeCountdown(debt.dueAt, debt.status));
    }, 1000);

    return () => clearInterval(timer);
  }, [debt.dueAt, debt.status]);

  const isOverdue = debt.status === 'OVERDUE' || countdown.isOverdue;
  const isPaid = debt.status === 'PAID';

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        borderRadius: 16,
        background: '#ffffff',
        border: isOverdue
          ? '2px solid #EF4444'
          : isPaid
          ? '1px solid #E2E8F0'
          : '1px solid #CBD5E1',
        boxShadow: isOverdue
          ? '0 4px 18px rgba(239, 68, 68, 0.12)'
          : '0 2px 10px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header: Mã ca + Tên dịch vụ & Badge trạng thái */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '15.5px',
                fontWeight: 900,
                color: 'var(--navy, #0F172A)',
                background: '#F1F5F9',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {debt.bookingCode}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)' }}>
              (Ca thu tiền mặt trực tiếp)
            </span>
          </div>
          <h3
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: 'var(--navy, #0F172A)',
              margin: '6px 0 0',
            }}
          >
            {debt.serviceName}
          </h3>
        </div>

        {/* Trạng thái Badge */}
        <div>
          {isPaid ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#F0FDF4',
                color: '#166534',
                border: '1px solid #BBF7D0',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: '13.5px',
                fontWeight: 800,
              }}
            >
              <CheckCircle2 size={16} color="#16A34A" />
              <span>Đã xác nhận nộp</span>
            </span>
          ) : isOverdue ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#FEF2F2',
                color: '#991B1B',
                border: '1px solid #FECACA',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: '13.5px',
                fontWeight: 800,
              }}
            >
              <ShieldAlert size={16} color="#DC2626" />
              <span>Quá hạn — Tạm khóa nhận ca</span>
            </span>
          ) : countdown.isUrgent ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#FEF2F2',
                color: '#B91C1C',
                border: '1px solid #FECACA',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: '13.5px',
                fontWeight: 800,
              }}
            >
              <AlertTriangle size={15} color="#DC2626" />
              <span>Gấp: Sắp hết 24h</span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #FDE68A',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: '13.5px',
                fontWeight: 800,
              }}
            >
              <Clock size={15} color="#D97706" />
              <span>Chưa nộp hoa hồng</span>
            </span>
          )}
        </div>
      </div>

      {/* Grid 3 thông số chi tiết */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          padding: '14px 16px',
          background: isOverdue ? '#FFF5F5' : '#F8FAFC',
          borderRadius: 12,
          border: isOverdue ? '1px solid #FED7D7' : '1px solid #F1F5F9',
        }}
      >
        {/* 1. Giá ca */}
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
            Tiền mặt khách trả (Trong app)
          </div>
          <div
            style={{
              fontSize: '16.5px',
              fontWeight: 800,
              color: 'var(--navy, #0F172A)',
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatVND(debt.bookingAmount)}
          </div>
        </div>

        {/* 2. Hoa hồng 15% */}
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
            Hoa hồng 15% phải nộp
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 900,
              color: isOverdue ? '#DC2626' : 'var(--brand-jade, #166B58)',
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatVND(debt.commissionAmount)}
          </div>
        </div>

        {/* 3. Thời hạn nộp (24h) */}
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
            {isPaid ? 'Thời gian thanh toán' : 'Hạn nộp (24h sau ca)'}
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: isPaid
                ? '#15803D'
                : isOverdue || countdown.isUrgent
                ? '#DC2626'
                : '#78350F',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isPaid ? (
              <span>{debt.paidAt ? formatDateTime(debt.paidAt) : 'Đã nộp'}</span>
            ) : (
              <>
                {isOverdue ? (
                  <AlertCircle size={16} color="#DC2626" />
                ) : (
                  <Clock size={16} color={countdown.isUrgent ? '#DC2626' : '#D97706'} />
                )}
                <span>{countdown.text}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Nút nộp VietQR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 4,
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)' }}>
          {isPaid ? (
            <span style={{ color: '#16A34A', fontWeight: 600 }}>
              ✓ Đã gạch nợ hoàn tất · Ca đã chuyển sang trạng thái quyết toán
            </span>
          ) : isOverdue ? (
            <span style={{ color: '#B91C1C', fontWeight: 700 }}>
              ⚠️ Nộp ngay để gỡ khóa tài khoản và tiếp tục nhận ca mới
            </span>
          ) : (
            <span>Nội dung chuyển khoản tự động kèm mã ca <b>{debt.bookingCode}</b></span>
          )}
        </div>

        {!isPaid && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onPay(debt)}
            disabled={isPaying}
            style={{
              padding: '10px 22px',
              fontSize: '15px',
              fontWeight: 800,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: isOverdue ? '#DC2626' : undefined,
              borderColor: isOverdue ? '#DC2626' : undefined,
            }}
          >
            <QrCode size={18} />
            <span>{isOverdue ? 'Nộp ngay gỡ khóa' : 'Nộp qua VietQR'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
