import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { UpcomingSettlementDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';

export interface UpcomingSettlementsProps {
  settlements: UpcomingSettlementDto[];
}

function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Đang quyết toán...';

  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const UpcomingSettlements: React.FC<UpcomingSettlementsProps> = ({ settlements }) => {
  const [, setTick] = useState<number>(0);

  // Cập nhật đồng hồ đếm ngược mỗi giây
  useEffect(() => {
    if (settlements.length === 0) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [settlements.length]);

  if (settlements.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {settlements.map((item) => {
        const countdown = formatCountdown(item.settleAt);

        if (item.disputeOpen) {
          return (
            <div
              key={item.bookingCode}
              className="card"
              style={{
                padding: '16px 20px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626' }}>
                <AlertTriangle size={20} aria-hidden="true" />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  Đang khiếu nại — tạm dừng quyết toán đơn {item.bookingCode}
                </h4>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '14.5px', color: '#991B1B', lineHeight: 1.5 }}>
                Đơn {item.serviceName} ({formatVND(item.netAmount)}) đang trong quy trình phân xử.
                Đồng hồ quyết toán được tạm dừng cho đến khi Admin có kết luận.
              </p>
            </div>
          );
        }

        return (
          <div
            key={item.bookingCode}
            className="card"
            style={{
              padding: '18px 20px',
              background: 'var(--amber-soft, #FFFBEB)',
              border: '1px solid #FDE68A',
              borderRadius: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#B45309' }}>
                <Clock size={19} aria-hidden="true" />
                <h4 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#92400E' }}>
                  ⏳ Sắp quyết toán ca {item.bookingCode}
                </h4>
              </div>

              <span
                style={{
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '14px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontVariantNumeric: 'tabular-nums',
                  border: '1px solid #FDE68A',
                }}
              >
                Còn {countdown}
              </span>
            </div>

            <p style={{ margin: '8px 0 4px', fontSize: '14.5px', color: '#78350F', lineHeight: 1.5 }}>
              Dự kiến quyết toán <b>+{formatVND(item.netAmount)}</b> vào ví khả dụng sau thời gian làm nguội 24 giờ.
            </p>

            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px dashed #FCD34D',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                fontSize: '13.5px',
                color: '#92400E',
              }}
            >
              <span>Dịch vụ: <b>{item.serviceName}</b></span>
              <span>Tổng thu: {formatVND(item.grossAmount)}</span>
              <span>Hoa hồng sàn (15%): -{formatVND(item.commissionAmount)}</span>
              <span>Thực nhận: <b>{formatVND(item.netAmount)}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
