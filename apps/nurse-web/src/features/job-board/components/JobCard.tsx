import React from 'react';
import { Check, CreditCard, Lock, MapPin, User, Zap } from 'lucide-react';
import { JobItem } from '../job-board.types';
import { DEFAULT_PLATFORM_COMMISSION_RATE } from '@healthcare-system/shared';

interface JobCardProps {
  job: JobItem;
  onAccept: (jobId: string) => void;
  onViewDetails?: (job: JobItem) => void;
  isAccepting?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onAccept,
  onViewDetails,
  isAccepting = false,
}) => {
  const isLocked = !!job.isLockedForTier1;
  const netEarnings =
    job.netAmount ?? Math.round(job.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE));

  return (
    <div className={`job-strip ${isLocked ? 'is-locked' : ''}`}>
      {/* Cột 1: Thời gian & Khoảng cách */}
      <div className="job-strip__time">
        <div className="tabular-nums" style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-primary)' }}>
          {job.startTime} – {job.endTime}
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-secondary)', marginTop: 2 }}>
          {job.date}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--brand-jade)', fontWeight: 600, marginTop: 8 }}>
          <MapPin size={14} style={{ flexShrink: 0 }} />
          <span>{job.district} (cách {job.distanceKm} km)</span>
        </div>
      </div>

      {/* Cột 2: Dịch vụ, Yêu cầu chuyên môn & Bệnh nhân */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span className={`status-pill ${job.isInvasive ? 'status-pill--neutral' : 'status-pill--jade'}`}>
            {isLocked && <Lock size={13} />}
            {job.isInvasive ? 'Thủ thuật Cấp 2' : 'Chăm sóc cơ bản'}
          </span>

          {job.hasPrescription && (
            <span className="status-pill status-pill--jade">Có y lệnh kèm theo</span>
          )}

          {(job.urgentBonus ?? 0) > 0 && (
            <span className="status-pill status-pill--crimson">
              <Zap size={13} />
              Thưởng thêm {job.urgentBonus?.toLocaleString('vi-VN')} đ
            </span>
          )}
        </div>

        <h4 style={{ margin: '0 0 6px', fontSize: 18.5, fontWeight: 700, color: 'var(--ink-primary)', lineHeight: 1.35 }}>
          {job.serviceName}
        </h4>

        {isLocked ? (
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
            Cần hồ sơ Cấp 2 đã duyệt Giấy phép hành nghề để nhận nhóm thủ thuật xâm lấn.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14.5, color: 'var(--ink-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <User size={15} color="var(--ink-muted)" />
                Người bệnh: <strong style={{ color: 'var(--ink-primary)' }}>{job.patientName}</strong> ({job.patientAge} tuổi)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CreditCard size={15} color="var(--brand-jade)" />
                {job.paymentStatus === 'ESCROW_HELD' ? 'Đã tạm giữ thanh toán' : 'Thu tiền mặt tại nhà'}
              </span>
            </div>
            {job.note && (
              <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 2 }}>
                Ghi chú: {job.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cột 3: Thù lao & Hành động */}
      <div className="job-strip__pay">
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-secondary)' }}>Thực nhận dự kiến</div>
          <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-primary)', lineHeight: 1.2 }}>
            {netEarnings.toLocaleString('vi-VN')} đ
          </div>
          <div className="tabular-nums" style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Tổng đơn {job.totalAmount.toLocaleString('vi-VN')} đ
          </div>
        </div>

        {!isLocked && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onViewDetails && (
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => onViewDetails(job)}
              >
                Chi tiết
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => onAccept(job.id)}
              disabled={isAccepting}
            >
              {isAccepting ? 'Đang nhận...' : (
                <>
                  <Check size={16} />
                  Nhận ca
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
