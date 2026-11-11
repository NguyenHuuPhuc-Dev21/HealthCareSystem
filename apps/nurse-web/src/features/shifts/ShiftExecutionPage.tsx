import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lock,
} from 'lucide-react';
import { ShiftExecutionState } from './shift.types';
import { getShiftExecutionState } from './shift.api';
import { VitalSignsForm } from './components/VitalSignsForm';
import { CareActivitiesChecklist } from './components/CareActivitiesChecklist';
import { ShiftExtensionBanner } from './components/ShiftExtensionBanner';
import { InitialAssessmentModal } from './components/InitialAssessmentModal';
import { InvalidPrescriptionModal } from './components/InvalidPrescriptionModal';
import { CheckOutReportModal } from './components/CheckOutReportModal';
import { SosEmergencyButton } from './components/SosEmergencyButton';
import {
  ExecutionStatus,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
} from '@healthcare-system/shared';

export const ShiftExecutionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [shift, setShift] = useState<ShiftExecutionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showRejectPrescriptionModal, setShowRejectPrescriptionModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchState() {
      if (!id) return;
      setLoading(true);
      const res = await getShiftExecutionState(id);
      if (res.success && res.data) {
        setShift(res.data);
        setError(null);
      } else {
        setError(res.message || 'Không thể tải thông tin ca trực.');
      }
      setLoading(false);
    }
    fetchState();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ fontSize: 18, color: 'var(--ink-secondary)' }}>Đang tải không gian thực thi ca trực...</p>
      </div>
    );
  }

  if (!shift) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="ledger-panel" style={{ padding: 30, textAlign: 'center' }}>
          <h3 style={{ color: 'var(--ink-primary)' }}>Không tìm thấy ca trực</h3>
          <p style={{ color: 'var(--ink-secondary)' }}>{error || 'Ca trực không tồn tại hoặc đã kết thúc.'}</p>
          <Link to="/jobs" className="btn btn-primary" style={{ marginTop: 14 }}>
            Về Bảng việc làm
          </Link>
        </div>
      </div>
    );
  }

  // If shift is completed
  if (shift.executionStatus === ExecutionStatus.COMPLETED) {
    return (
      <div style={{ maxWidth: 680, margin: '32px auto' }}>
        <div className="ledger-panel" style={{ padding: '36px 32px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'var(--brand-jade-soft)',
              color: 'var(--brand-jade)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h1 className="font-display" style={{ color: 'var(--ink-primary)', fontSize: 26, margin: '0 0 8px', fontWeight: 700 }}>
            Ca làm việc đã hoàn tất
          </h1>
          <p style={{ color: 'var(--ink-secondary)', fontSize: 16, margin: '0 0 24px' }}>
            Đơn {shift.bookingCode} — Người bệnh: {shift.patientName}
          </p>

          <div
            style={{
              textAlign: 'left',
              background: 'var(--surface-canvas)',
              borderRadius: 12,
              padding: '18px 20px',
              border: '1px solid var(--border-hairline)',
              marginBottom: 24,
            }}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: 15.5, color: 'var(--ink-primary)' }}>
              Các mốc thời gian hệ thống đã kích hoạt:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="var(--brand-jade)" />
                <span>
                  <strong>Quyết toán thù lao:</strong> Tự động giải ngân sau <strong>{DEFAULT_SETTLEMENT_COOLING_HOURS} giờ</strong> nếu không có khiếu nại (hoặc sớm hơn khi người nhà xác nhận).
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={16} color="var(--accent-ochre)" />
                <span>
                  <strong>Bảo mật hồ sơ y tế:</strong> Quyền truy cập bệnh án của bạn sẽ tự động đóng sau <strong>{DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ</strong> theo quy định bảo mật dữ liệu cá nhân.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="var(--brand-jade)" />
                <span>
                  <strong>Đánh giá 2 chiều:</strong> Cổng đánh giá với gia đình người bệnh đã mở.
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/shifts" className="btn btn-secondary" style={{ minWidth: 160 }}>
              Danh sách ca của tôi
            </Link>
            <Link to="/" className="btn btn-primary" style={{ minWidth: 160 }}>
              Về Trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If shift is cancelled
  if (shift.executionStatus === ExecutionStatus.CANCELLED) {
    return (
      <div style={{ maxWidth: 640, margin: '32px auto' }}>
        <div className="ledger-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <AlertTriangle size={48} color="var(--alert-crimson)" style={{ margin: '0 auto 14px' }} />
          <h2 className="font-display" style={{ color: 'var(--ink-primary)', margin: '0 0 8px' }}>Ca trực đã dừng an toàn</h2>
          <p className="prose-limit" style={{ color: 'var(--ink-secondary)', fontSize: 15.5, margin: '0 auto' }}>
            Ca trực {shift.bookingCode} đã được ghi nhận dừng theo quy trình bảo vệ an toàn lâm sàng. Điều dưỡng không bị phạt ký quỹ và không bị trừ điểm tin cậy.
          </p>
          <Link to="/jobs" className="btn btn-primary" style={{ marginTop: 18 }}>
            Về Bảng việc làm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation back */}
      <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          to="/shifts"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 14 }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Về danh sách ca của tôi
        </Link>
        <Link
          to={`/shifts/${shift.bookingId}`}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 14 }}
        >
          Xem hồ sơ chi tiết
        </Link>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            background: 'var(--brand-jade-soft)',
            color: 'var(--brand-jade)',
            border: '1px solid #A7D7C5',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 15.5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="page-head">
        <div>
          <h1>{shift.serviceName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <span className="status-pill status-pill--jade">
              Đang thực hiện ({shift.startTime} – {shift.endTime})
            </span>
            <span style={{ color: 'var(--ink-secondary)', fontSize: 15 }}>
              Đơn {shift.bookingCode}
            </span>
            {shift.checkedInAt && (
              <span style={{ color: 'var(--ink-muted)', fontSize: 14 }}>
                Điểm danh lúc {new Date(shift.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary btn-lg"
            type="button"
            style={{ fontSize: 16, height: 50, fontWeight: 700 }}
            onClick={() => setShowCheckOutModal(true)}
          >
            Nộp báo cáo và kết thúc ca
          </button>
        </div>
      </div>

      {/* SOS Emergency Callout Banner */}
      <div style={{ marginBottom: 18 }}>
        <SosEmergencyButton
          bookingId={shift.bookingId}
          latitude={shift.patientLatitude}
          longitude={shift.patientLongitude}
          latestVitals={shift.vitalSigns[0]}
        />
      </div>

      {/* Pending Extension Notification */}
      {shift.pendingExtension && (
        <ShiftExtensionBanner
          bookingId={shift.bookingId}
          pendingExtension={shift.pendingExtension}
          onResponded={(approved) => {
            if (approved) {
              showToast('Đã đồng ý gia hạn ca thêm 1 giờ!');
            } else {
              showToast('Đã từ chối yêu cầu gia hạn ca.');
            }
            getShiftExecutionState(shift.bookingId).then((r) => r.data && setShift(r.data));
          }}
        />
      )}

      {/* 2-Column Clinical Workspace */}
      <div className="cols-2" style={{ gap: 20, alignItems: 'flex-start' }}>
        {/* Left Column: Assessment + Vital Signs + Invalid Prescription Protection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!shift.assessmentCompleted ? (
            <div
              className="ledger-panel"
              style={{
                background: 'var(--accent-ochre-soft)',
                borderColor: '#FCD34D',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={22} color="var(--accent-ochre)" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16.5, color: 'var(--ink-primary)', fontWeight: 700 }}>
                      Đánh giá thể trạng 30 phút đầu ca
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--ink-secondary)' }}>
                      Kiểm tra khả năng vận động, tri giác và đối soát thực tế
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAssessmentModal(true)}
                >
                  Bắt đầu đánh giá
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'var(--brand-jade-soft)',
                color: 'var(--brand-jade)',
                border: '1px solid #A7D7C5',
                fontSize: 14.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={17} />
              <span>
                Đã hoàn thành đánh giá ban đầu 30 phút ({shift.mobilityStatus || 'Bình thường'})
              </span>
            </div>
          )}

            {/* Vital Signs Form & History */}
            <VitalSignsForm
              bookingId={shift.bookingId}
              vitalsList={shift.vitalSigns}
              onVitalsAdded={(newRec) => {
                setShift({ ...shift, vitalSigns: [newRec, ...shift.vitalSigns] });
              }}
            />

            {/* On-Site Invalid Prescription Gate (Tier 2 Invasive only) */}
            {shift.isInvasive && (
              <div className="card" style={{ padding: '18px 20px', border: '1px solid #FECACA' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 15, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={18} />
                  Đối chiếu y lệnh gốc tại chỗ (Bắt buộc)
                </h4>
                <p style={{ fontSize: 13.5, color: 'var(--slate)', margin: '0 0 12px 0' }}>
                  Nếu đơn thuốc bị tẩy xóa, thuốc không trùng khớp hoặc người nhà không có bản gốc:
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-block btn-sm"
                  style={{ height: 42, color: 'var(--red)', borderColor: '#FCA5A5' }}
                  onClick={() => setShowRejectPrescriptionModal(true)}
                >
                  Từ chối ca do y lệnh sai (Không phạt)
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Care Activities & Patient Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Care Activities Checklist */}
            <CareActivitiesChecklist
              bookingId={shift.bookingId}
              activities={shift.careActivities}
              onActivityToggled={(actId, completed) => {
                const next = shift.careActivities.map((a) => (a.id === actId ? { ...a, completed } : a));
                setShift({ ...shift, careActivities: next });
              }}
            />

            {/* Patient & Location Summary Card */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 16, color: 'var(--navy)' }}>
                Thông tin người bệnh
              </h4>
              <div style={{ fontSize: 14.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  Họ tên: <strong style={{ color: 'var(--navy)' }}>{shift.patientName} ({shift.patientAge} tuổi)</strong>
                </div>
                <div>
                  Địa chỉ: <span>{shift.patientAddress}</span>
                </div>
                {shift.checkInDistanceMeters !== undefined && (
                  <div style={{ color: 'var(--teal)', fontSize: 13 }}>
                    ✓ Đã xác thực GPS: cách {shift.checkInDistanceMeters}m khi điểm danh
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showAssessmentModal && (
          <InitialAssessmentModal
            shift={shift}
            onSuccess={(updated) => {
              setShift(updated);
              setShowAssessmentModal(false);
              showToast('Đã lưu đánh giá ban đầu 30 phút thành công!');
            }}
            onClose={() => setShowAssessmentModal(false)}
          />
        )}

        {showRejectPrescriptionModal && (
          <InvalidPrescriptionModal
            bookingId={shift.bookingId}
            bookingCode={shift.bookingCode}
            onSuccess={() => {
              setShowRejectPrescriptionModal(false);
              setShift({ ...shift, executionStatus: ExecutionStatus.CANCELLED });
            }}
            onClose={() => setShowRejectPrescriptionModal(false)}
          />
        )}

        {showCheckOutModal && (
          <CheckOutReportModal
            shift={shift}
            onSuccess={(updated) => {
              setShift(updated);
              setShowCheckOutModal(false);
            }}
            onClose={() => setShowCheckOutModal(false)}
          />
        )}
    </div>
  );
};
export default ShiftExecutionPage;
