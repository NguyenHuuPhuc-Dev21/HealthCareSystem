import React, { useState, useEffect } from 'react';
import { Target, Clock, Check, X } from 'lucide-react';
import { DirectInvitation } from '../job-board.types';

interface DirectInviteCardProps {
  invite: DirectInvitation;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
  isProcessing?: boolean;
}

function computeRemainingSeconds(expiresAt?: string, expiresInSeconds?: number): number {
  if (expiresAt) {
    const expiryMs = Date.parse(expiresAt);
    if (!Number.isNaN(expiryMs)) {
      return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
    }
  }
  return Math.max(0, expiresInSeconds ?? 0);
}

export const DirectInviteCard: React.FC<DirectInviteCardProps> = ({
  invite,
  onAccept,
  onDecline,
  isProcessing = false,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    computeRemainingSeconds(invite.expiresAt, invite.expiresInSeconds)
  );

  useEffect(() => {
    const syncRemaining = () => {
      setSecondsLeft(computeRemainingSeconds(invite.expiresAt, invite.expiresInSeconds));
    };
    syncRemaining();

    const interval = setInterval(() => {
      if (invite.expiresAt && !Number.isNaN(Date.parse(invite.expiresAt))) {
        const next = Math.max(0, Math.floor((Date.parse(invite.expiresAt) - Date.now()) / 1000));
        setSecondsLeft(next);
        if (next <= 0) clearInterval(interval);
      } else {
        setSecondsLeft((prev: number) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [invite.bookingId, invite.expiresAt, invite.expiresInSeconds]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = secondsLeft <= 0;

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        border: '2px solid var(--blue)',
        marginBottom: 20,
        backgroundColor: '#F8FBFF',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: '#E0EEFF',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--blue)',
            flexShrink: 0,
          }}
        >
          <Target size={26} />
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ color: 'var(--navy)', fontSize: 19, margin: '0 0 6px 0', fontWeight: 800 }}>
            Khách chọn trực tiếp bạn
          </h3>
          <p style={{ color: 'var(--slate)', margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            {invite.inviterName} mời bạn làm ca{' '}
            <strong style={{ color: 'var(--navy)' }}>
              {invite.serviceName} cho bà/ông {invite.patientName} ({invite.patientAge} tuổi)
            </strong>{' '}
            · {invite.date} {invite.startTime} – {invite.endTime} · {invite.district} · Đơn #{invite.code}
          </p>
        </div>

        <div>
          <span
            className={`chip ${isExpired ? '' : 'red'}`}
            style={{
              fontSize: 15,
              padding: '8px 15px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
            }}
          >
            <Clock size={16} />
            {isExpired ? 'Đã hết hạn' : `Phản hồi trong ${formatTimer(secondsLeft)}`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 11, marginTop: 18, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-lg"
          type="button"
          style={{ flex: 1, minWidth: 220, height: 50, fontSize: 16 }}
          onClick={() => onAccept(invite.bookingId)}
          disabled={isProcessing || isExpired}
        >
          <Check size={18} style={{ marginRight: 6 }} />
          Chấp nhận lời mời · {invite.totalAmount.toLocaleString('vi-VN')}đ
        </button>
        <button
          className="btn btn-secondary btn-lg"
          type="button"
          style={{ minWidth: 140, height: 50, fontSize: 16 }}
          onClick={() => onDecline(invite.bookingId)}
          disabled={isProcessing || isExpired}
        >
          <X size={18} style={{ marginRight: 6 }} />
          Từ chối
        </button>
      </div>
    </div>
  );
};
