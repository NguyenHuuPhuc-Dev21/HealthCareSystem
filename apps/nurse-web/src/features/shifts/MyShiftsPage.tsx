import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Calendar, Clock, MapPin, ShieldAlert } from 'lucide-react';
import { ExecutionStatus, DEFAULT_PLATFORM_COMMISSION_RATE } from '@healthcare-system/shared';
import { getMyShifts } from './shift.api';
import { ShiftExecutionState } from './shift.types';

function statusMeta(status: ExecutionStatus): { label: string; tone: 'jade' | 'ochre' | 'crimson' | 'neutral' } {
  switch (status) {
    case ExecutionStatus.IN_PROGRESS:
      return { label: 'Đang thực hiện', tone: 'jade' };
    case ExecutionStatus.CONFIRMED:
      return { label: 'Sắp diễn ra', tone: 'ochre' };
    case ExecutionStatus.COMPLETED:
      return { label: 'Đã hoàn thành', tone: 'neutral' };
    case ExecutionStatus.CANCELLED:
      return { label: 'Đã dừng', tone: 'crimson' };
    default:
      return { label: 'Chờ xử lý', tone: 'neutral' };
  }
}

export const MyShiftsPage: React.FC = () => {
  const [shifts, setShifts] = useState<ShiftExecutionState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyShifts().then((res) => {
      if (alive && res.success) {
        setShifts(res.data);
      }
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ca trực của tôi</h1>
          <p>Theo dõi các ca đang phụ trách, điểm danh tại nhà người bệnh và hoàn tất báo cáo bàn giao.</p>
        </div>
        <Link to="/jobs" className="btn btn-secondary btn-sm">
          Tìm thêm ca mới
        </Link>
      </div>

      {loading ? (
        <div className="ledger-panel" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--ink-secondary)' }}>
          Đang tải danh sách ca trực của bạn...
        </div>
      ) : shifts.length === 0 ? (
        <div className="ledger-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Calendar size={32} color="var(--ink-muted)" style={{ margin: '0 auto 12px' }} />
          <h2 className="font-display" style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--ink-primary)' }}>
            Chưa có ca trực nào được nhận
          </h2>
          <p className="prose-limit" style={{ margin: '0 auto 20px', color: 'var(--ink-secondary)' }}>
            Hãy ghé Bảng việc làm để chọn ca chăm sóc phù hợp với chuyên môn và lịch rảnh của bạn.
          </p>
          <Link to="/jobs" className="btn btn-primary">
            Mở Bảng việc làm
          </Link>
        </div>
      ) : (
        <div>
          {shifts.map((shift) => {
            const meta = statusMeta(shift.executionStatus);
            const isInProgress = shift.executionStatus === ExecutionStatus.IN_PROGRESS;
            const netEstimate = Math.round(shift.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE));

            return (
              <div
                key={shift.bookingId}
                className="job-strip"
                style={isInProgress ? { borderColor: 'var(--brand-jade)', borderWidth: '1.5px' } : undefined}
              >
                <div className="job-strip__time">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span className={`status-pill status-pill--${meta.tone}`}>{meta.label}</span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-primary)' }}>
                    {shift.startTime} – {shift.endTime}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 2 }}>
                    Mã đơn {shift.bookingCode}
                  </div>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 18.5, fontWeight: 700, color: 'var(--ink-primary)' }}>
                    {shift.serviceName}
                  </h3>
                  <div style={{ fontSize: 15.5, color: 'var(--ink-secondary)', marginBottom: 4 }}>
                    Người bệnh: <strong style={{ color: 'var(--ink-primary)' }}>{shift.patientName}</strong> ({shift.patientAge} tuổi)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, color: 'var(--ink-secondary)' }}>
                    <MapPin size={15} color="var(--brand-jade)" style={{ flexShrink: 0 }} />
                    <span>{shift.patientAddress}</span>
                  </div>
                  {shift.isInvasive && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--accent-ochre)', fontWeight: 600 }}>
                      <ShieldAlert size={15} />
                      Yêu cầu đối chiếu y lệnh gốc tại nhà
                    </div>
                  )}
                </div>

                <div className="job-strip__pay">
                  <div style={{ fontSize: 13.5, color: 'var(--ink-secondary)' }}>Thực nhận dự kiến</div>
                  <div className="tabular-nums" style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink-primary)' }}>
                    {netEstimate.toLocaleString('vi-VN')} đ
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {isInProgress ? (
                      <Link to={`/shifts/${shift.bookingId}/execute`} className="btn btn-primary btn-sm">
                        <Activity size={16} />
                        Mở bảng điều hành ca
                      </Link>
                    ) : (
                      <Link to={`/shifts/${shift.bookingId}`} className="btn btn-primary btn-sm">
                        <Clock size={16} />
                        Chi tiết và điểm danh
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

