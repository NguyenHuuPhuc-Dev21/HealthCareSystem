import React from 'react';
import { TxType } from '@healthcare-system/shared';
import type { WalletTransactionDto } from '@healthcare-system/shared';
import { formatDateTime, formatVND } from '../../../lib/formatters';

export interface TransactionListProps {
  transactions: WalletTransactionDto[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

interface TxMeta {
  icon: string;
  ticClass: string;
  title: string;
  badgeLabel: string;
}

function getTxMeta(tx: WalletTransactionDto): TxMeta {
  switch (tx.type) {
    case TxType.ESCROW_RELEASE:
      return {
        icon: '✅',
        ticClass: 'tic',
        title: tx.bookingCode ? `Quyết toán ca ${tx.bookingCode}` : 'Quyết toán ca làm việc',
        badgeLabel: 'Ví khả dụng',
      };
    case TxType.DEPOSIT_WITHHOLD:
      return {
        icon: '🛡️',
        ticClass: 'tic pending',
        title: tx.bookingCode
          ? `Giữ lại vào ký quỹ (ân hạn) ca ${tx.bookingCode}`
          : 'Giữ lại vào ký quỹ (ân hạn)',
        badgeLabel: 'Ví ký quỹ',
      };
    case TxType.WITHDRAW:
      return {
        icon: '🏦',
        ticClass: 'tic',
        title: 'Rút tiền về ngân hàng',
        badgeLabel: 'Chuyển khoản',
      };
    case TxType.COMMISSION_PAYMENT:
      return {
        icon: '💸',
        ticClass: 'tic pending',
        title: tx.bookingCode
          ? `Nộp hoa hồng ca tiền mặt ${tx.bookingCode}`
          : 'Nộp hoa hồng sàn 15%',
        badgeLabel: 'Hoa hồng ca',
      };
    case TxType.PENALTY_DEDUCT:
      return {
        icon: '⚠️',
        ticClass: 'tic rejected',
        title: tx.bookingCode ? `Phạt vi phạm SLA ca ${tx.bookingCode}` : 'Phạt trừ ký quỹ SLA',
        badgeLabel: 'Trừ ký quỹ',
      };
    case TxType.PENALTY_REVERSAL:
      return {
        icon: '↩️',
        ticClass: 'tic',
        title: tx.bookingCode
          ? `Hoàn lại khoản phạt ca ${tx.bookingCode}`
          : 'Hoàn lại khoản phạt ký quỹ',
        badgeLabel: 'Cộng ký quỹ',
      };
    case TxType.TOPUP:
      return {
        icon: '🛡️',
        ticClass: 'tic',
        title: 'Nạp ký quỹ qua VietQR',
        badgeLabel: 'Ví ký quỹ',
      };
    case TxType.DEPOSIT_REFUND:
      return {
        icon: '🔄',
        ticClass: 'tic',
        title: 'Hoàn ký quỹ khi đóng tài khoản',
        badgeLabel: 'Chi hoàn',
      };
    default:
      return {
        icon: '📄',
        ticClass: 'tic',
        title: tx.description || 'Giao dịch ví',
        badgeLabel: 'Giao dịch',
      };
  }
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  activeFilter,
  onFilterChange,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) => {
  const filterTabs = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'SETTLE', label: 'Quyết toán' },
    { key: 'PENALTY', label: 'Phạt' },
    { key: 'WITHDRAW', label: 'Rút tiền' },
    { key: 'DEPOSIT', label: 'Ký quỹ' },
  ];

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: 'var(--navy, #0F172A)', fontSize: '18px', margin: 0, fontWeight: 800 }}>
            Lịch sử giao dịch
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)', margin: '4px 0 0' }}>
            Sổ cái minh bạch, ghi nhận liên tục — không sửa, không xóa
          </p>
        </div>
      </div>

      {/* Toolbar bộ lọc loại giao dịch */}
      <div
        className="toolbar"
        style={{
          borderTop: 0,
          padding: '14px 0 12px',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={isActive ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => onFilterChange(tab.key)}
              style={{
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: 8,
                borderWidth: 1,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Danh sách giao dịch */}
      {transactions.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            color: 'var(--text-secondary, #64748B)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: 8 }}>📭</div>
          <p style={{ fontWeight: 700, margin: 0 }}>Chưa có giao dịch nào phù hợp</p>
          <p style={{ fontSize: '14px', margin: '4px 0 0' }}>
            Các biến động số dư khi quyết toán, rút tiền hoặc nạp ký quỹ sẽ hiển thị tại đây.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {transactions.map((tx) => {
            const meta = getTxMeta(tx);
            const isPositive = tx.amount > 0;
            const isNegative = tx.amount < 0;

            return (
              <div key={tx.id} className="tx-row">
                <span className={meta.ticClass} aria-hidden="true">
                  {meta.icon}
                </span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ color: 'var(--navy, #0F172A)', fontSize: '15.5px' }}>{meta.title}</b>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'var(--surface-subtle, #F1F5F9)',
                        color: 'var(--text-secondary, #64748B)',
                      }}
                    >
                      {meta.badgeLabel}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: '4px 0 0',
                      color: 'var(--text-secondary, #64748B)',
                      fontSize: '14px',
                      lineHeight: 1.4,
                    }}
                  >
                    {tx.description}
                  </p>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: '13px',
                      color: 'var(--muted, #94A3B8)',
                    }}
                  >
                    {formatDateTime(tx.createdAt)}
                  </div>
                </div>

                <div
                  className={`amt ${isNegative ? 'neg' : isPositive ? 'pos' : ''}`}
                  style={{
                    fontSize: '17px',
                    fontWeight: 900,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {isPositive && '+'}
                  {formatVND(tx.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nút Xem thêm / Phân trang */}
      {hasMore && (
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              padding: '10px 24px',
              fontSize: '15px',
              fontWeight: 700,
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            {loadingMore ? 'Đang tải thêm...' : 'Xem thêm giao dịch cũ hơn'}
          </button>
        </div>
      )}
    </div>
  );
};
