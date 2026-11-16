import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, Lock, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react';
import type { WalletSummaryDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';

export interface BalanceCardsProps {
  summary: WalletSummaryDto;
}

export const BalanceCards: React.FC<BalanceCardsProps> = ({ summary }) => {
  const { availableBalance, escrowLockedBalance, depositBalance, minDeposit, depositGraceActive } =
    summary;

  const isDepositSufficient = depositBalance >= minDeposit;

  // Xác định trạng thái và màu sắc cho thẻ Ký quỹ
  let depositClass = 'seg locked';
  if (!isDepositSufficient && !depositGraceActive) {
    depositClass = 'seg warning';
  } else if (depositGraceActive) {
    depositClass = 'seg grace';
  }

  return (
    <div className="wallet-card" role="region" aria-label="Ba ngăn số dư ví">
      {/* 1. Số dư khả dụng */}
      <div className="seg">
        <div>
          <small>
            <Wallet size={16} aria-hidden="true" />
            Khả dụng
          </small>
          <div className="amt" style={{ color: 'var(--brand-jade, #166B58)' }}>
            {formatVND(availableBalance)}
          </div>
          <p>Rút được về ngân hàng bất cứ lúc nào qua mục Rút tiền.</p>
        </div>
        <div style={{ marginTop: 14 }}>
          <Link
            to="/wallet/withdraw"
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '15px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
              borderRadius: 10,
            }}
          >
            <span>Rút tiền</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* 2. Đang tạm giữ */}
      <div className="seg locked">
        <div>
          <small>
            <Clock size={16} aria-hidden="true" />
            Đang tạm giữ
          </small>
          <div className="amt">{formatVND(escrowLockedBalance)}</div>
          <p>Tiền ca chuyển khoản khách đã trả trước, chờ quyết toán sau ca.</p>
        </div>
        <div style={{ marginTop: 14, fontSize: '13.5px', color: 'var(--text-secondary, #64748B)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Lock size={14} aria-hidden="true" />
            Bảo đảm trong tài khoản Escrow
          </span>
        </div>
      </div>

      {/* 3. Ký quỹ */}
      <div className={depositClass}>
        <div>
          <small>
            {isDepositSufficient ? (
              <ShieldCheck size={16} color="var(--brand-jade, #166B58)" aria-hidden="true" />
            ) : depositGraceActive ? (
              <ShieldCheck size={16} color="#0284C7" aria-hidden="true" />
            ) : (
              <ShieldAlert size={16} color="#D97706" aria-hidden="true" />
            )}
            Ký quỹ
          </small>
          <div className="amt">{formatVND(depositBalance)}</div>

          {/* Dòng trạng thái theo quy tắc ADR-0004 & W01 */}
          {!isDepositSufficient && !depositGraceActive && (
            <div style={{ marginTop: 8 }}>
              <p style={{ color: '#B45309', fontWeight: 700, margin: 0 }}>
                Chưa đủ ký quỹ — bạn chưa thể nhận ca mới
              </p>
              <p style={{ fontSize: '13.5px', marginTop: 4, color: '#92400E' }}>
                Yêu cầu tối thiểu {formatVND(minDeposit)} để đảm bảo cam kết SLA.
              </p>
            </div>
          )}

          {depositGraceActive && (
            <div style={{ marginTop: 8 }}>
              <p style={{ color: '#0369A1', fontWeight: 700, margin: 0 }}>
                Đang làm quen — chỉ nhận ca chuyển khoản
              </p>
              <p style={{ fontSize: '13.5px', marginTop: 4, color: '#075985' }}>
                Đang ân hạn (ADR-0004): Hệ thống tự trích 30% mỗi ca chuyển khoản cho đến khi đủ {formatVND(minDeposit)}.
              </p>
            </div>
          )}

          {isDepositSufficient && (
            <p>Đã đủ mức yêu cầu · Chỉ dùng trừ phạt vi phạm cam kết dịch vụ (SLA).</p>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          {!isDepositSufficient && !depositGraceActive ? (
            <Link
              to="/wallet/deposit"
              className="btn btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: '15px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                borderRadius: 10,
                background: '#D97706',
                borderColor: '#D97706',
              }}
            >
              <span>Nạp ký quỹ ngay</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <Link
              to="/wallet/deposit"
              style={{
                fontSize: '14px',
                color: 'var(--brand-jade, #166B58)',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Chi tiết ký quỹ & lưu ký</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
