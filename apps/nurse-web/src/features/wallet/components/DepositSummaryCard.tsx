import React, { useState } from 'react';
import { Building2, CheckCircle2, PlusCircle, Shield, ShieldAlert } from 'lucide-react';
import type { DepositStatusDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';

export interface DepositSummaryCardProps {
  status: DepositStatusDto;
  onTopupClick: (amount: number) => void;
  creatingTopup?: boolean;
}

export const DepositSummaryCard: React.FC<DepositSummaryCardProps> = ({
  status,
  onTopupClick,
  creatingTopup = false,
}) => {
  const { depositBalance, minDeposit, shortfall, custodyPartnerName } = status;
  const isSufficient = depositBalance >= minDeposit;
  const isDebt = depositBalance < 0;

  // Percentage for progress bar (clamped 0 to 100)
  const percent = Math.min(100, Math.max(0, Math.round((depositBalance / minDeposit) * 100)));

  // Input amount state, default to shortfall
  const [inputAmount, setInputAmount] = useState<string>(shortfall > 0 ? String(shortfall) : '');
  const parsedAmount = parseInt(inputAmount.replace(/\D/g, ''), 10) || 0;

  const isExceeding = parsedAmount > shortfall;
  const isBelowMin = parsedAmount < 10000 && parsedAmount > 0;
  const isValidAmount = parsedAmount >= 10000 && parsedAmount <= shortfall;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setInputAmount(raw);
  };

  const handleQuickSelect = (amt: number) => {
    setInputAmount(String(Math.min(amt, shortfall)));
  };

  return (
    <div className="card" style={{ padding: '24px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isSufficient ? 'var(--brand-jade-soft, #E6F4F1)' : '#FEF3C7',
                display: 'grid',
                placeItems: 'center',
                color: isSufficient ? 'var(--brand-jade, #166B58)' : '#D97706',
              }}
            >
              <Shield size={20} />
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: 0 }}>
              Ký quỹ điều dưỡng
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '14.5px', color: 'var(--text-secondary, #64748B)' }}>
            Cam kết chất lượng dịch vụ theo chuẩn SLA · Giữ nguyên mức {formatVND(minDeposit)}
          </p>
        </div>

        <div>
          {isSufficient ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#DCFCE7',
                color: '#15803D',
                fontSize: '14.5px',
                fontWeight: 800,
              }}
            >
              <CheckCircle2 size={16} />
              Đã đủ {formatVND(minDeposit)}
            </span>
          ) : isDebt ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#FEE2E2',
                color: '#B91C1C',
                fontSize: '14.5px',
                fontWeight: 800,
              }}
            >
              <ShieldAlert size={16} />
              Đang nợ {formatVND(Math.abs(depositBalance))}
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#FEF3C7',
                color: '#B45309',
                fontSize: '14.5px',
                fontWeight: 800,
              }}
            >
              <ShieldAlert size={16} />
              Còn thiếu {formatVND(shortfall)}
            </span>
          )}
        </div>
      </div>

      {/* Số dư và thanh tiến độ */}
      <div style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--navy, #0F172A)' }}>
              {formatVND(depositBalance)}
            </span>
            <span style={{ fontSize: '16px', color: 'var(--text-secondary, #64748B)', fontWeight: 600 }}>
              / {formatVND(minDeposit)}
            </span>
          </div>

          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy, #0F172A)' }}>
            {percent}%
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: 'var(--surface-subtle, #E2E8F0)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              background: isSufficient
                ? 'var(--brand-jade, #166B58)'
                : isDebt
                ? '#DC2626'
                : 'linear-gradient(90deg, #F59E0B, #166B58)',
              borderRadius: 999,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Thông tin đối tác lưu ký D1 (ADR-0004) */}
      <div
        style={{
          marginTop: 18,
          padding: '12px 16px',
          background: 'var(--surface-subtle, #F8FAFC)',
          border: '1px solid var(--border-hairline, #E2E8F0)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: '14px',
          color: 'var(--text-secondary, #64748B)',
          lineHeight: 1.5,
        }}
      >
        <Building2 size={18} color="var(--brand-jade, #166B58)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <b style={{ color: 'var(--navy, #0F172A)' }}>Lưu ký minh bạch:</b> Tiền ký quỹ được giữ tại{' '}
          <span style={{ color: 'var(--brand-jade, #166B58)', fontWeight: 700 }}>
            {custodyPartnerName || 'Ngân hàng đối tác'}
          </span>
          , không nằm trong tài khoản vận hành của CareNest. Nền tảng chỉ quản lý sổ phản ánh và đối soát định kỳ.
        </div>
      </div>

      {/* Khối nạp thêm ký quỹ (chỉ hiện khi shortfall > 0) */}
      {shortfall > 0 && (
        <div
          style={{
            marginTop: 22,
            paddingTop: 20,
            borderTop: '1px dashed var(--border-hairline, #E2E8F0)',
          }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy, #0F172A)', margin: '0 0 8px' }}>
            Nạp bổ sung ký quỹ qua VietQR
          </h3>
          <p style={{ fontSize: '14.5px', color: 'var(--text-secondary, #64748B)', margin: '0 0 14px' }}>
            Bạn có thể nạp nốt phần còn thiếu bất kỳ lúc nào để đủ chuẩn nhận mọi loại ca (kể cả ca tiền mặt).
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
              <input
                type="text"
                className="input"
                value={parsedAmount > 0 ? parsedAmount.toLocaleString('vi-VN') : ''}
                onChange={handleAmountChange}
                placeholder={`Nhập số tiền (tối đa ${shortfall.toLocaleString('vi-VN')} đ)`}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  borderRadius: 10,
                  borderColor: isExceeding ? '#DC2626' : undefined,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--text-secondary, #64748B)',
                  pointerEvents: 'none',
                }}
              >
                VNĐ
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onTopupClick(parsedAmount)}
              disabled={!isValidAmount || creatingTopup}
              style={{
                minHeight: 48,
                padding: '0 24px',
                fontSize: '15.5px',
                fontWeight: 800,
                borderRadius: 10,
              }}
            >
              <PlusCircle size={18} />
              <span>{creatingTopup ? 'Đang tạo mã...' : 'Tạo mã nạp VietQR'}</span>
            </button>
          </div>

          {/* Gợi ý số tiền nhanh */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)' }}>Gợi ý:</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleQuickSelect(shortfall)}
              style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 6 }}
            >
              Nạp đủ phần thiếu ({formatVND(shortfall)})
            </button>
            {shortfall > 50000 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleQuickSelect(50000)}
                style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 6 }}
              >
                50.000 đ
              </button>
            )}
            {shortfall > 100000 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleQuickSelect(100000)}
                style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 6 }}
              >
                100.000 đ
              </button>
            )}
          </div>

          {/* Cảnh báo khi vượt quá số còn thiếu */}
          {isExceeding && (
            <p style={{ color: '#DC2626', fontSize: '14px', fontWeight: 700, margin: '8px 0 0' }}>
              ⚠️ Ký quỹ chỉ cần đủ {formatVND(minDeposit)} (số tiền nạp tối đa là {formatVND(shortfall)}).
            </p>
          )}

          {isBelowMin && (
            <p style={{ color: '#D97706', fontSize: '14px', fontWeight: 600, margin: '8px 0 0' }}>
              ⚠️ Số tiền nạp tối thiểu là 10.000 đ.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
