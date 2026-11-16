import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Info, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { DepositStatusDto } from '@healthcare-system/shared';
import { getDepositStatus, getRefundRequest } from '../features/wallet/deposit.api';
import { DepositRefundStatus } from '@healthcare-system/shared';

const DISMISS_GRACE_KEY = 'carenest_dismiss_grace_banner_session';

export const DepositWarningBanner: React.FC = () => {
  const location = useLocation();
  const [status, setStatus] = useState<DepositStatusDto | null>(null);
  const [hasClosingRequest, setHasClosingRequest] = useState<boolean>(false);
  const [dismissedGrace, setDismissedGrace] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(DISMISS_GRACE_KEY) === 'true';
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([getDepositStatus(), getRefundRequest()])
      .then(([depositRes, refundRes]) => {
        if (cancelled) return;
        if (depositRes.success && depositRes.data) {
          setStatus(depositRes.data);
        }
        if (
          refundRes.success &&
          refundRes.data &&
          refundRes.data.status !== DepositRefundStatus.CANCELLED
        ) {
          setHasClosingRequest(true);
        } else {
          setHasClosingRequest(false);
        }
      })
      .catch(() => {
        // ignore background fetch error
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!status) return null;

  // Dạng 3: Có yêu cầu đóng tài khoản đang mở
  if (hasClosingRequest) {
    return (
      <div
        role="alert"
        style={{
          background: '#475569',
          color: '#ffffff',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: '14.5px',
          fontWeight: 600,
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        }}
      >
        <Info size={18} color="#94A3B8" />
        <span>Bạn đã gửi yêu cầu ngừng hợp tác và hiện không nhận ca mới.</span>
        <Link
          to="/wallet/deposit"
          style={{
            color: '#F8FAFC',
            textDecoration: 'underline',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Xem tiến độ hoàn ký quỹ</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  // Dạng 1: canAcceptTransfer === false (hết ân hạn mà còn thiếu, hoặc đang nợ)
  if (!status.canAcceptTransfer && status.shortfall > 0) {
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
          gap: 12,
          fontSize: '14.5px',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
        }}
      >
        <ShieldAlert size={19} color="#FECACA" />
        <span>Chưa đủ ký quỹ — bạn chưa thể nhận thêm ca mới trên hệ thống.</span>
        <Link
          to="/wallet/deposit"
          style={{
            color: '#ffffff',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Nạp ngay</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  // Dạng 2: grace.active (Đang ân hạn, chỉ nhận ca chuyển khoản)
  if (status.grace.active && !dismissedGrace) {
    const remainingShifts = Math.max(0, status.grace.maxShifts - status.grace.shiftsUsed);

    const handleDismiss = () => {
      setDismissedGrace(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(DISMISS_GRACE_KEY, 'true');
      }
    };

    return (
      <div
        role="status"
        style={{
          background: '#0284C7',
          color: '#ffffff',
          padding: '9px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: '14px',
          fontWeight: 600,
          position: 'relative',
        }}
      >
        <Sparkles size={17} color="#BAE6FD" />
        <span>
          Giai đoạn làm quen: Bạn còn <b>{remainingShifts} ca chuyển khoản</b> (hệ thống trích 30% vào ký quỹ).
        </span>
        <Link
          to="/wallet/deposit"
          style={{
            color: '#ffffff',
            textDecoration: 'underline',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Xem chi tiết</span>
          <ArrowRight size={13} />
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            color: '#BAE6FD',
            display: 'grid',
            placeItems: 'center',
          }}
          aria-label="Ẩn thông báo"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return null;
};
