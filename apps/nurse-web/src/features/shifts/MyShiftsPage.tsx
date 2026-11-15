import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  ShieldAlert,
  Star,
} from 'lucide-react';
import { ExecutionStatus, DEFAULT_PLATFORM_COMMISSION_RATE } from '@healthcare-system/shared';
import { getMyShifts } from './shift.api';
import { ShiftExecutionState } from './shift.types';
import { getSentReviews } from '../reviews/reviews.api';
import { RateCustomerModal } from '../reviews/components/RateCustomerModal';

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
  const [reviewedBookingCodes, setReviewedBookingCodes] = useState<string[]>([]);
  const [selectedReviewShift, setSelectedReviewShift] = useState<ShiftExecutionState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchShifts = useCallback(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([getMyShifts(), getSentReviews()])
      .then(([shiftsRes, sentRes]) => {
        if (!alive) return;
        if (shiftsRes.success) {
          setShifts(shiftsRes.data);
        } else {
          setLoadError(shiftsRes.message || 'Không thể tải danh sách ca trực. Vui lòng thử lại.');
        }

        if (sentRes.success && sentRes.data) {
          setReviewedBookingCodes(sentRes.data.map((r) => r.bookingCode));
        }
      })
      .catch(() => {
        if (alive) {
          setLoadError('Lỗi kết nối máy chủ. Không thể tải danh sách ca trực của bạn.');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return fetchShifts();
  }, [fetchShifts]);

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

      {/* Toast Alert */}
      {toastMessage && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 10,
            background: 'var(--brand-jade-soft)',
            border: '1.5px solid var(--brand-jade)',
            color: 'var(--brand-jade)',
            fontSize: 14.5,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="ledger-panel" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--ink-secondary)' }}>
          Đang tải danh sách ca trực của bạn...
        </div>
      ) : loadError ? (
        <div className="ledger-panel" role="alert" style={{ textAlign: 'center', padding: '40px 24px', borderColor: '#FECACA', background: '#FFFDFD' }}>
          <AlertTriangle size={32} color="var(--alert-crimson)" style={{ margin: '0 auto 10px' }} />
          <h2 className="font-display" style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--ink-primary)' }}>
            Không thể tải danh sách ca trực
          </h2>
          <p className="prose-limit" style={{ margin: '0 auto 18px', color: 'var(--ink-secondary)' }}>
            {loadError}
          </p>
          <button type="button" className="btn btn-primary" onClick={fetchShifts}>
            Thử lại
          </button>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {isInProgress ? (
                      <Link to={`/shifts/${shift.bookingId}/execute`} className="btn btn-primary btn-sm">
                        <Activity size={16} />
                        Mở bảng điều hành ca
                      </Link>
                    ) : shift.executionStatus === ExecutionStatus.COMPLETED ? (
                      <>
                        {!reviewedBookingCodes.includes(shift.bookingCode) ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedReviewShift(shift)}
                          >
                            <Star size={15} />
                            Đánh giá khách
                          </button>
                        ) : (
                          <span
                            className="status-pill status-pill--jade"
                            style={{
                              fontSize: 12.5,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            Đã đánh giá
                          </span>
                        )}
                        <Link
                          to={`/shifts/${shift.bookingId}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <FileText size={15} />
                          Hồ sơ ca
                        </Link>
                      </>
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

      {/* Modal Đánh giá khách hàng sau ca (W06) */}
      {selectedReviewShift && (
        <RateCustomerModal
          bookingId={selectedReviewShift.bookingId}
          bookingCode={selectedReviewShift.bookingCode}
          customerName={selectedReviewShift.patientName}
          isOpen={true}
          onClose={() => setSelectedReviewShift(null)}
          onSuccess={() => {
            const code = selectedReviewShift.bookingCode;
            setReviewedBookingCodes((prev) => [...prev, code]);
            setSelectedReviewShift(null);
            setToastMessage(
              `Đánh giá ca ${code} đã được gửi! Đánh giá sẽ hiển thị khi khách hàng hoàn tất hoặc sau 7 ngày.`
            );
            setTimeout(() => setToastMessage(null), 5000);
            fetchShifts();
          }}
        />
      )}
    </div>
  );
};

