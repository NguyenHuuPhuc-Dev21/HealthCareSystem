import React from 'react';
import { Clock, MapPin, User, CreditCard, Lock, Zap, Check } from 'lucide-react';
import { JobItem } from '../job-board.types';

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

  return (
    <div className={`job-card ${isLocked ? 'disabled' : ''}`}>
      <div style={{ flex: 1 }}>
        <h4>
          {job.serviceName}
          {job.isInvasive ? (
            <span className="chip" style={{ marginLeft: 6 }}>
              {isLocked ? <Lock size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : null}
              Xâm lấn · Cấp 2
            </span>
          ) : (
            <span className="chip teal" style={{ marginLeft: 6 }}>
              Không xâm lấn · Cấp 1 & 2
            </span>
          )}

          {job.hasPrescription && (
            <span className="chip teal">
              Có y lệnh
            </span>
          )}

          {(job.urgentBonus ?? 0) > 0 && (
            <span className="chip red">
              <Zap size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              Thưởng nóng +{job.urgentBonus?.toLocaleString('vi-VN')}đ
            </span>
          )}

          {job.serviceType === 'shift' && job.durationHours && (
            <span className="chip" style={{ background: '#F1F5F9' }}>
              Theo ca {job.durationHours} giờ
            </span>
          )}
        </h4>

        {isLocked ? (
          <p style={{ color: 'var(--slate)', marginTop: 8 }}>
            <Lock size={15} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--red)' }} />
            <strong style={{ color: 'var(--navy)' }}>Chỉ dành cho Cấp 2 (GPHN)</strong> — nộp GPHN hợp lệ và được Admin duyệt để mở khóa nhóm dịch vụ xâm lấn này.
          </p>
        ) : (
          <>
            <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 14px', marginTop: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={16} color="var(--teal)" />
                {job.date} · {job.startTime} – {job.endTime}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={16} color="var(--blue)" />
                {job.district} · cách {job.distanceKm} km
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <User size={16} color="var(--slate)" />
                {job.patientName}, {job.patientAge} tuổi
              </span>
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span className="chip teal" style={{ fontSize: 13, padding: '3px 9px' }}>
                <CreditCard size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {job.paymentStatus === 'ESCROW_HELD' ? 'Chuyển khoản · Đã tạm giữ' : 'Tiền mặt'}
              </span>
              {job.note && (
                <span style={{ fontSize: 14, color: 'var(--slate)' }}>
                  {job.note}
                </span>
              )}
            </div>

            <div className="acts">
              <button
                className="btn btn-primary"
                type="button"
                style={{ height: 48, minWidth: 140 }}
                onClick={() => onAccept(job.id)}
                disabled={isAccepting}
              >
                {isAccepting ? 'Đang nhận...' : (
                  <>
                    <Check size={18} style={{ marginRight: 4 }} />
                    Nhận ca này
                  </>
                )}
              </button>
              {onViewDetails && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ height: 48 }}
                  onClick={() => onViewDetails(job)}
                >
                  Xem chi tiết
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 120 }}>
        <span className="pay">{job.totalAmount.toLocaleString('vi-VN')}đ</span>
        {(job.urgentBonus ?? 0) > 0 && (
          <small style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            Đã gồm thưởng nóng
          </small>
        )}
      </div>
    </div>
  );
};
