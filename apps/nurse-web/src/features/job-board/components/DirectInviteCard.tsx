import React, { useState, useEffect } from 'react';
import { Target, Clock, Check, X } from 'lucide-react';
import { DirectInvitation } from '../job-board.types';

interface DirectInviteCardProps {
  invite: DirectInvitation;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
  isProcessing?: boolean;
}

export const DirectInviteCard: React.FC<DirectInviteCardProps> = ({
  invite,
  onAccept,
  onDecline,
  isProcessing = false,
}) => {
  const initialSeconds = invite.expiresInSeconds ?? 900; // default 15 mins
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

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
