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
      <div className="screen-body elder">
        <div className="page" style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 18, color: 'var(--slate)' }}>Đang tải phòng điều hành ca trực...</p>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="screen-body elder">
        <div className="page">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
            <ArrowLeft size={16} style={{ marginRight: 6 }} /> Quay lại
          </button>
          <div className="card" style={{ padding: 30, textAlign: 'center' }}>
            <h3 style={{ color: 'var(--navy)' }}>Không tìm thấy ca trực</h3>
            <p style={{ color: 'var(--slate)' }}>{error || 'Ca trực không tồn tại hoặc đã kết thúc.'}</p>
            <Link to="/jobs" className="btn btn-primary" style={{ marginTop: 14 }}>
              Về Bảng việc làm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If shift is completed
  if (shift.executionStatus === ExecutionStatus.COMPLETED) {
    return (
      <div className="screen-body elder">
        <div className="page" style={{ maxWidth: 700, margin: '40px auto' }}>
          <div className="card" style={{ padding: '36px 30px', textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#DEF7EC',
                color: '#03543F',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h1 style={{ color: 'var(--navy)', fontSize: 24, margin: '0 0 8px 0', fontWeight: 800 }}>
              Ca Làm Việc Đã Hoàn Tất!
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: 16, margin: '0 0 24px 0' }}>
              Đơn {shift.bookingCode} · Bệnh nhân: {shift.patientName}
            </p>

            {/* Countdown Timers Triggered by Check-Out (BR-22 §2.3) */}
            <div
              style={{
                textAlign: 'left',
                background: '#F8FAFC',
                borderRadius: 12,
                padding: '18px 20px',
                border: '1px solid var(--line)',
                marginBottom: 24,
              }}
            >
              <h4 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--navy)' }}>
                Các mốc thời gian hệ thống đã kích hoạt:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color="var(--teal)" />
                  <span>
                    <strong>Quyết toán thù lao:</strong> Tự động giải ngân sau <strong>{DEFAULT_SETTLEMENT_COOLING_HOURS} giờ</strong> nếu không có khiếu nại (hoặc sớm hơn khi người nhà xác nhận).
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={16} color="#D97706" />
                  <span>
                    <strong>Bảo mật Nghị định 13:</strong> Quyền truy cập bệnh án của bạn sẽ tự động đóng sau <strong>{DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ</strong>.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--blue)" />
                  <span>
                    <strong>Đánh giá 2 chiều:</strong> Cổng đánh giá người nhà đã mở (FR-RATE-01).
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link to="/jobs" className="btn btn-secondary" style={{ height: 48, minWidth: 160 }}>
                Về Bảng việc làm
              </Link>
              <Link to="/" className="btn btn-primary" style={{ height: 48, minWidth: 160 }}>
                Về Trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If shift is cancelled
  if (shift.executionStatus === ExecutionStatus.CANCELLED) {
    return (
      <div className="screen-body elder">
        <div className="page" style={{ maxWidth: 640, margin: '40px auto' }}>
          <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
            <AlertTriangle size={48} color="var(--red)" style={{ margin: '0 auto 14px' }} />
            <h2 style={{ color: 'var(--navy)', margin: '0 0 8px 0' }}>Ca Trực Đã Dừng / Bị Hủy</h2>
            <p style={{ color: 'var(--slate)', fontSize: 15 }}>
              Ca trực {shift.bookingCode} đã được ghi nhận dừng theo quy định an toàn (BR-15/BR-16).
              <br />
              Điều dưỡng không bị phạt ký quỹ và không bị trừ điểm TrustScore.
            </p>
            <Link to="/jobs" className="btn btn-primary" style={{ marginTop: 18 }}>
              Về Bảng việc làm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-body elder">
      <div className="page">
        {/* Navigation back */}
        <div style={{ marginBottom: 14 }}>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => navigate(`/jobs/${shift.bookingId}`)}
            style={{ fontSize: 14 }}
          >
            <ArrowLeft size={16} style={{ marginRight: 6 }} /> Quay lại chi tiết đơn
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: '#DEF7EC',
              color: '#03543F',
              border: '1px solid #84E1BC',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={20} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Header */}
        <div className="page-head" style={{ marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{shift.serviceName}</h1>
            <p style={{ margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Đơn {shift.bookingCode}</span> ·
              <span className="chip teal" style={{ fontWeight: 700 }}>
                ● Đang thực hiện ({shift.startTime} – {shift.endTime})
              </span>
              {shift.checkedInAt && (
                <span style={{ color: 'var(--slate)', fontSize: 13.5 }}>
                  Điểm danh lúc {new Date(shift.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary btn-lg"
              type="button"
              style={{ fontSize: 16, height: 50, fontWeight: 700 }}
              onClick={() => setShowCheckOutModal(true)}
            >
              Nộp báo cáo &amp; Check-out →
            </button>
          </div>
        </div>

        {/* SOS Emergency Callout Banner (Always accessible) */}
        <div style={{ marginBottom: 18 }}>
          <SosEmergencyButton
            bookingId={shift.bookingId}
            latitude={shift.patientLatitude}
            longitude={shift.patientLongitude}
            latestVitals={shift.vitalSigns[0]}
          />
        </div>

        {/* Pending Extension Notification (FR-SHIFT-03) */}
        {shift.pendingExtension && (
          <ShiftExtensionBanner
            bookingId={shift.bookingId}
            pendingExtension={shift.pendingExtension}
            onResponded={(approved) => {
              if (approved) {
                showToast('Đã đồng ý gia hạn ca thêm 1 giờ!');
              } else {
                showToast('Đã từ chối gia hạn ca.');
              }
              // Refresh state
              getShiftExecutionState(shift.bookingId).then((r) => r.data && setShift(r.data));
            }}
          />
        )}

        {/* 2-Column Clinical Workspace */}
        <div className="cols-2" style={{ gap: 20, alignItems: 'flex-start' }}>
          {/* Left Column: Assessment + Vital Signs + Invalid Prescription Protection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* 30-min Assessment Callout */}
            {!shift.assessmentCompleted ? (
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  background: '#EFF6FF',
                  border: '1.5px solid #93C5FD',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Clock size={22} color="#2563EB" />
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, color: '#1E40AF', fontWeight: 800 }}>
                        Đánh giá ban đầu trong 30 phút (FR-SHIFT-02)
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#1E3A8A' }}>
                        Bắt buộc kiểm tra vận động, tri giác &amp; đối soát tình trạng thực tế
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ height: 38 }}
                    onClick={() => setShowAssessmentModal(true)}
                  >
                    Bắt đầu đánh giá
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: '#DEF7EC',
                  color: '#03543F',
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} />
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
    </div>
  );
};
export default ShiftExecutionPage;
