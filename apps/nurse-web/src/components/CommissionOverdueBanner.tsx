import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { getCommissionDebts } from '../features/commission-payment/commission-payment.api';
import { getWalletSummary } from '../features/wallet/wallet.api';

export const CommissionOverdueBanner: React.FC = () => {
  const location = useLocation();
  const [hasOverdue, setHasOverdue] = useState<boolean>(false);
  const [overdueCount, setOverdueCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getCommissionDebts(), getWalletSummary()])
      .then(([debtsRes, walletRes]) => {
        if (cancelled) return;

        let overdueFound = false;
        let count = 0;

        if (debtsRes.success && debtsRes.data) {
          const overdues = debtsRes.data.filter((d) => d.status === 'OVERDUE');
          if (overdues.length > 0) {
            overdueFound = true;
            count = overdues.length;
          }
        }

        if (
          walletRes.success &&
          walletRes.data &&
          walletRes.data.suspendedReason === 'COMMISSION_OVERDUE'
        ) {
          overdueFound = true;
        }

        setHasOverdue(overdueFound);
        setOverdueCount(count);
      })
      .catch(() => {
        // ignore background fetch error
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!hasOverdue) return null;

  return (
    <div
      role="alert"
      style={{
        background: '#DC2626',
        color: '#ffffff',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '14.5px',
        fontWeight: 700,
        boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={20} color="#FECACA" aria-hidden="true" />
        <span>
          Quá hạn nộp hoa hồng — tài khoản tạm khóa nhận ca
          {overdueCount > 0 ? ` (${overdueCount} ca quá hạn 24h)` : ''}.
        </span>
      </div>

      <Link
        to="/wallet/commission"
        style={{
          color: '#ffffff',
          background: 'rgba(255, 255, 255, 0.22)',
          padding: '4px 14px',
          borderRadius: 6,
          textDecoration: 'none',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid rgba(255, 255, 255, 0.4)',
        }}
      >
        <span>Nộp ngay</span>
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
};
