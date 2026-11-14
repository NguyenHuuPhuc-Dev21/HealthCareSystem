import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  PlayCircle,
  User,
} from 'lucide-react';
import { ExecutionStatus } from '@healthcare-system/shared';
import type { ShiftExecutionState } from '../../shifts/shift.types';

export interface DailyTimelineProps {
  shifts: ShiftExecutionState[];
  loading?: boolean;
}

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ shifts, loading = false }) => {
  // Sort shifts by start time
  const sortedShifts = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const todayFormatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <section className="timeline-section" aria-label="Nhịp làm việc hôm nay">
      <div className="timeline-section__head">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--brand-jade)',
              marginBottom: 4,
            }}
          >
            <Activity size={16} aria-hidden="true" />
            <span>LỊCH TRÌNH LÂM SÀNG</span>
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--ink-primary)' }}>
            Nhịp làm việc hôm nay
          </h2>
        </div>
        <span
          className="chip grey"
          style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999 }}
        >
          {todayFormatted}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-secondary)' }}>
          <Clock size={28} style={{ opacity: 0.4, marginBottom: 8 }} aria-hidden="true" />
          <div>Đang tải nhịp làm việc hôm nay...</div>
        </div>
      ) : sortedShifts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 20px',
            background: 'var(--surface-canvas)',
            borderRadius: 12,
            border: '1px dashed var(--border-hairline)',
          }}
        >
          <Calendar size={36} style={{ color: 'var(--ink-muted)', marginBottom: 10 }} aria-hidden="true" />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--ink-primary)' }}>
            Chưa có ca trực nào trong ngày
          </h3>
          <p
            style={{
              fontSize: 14.5,
              color: 'var(--ink-secondary)',
              margin: '0 auto 16px',
              maxWidth: 480,
              lineHeight: 1.45,
            }}
          >
            Lịch rảnh của bạn đang sẵn sàng. Hãy xem các ca mới đang cần điều dưỡng gần bạn hoặc kiểm tra lại lịch rảnh để hệ thống gợi ý ca phù hợp.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/jobs" className="btn btn-primary btn-sm">
              Tìm việc trên Job Board
            </Link>
            <Link to="/schedule" className="btn btn-secondary btn-sm">
              Xem lịch rảnh
            </Link>
          </div>
        </div>
      ) : (
        <div className="timeline-track">
          {sortedShifts.map((shift, index) => {
            const isInProgress = shift.executionStatus === ExecutionStatus.IN_PROGRESS;
            const isCompleted = shift.executionStatus === ExecutionStatus.COMPLETED;
            const isConfirmed = shift.executionStatus === ExecutionStatus.CONFIRMED;

            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              shift.patientAddress
            )}`;

            return (
              <React.Fragment key={shift.bookingId}>
                <div className="timeline-node">
                  {/* Timeline Dot */}
                  <div
                    className={`timeline-dot ${isInProgress ? 'timeline-dot--active' : ''}`}
                    title={
                      isInProgress
                        ? 'Ca đang diễn ra'
                        : isCompleted
                        ? 'Ca đã hoàn tất'
                        : 'Ca sắp diễn ra'
                    }
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={18} />
                    ) : isInProgress ? (
                      <PlayCircle size={18} />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Shift Card */}
                  <div
                    className={`timeline-card ${isInProgress ? 'timeline-card--active' : ''}`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 4,
                          }}
                        >
                          <span
                            className="status-pill status-pill--jade tabular-nums"
                            style={{ fontSize: 13, fontWeight: 700, padding: '2px 8px' }}
                          >
                            {shift.startTime} – {shift.endTime}
                          </span>
                          <span
                            className={`status-pill ${
                              isInProgress
                                ? 'status-pill--ochre'
                                : isCompleted
                                ? 'status-pill--jade'
                                : 'status-pill--neutral'
                            }`}
                            style={{ fontSize: 12.5 }}
                          >
                            {isInProgress
                              ? 'Đang thực hiện'
                              : isCompleted
                              ? 'Đã hoàn tất'
                              : 'Đã lên lịch'}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                            Mã: {shift.bookingCode}
                          </span>
                        </div>

                        <h3
                          style={{
                            fontSize: 16.5,
                            fontWeight: 700,
                            color: 'var(--ink-primary)',
                            margin: '4px 0 2px',
                          }}
                        >
                          {shift.serviceName}
                        </h3>
                      </div>

                      <div className="tabular-nums" style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: 16.5,
                            fontWeight: 700,
                            color: 'var(--brand-jade)',
                          }}
                        >
                          {shift.totalAmount.toLocaleString('vi-VN')} đ
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
                          {shift.scheduledHours} giờ chăm sóc
                        </div>
                      </div>
                    </div>

                    {/* Patient & Address */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 8,
                        fontSize: 14,
                        color: 'var(--ink-secondary)',
                        margin: '10px 0 14px',
                        padding: '10px 12px',
                        background: 'var(--surface-canvas)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={15} style={{ flexShrink: 0, color: 'var(--brand-jade)' }} />
                        <span>
                          Người bệnh:{' '}
                          <b style={{ color: 'var(--ink-primary)' }}>
                            {shift.patientName} ({shift.patientAge} tuổi)
                          </b>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={15} style={{ flexShrink: 0, color: 'var(--brand-jade)' }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shift.patientAddress}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {isInProgress ? (
                        <Link
                          to={`/shifts/${shift.bookingId}/execute`}
                          className="btn btn-primary btn-sm"
                        >
                          <Activity size={15} />
                          Bảng điều hành ca trực
                        </Link>
                      ) : isConfirmed ? (
                        <Link
                          to={`/shifts/${shift.bookingId}`}
                          className="btn btn-primary btn-sm"
                        >
                          Điểm danh & Vào ca
                        </Link>
                      ) : (
                        <Link
                          to={`/shifts/${shift.bookingId}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Xem hồ sơ ca
                        </Link>
                      )}

                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 13 }}
                      >
                        <ExternalLink size={13} />
                        Chỉ đường Maps
                      </a>
                    </div>
                  </div>
                </div>

                {/* 60-Minute Travel Buffer Indicator between shifts */}
                {index < sortedShifts.length - 1 && (
                  <div className="timeline-buffer" role="note" aria-label="Khoảng đệm di chuyển">
                    <Car size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
                    <div>
                      <b>Khoảng đệm di chuyển 60 phút (SRS §5.1)</b> — Nghỉ ngơi, chuẩn bị vô khuẩn
                      và di chuyển an toàn giữa 2 ca trực.
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
};
