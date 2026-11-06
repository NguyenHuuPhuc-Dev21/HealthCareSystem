import React, { useState, useEffect } from 'react';
import { Radio, MapPin, Clock, CreditCard, Zap, Check, X } from 'lucide-react';
import { RadarJob } from '../job-board.types';

interface RadarModalProps {
  radarJob: RadarJob;
  onAccept: (jobId: string) => void;
  onDismiss: (jobId: string) => void;
  isProcessing?: boolean;
}

export const RadarModal: React.FC<RadarModalProps> = ({
  radarJob,
  onAccept,
  onDismiss,
  isProcessing = false,
}) => {
  const initialSeconds = radarJob.expiresInSeconds ?? 45;
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const totalSeconds = initialSeconds || 45;

  useEffect(() => {
    if (secondsLeft <= 0) {
      onDismiss(radarJob.id);
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss(radarJob.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onDismiss, radarJob.id]);

  const percentage = Math.max(0, (secondsLeft / totalSeconds) * 100);
  const ringGradient = `conic-gradient(var(--red) 0% ${percentage}%, #DCEBE3 ${percentage}% 100%)`;

  return (
    <div className="radar-modal-overlay" role="dialog" aria-modal="true">
      <div className="phone-frame">
        <div className="phone-inner">
          {/* Radar Animation Area */}
          <div className="radar-zone">
            <span className="ring" style={{ width: 90, height: 90 }} />
            <span className="ring" style={{ width: 170, height: 170 }} />
            <span className="ring" style={{ width: 250, height: 250 }} />
            <span className="me" />
            <span className="job-dot" title="Vị trí ca">
              <MapPin size={28} color="#EF4444" fill="#EF4444" />
            </span>
            <span
              className="chip"
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: 'rgba(255,255,255,0.95)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                zIndex: 5,
              }}
            >
              <Radio size={16} color="var(--teal)" />
              Radar · Ca mới gần bạn
            </span>
          </div>

          {/* Job Details Area */}
          <div style={{ padding: '20px 22px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="chip">
                  {radarJob.isInvasive ? 'Xâm lấn · Cấp 2' : 'Không xâm lấn · Cấp 1 & 2'}
                </span>
                {radarJob.hasPrescription && (
                  <span className="chip teal">Có y lệnh</span>
                )}
                {radarJob.urgentBonus && radarJob.urgentBonus > 0 && (
                  <span className="chip red">
                    <Zap size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                    Ca gấp
                  </span>
                )}
              </div>

              <h2 style={{ color: 'var(--navy)', fontSize: 22, marginTop: 10, marginBottom: 4, fontWeight: 800 }}>
                {radarJob.serviceName}
              </h2>

              <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--navy)', lineHeight: 1.15 }}>
                {radarJob.totalAmount.toLocaleString('vi-VN')}đ
              </div>

              {radarJob.urgentBonus && radarJob.urgentBonus > 0 && (
                <div style={{ marginTop: 4 }}>
                  <span className="chip red" style={{ fontSize: 13, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={13} />
                    Thưởng nóng +{radarJob.urgentBonus.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}

              <p style={{ color: 'var(--slate)', fontSize: 15, marginTop: 8, marginBottom: 0, lineHeight: 1.45 }}>
                {radarJob.patientName}, {radarJob.patientAge} tuổi — {radarJob.district} · cách {radarJob.distanceKm} km
                <br />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Clock size={15} color="var(--teal)" />
                  {radarJob.date} · {radarJob.startTime} – {radarJob.endTime}
                </span>
              </p>

              <div style={{ marginTop: 8 }}>
                <span className="chip teal" style={{ fontSize: 13, padding: '4px 10px' }}>
                  <CreditCard size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {radarJob.paymentStatus === 'ESCROW_HELD' ? 'Chuyển khoản · Đã tạm giữ' : 'Tiền mặt'}
                </span>
              </div>
            </div>

            {/* 45s Countdown Circular Indicator */}
            <div style={{ margin: '18px 0 10px', textAlign: 'center' }}>
              <div className="count-ring" style={{ background: ringGradient }}>
                <span className="in">
                  00:{secondsLeft.toString().padStart(2, '0')}
                </span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                Thời gian phản hồi còn lại ({secondsLeft}s)
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary"
                type="button"
                style={{
                  height: 58,
                  fontSize: 18,
                  fontWeight: 800,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onClick={() => onAccept(radarJob.id)}
                disabled={isProcessing}
              >
                <Check size={22} />
                {isProcessing ? 'ĐANG NHẬN...' : 'NHẬN CA NGAY'}
              </button>

              <button
                className="btn btn-secondary"
                type="button"
                style={{
                  height: 48,
                  fontSize: 16,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onClick={() => onDismiss(radarJob.id)}
                disabled={isProcessing}
              >
                <X size={18} />
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
