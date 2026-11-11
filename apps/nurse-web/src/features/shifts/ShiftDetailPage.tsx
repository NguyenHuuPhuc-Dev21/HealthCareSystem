import React, { useId, useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  FileText,
  Phone,
  MessageSquare,
  AlertTriangle,
  CreditCard,
  Lock,
  Check,
  Navigation,
} from 'lucide-react';
import { getJobById, acceptJob } from '../job-board/job-board.api';
import { JobItem } from '../job-board/job-board.types';
import { CheckInModal } from './components/CheckInModal';
import { InvalidPrescriptionModal } from './components/InvalidPrescriptionModal';
import { getShiftExecutionState } from './shift.api';
import { ShiftExecutionState } from './shift.types';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK_AUTH } from '../../lib/mock-flags';
import { Modal, ModalCloseButton } from '../../components';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  DEFAULT_CANCELLATION_PENALTY_RATE,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
} from '@healthcare-system/shared';

export const ShiftDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();

  const nurseTier = session?.profile?.tier || 'TIER_1_BASIC';
  const rawDeposit = (session?.profile as any)?.deposit_balance;
  const nurseDeposit =
    typeof rawDeposit === 'number'
      ? rawDeposit
      : USE_MOCK_AUTH
      ? DEFAULT_MIN_NURSE_DEPOSIT_VND
      : 0;

  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [reportedMismatch, setReportedMismatch] = useState(false);
  const [showInvalidRxModal, setShowInvalidRxModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [shiftExecState, setShiftExecState] = useState<ShiftExecutionState | null>(null);
  const [loadingCheckIn, setLoadingCheckIn] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Lý do sức khỏe / việc gia đình đột xuất');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const cancelModalTitleId = useId();
  const cancelBaseId = useId();

  useEffect(() => {
    let alive = true;
    async function loadExecState() {
      if (!id) return;
      try {
        const res = await getShiftExecutionState(id);
        if (alive && res.success && res.data) {
          setShiftExecState(res.data);
        }
      } catch {
        // Handled lazily when nurse opens check-in
      }
    }
    loadExecState();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    async function fetchDetail() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await getJobById(id);
        if (!alive) return;
        if (res.success && res.data) {
          setJob(res.data);
          setError(null);
        } else {
          setJob(null);
          setError(res.message || 'Không tìm thấy ca làm việc. Ca có thể đã bị hủy hoặc không còn khả dụng.');
        }
      } catch {
        if (alive) {
          setJob(null);
          setError('Không thể tải thông tin chi tiết ca trực. Vui lòng thử lại.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleOpenCheckIn = async () => {
    if (shiftExecState) {
      setShowCheckInModal(true);
      return;
    }
    if (!job) return;
    setLoadingCheckIn(true);
    setError(null);
    try {
      const res = await getShiftExecutionState(job.id);
      if (res.success && res.data) {
        setShiftExecState(res.data);
        setShowCheckInModal(true);
      } else {
        setError(res.message || 'Chưa tải được trạng thái điểm danh của ca này. Vui lòng thử lại.');
      }
    } catch {
      setError('Không thể kết nối máy chủ để mở điểm danh. Vui lòng thử lại.');
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const handleAccept = async () => {
    if (!job) return;
    setIsAccepting(true);
    setError(null);
    try {
      const result = await acceptJob(job.id, nurseTier, nurseDeposit);
      if (result.success) {
        setToastMessage(result.message ?? 'Đã nhận ca thành công!');
        setJob({ ...job, status: 'CONFIRMED' });
      } else {
        setError(result.message ?? 'Không thể nhận ca lúc này.');
      }
    } catch {
      setError('Lỗi kết nối khi nhận ca. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      setIsAccepting(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ fontSize: 18, color: 'var(--ink-secondary)' }}>Đang tải thông tin chi tiết ca trực...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        <Link to="/shifts" className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}>
          <ArrowLeft size={16} aria-hidden="true" /> Về danh sách ca của tôi
        </Link>
        <div className="ledger-panel" style={{ padding: 30, textAlign: 'center' }}>
          <h3 style={{ color: 'var(--ink-primary)' }}>Không tìm thấy thông tin ca làm việc</h3>
          <p style={{ color: 'var(--ink-secondary)' }}>Ca này có thể đã được giao hoặc không còn tồn tại trên hệ thống.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <Link to="/shifts" className="btn btn-secondary">
              Về Ca của tôi
            </Link>
            <Link to="/jobs" className="btn btn-primary">
              Về Bảng việc làm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const netEarnings =
    job.netAmount ?? Math.round(job.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE));
  const penaltyPercent =
    job.cancellationPenaltyPercent ?? Math.round(DEFAULT_CANCELLATION_PENALTY_RATE * 100);
  const penaltyAmount = Math.round(job.totalAmount * (penaltyPercent / 100));
  const backPath = job.status === 'MATCHING' ? '/jobs' : '/shifts';
  const backLabel = job.status === 'MATCHING' ? 'Quay lại Bảng việc làm' : 'Về danh sách ca của tôi';

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: 14 }}>
        <Link
          to={backPath}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 14 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Link>
      </div>

        {/* Toast Feedback */}
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
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            <Check size={20} />
            <span>{toastMessage}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: '#FDE8E8',
              color: '#9B1C1C',
              border: '1px solid #F8B4B4',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Page Head matching Screen N5 */}
        <div className="page-head" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{job.serviceName}</h1>
            <p style={{ margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Đơn {job.code}</span> ·
              <span>{job.date} {job.startTime} – {job.endTime}</span> ·
              {job.isInvasive ? (
                <span className="chip" style={{ marginLeft: 4 }}>Xâm lấn · Chỉ Cấp 2</span>
              ) : (
                <span className="chip teal">Không xâm lấn</span>
              )}
              {job.status === 'IN_PROGRESS' || shiftExecState?.executionStatus === 'IN_PROGRESS' ? (
                <span className="chip teal" style={{ fontWeight: 700 }}>● Đang diễn ra</span>
              ) : job.status === 'CONFIRMED' ? (
                <span className="chip teal">Đã xác nhận</span>
              ) : (
                <span className="chip" style={{ background: '#FEF3C7', color: '#92400E' }}>Đang mở nhận</span>
              )}
            </p>
          </div>

          <div>
            {job.status === 'IN_PROGRESS' || shiftExecState?.executionStatus === 'IN_PROGRESS' ? (
              <button
                className="btn btn-primary btn-lg"
                type="button"
                style={{ fontSize: 17, height: 52 }}
                onClick={() => navigate(`/shifts/${job.id}/execute`)}
              >
                Mở bảng điều hành ca trực
              </button>
            ) : job.status === 'CONFIRMED' ? (
              <button
                className="btn btn-primary btn-lg"
                type="button"
                style={{ fontSize: 17, minHeight: 52 }}
                disabled={loadingCheckIn}
                onClick={handleOpenCheckIn}
              >
                {loadingCheckIn ? 'Đang mở điểm danh...' : 'Điểm danh khi tới nơi'}
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg tabular-nums"
                type="button"
                style={{ fontSize: 17, height: 52, minWidth: 180 }}
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? 'Đang nhận...' : `Nhận ca (${job.totalAmount.toLocaleString('vi-VN')} đ)`}
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="cols-2" style={{ gap: 22, alignItems: 'flex-start' }}>
          {/* Left Column: Patient Profile & Prescription */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Patient Card */}
            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <span className="avatar lg" style={{ background: '#E4F2EC', color: 'var(--teal)', fontWeight: 800 }}>
                  {getInitials(job.patientName)}
                </span>
                <div>
                  <h3 style={{ color: 'var(--navy)', fontSize: 19, margin: 0, fontWeight: 800 }}>
                    {job.patientName} · {job.patientAge} tuổi
                  </h3>
                  <p style={{ color: 'var(--slate)', margin: '3px 0 0 0' }}>
                    Vận động: <strong style={{ color: 'var(--navy)' }}>{job.mobilityStatus || 'Hỗ trợ di chuyển'}</strong>
                    {job.patientWeight ? ` · Cân nặng ${job.patientWeight} kg` : ''}
                  </p>
                </div>
              </div>

              <div className="kv">
                <span>Tình trạng</span>
                <b>{job.medicalCondition || job.note || 'Cần chăm sóc y tế tại nhà'}</b>
              </div>
              <div className="kv">
                <span>Tiền sử</span>
                <b>{job.medicalHistory || 'Chưa ghi nhận bệnh nền đặc biệt'}</b>
              </div>
              <div className="kv">
                <span>Dị ứng</span>
                <b style={{ color: 'var(--red)' }}>{job.allergies || 'Không có dị ứng ghi nhận'}</b>
              </div>
              <div className="kv">
                <span>Nguy cơ truyền nhiễm</span>
                <b>{job.contagionRisk || 'Không có'}</b>
              </div>

              <p style={{ marginTop: 14, marginBottom: 0 }}>
                <span className="chip amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={13} />
                  Xem được tới {DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ sau khi kết thúc ca
                </span>
              </p>
            </div>

            {/* Doctor Prescription */}
            <div className="card" style={{ padding: '22px 24px' }}>
              <h3 style={{ color: 'var(--navy)', fontSize: 18, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--blue)" />
                Y lệnh bác sĩ đính kèm
              </h3>
              <p style={{ color: 'var(--slate)', fontSize: 15, marginBottom: 13 }}>
                Ảnh y lệnh do khách tải lên khi đặt ca. Đối chiếu bản gốc tại chỗ trước khi can thiệp.
              </p>

              <div className="upload filled" style={{ textAlign: 'left', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E0EEFF', display: 'grid', placeItems: 'center', color: 'var(--blue)' }}>
                  <FileText size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: 15, color: 'var(--navy)' }}>
                    {job.prescriptionFileName || `ylenh_${job.code.toLowerCase()}.jpg`}
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 13.5, color: 'var(--slate)' }}>
                    Ngày kê đơn: {job.prescriptionPrescribedDate || '26/10/2026'} · Còn trong hạn {job.prescriptionExpiryDays || 7} ngày
                  </p>
                </div>
                <span className="chip teal" style={{ marginLeft: 'auto' }}>Đã đối chiếu sơ bộ ✓</span>
              </div>

              <div style={{ marginTop: 16 }}>
                <b style={{ color: 'var(--navy)' }}>Đối chiếu khi tới nơi (bắt buộc):</b>
                <label className="check-item" style={{ marginTop: 9 }}>
                  <input
                    type="checkbox"
                    checked={check1}
                    onChange={(e) => setCheck1(e.target.checked)}
                  />
                  <span>Thuốc & vật tư khớp với y lệnh giấy bản gốc</span>
                </label>
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={check2}
                    onChange={(e) => setCheck2(e.target.checked)}
                  />
                  <span>Liều lượng và tên bệnh nhân trùng khớp</span>
                </label>
              </div>

              {reportedMismatch ? (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: 'var(--red)', fontSize: 14 }}>
                  ✓ Đã gửi báo cáo y lệnh không khớp tới đội ngũ điều phối và ghi nhận quyền miễn phạt.
                </div>
              ) : (
                <button
                  className="btn btn-secondary btn-block"
                  type="button"
                  style={{ height: 50, color: 'var(--red)', borderColor: '#F3C2C2', marginTop: 12 }}
                  onClick={() => setShowInvalidRxModal(true)}
                >
                  <AlertTriangle size={16} style={{ marginRight: 6 }} />
                  Báo cáo y lệnh không khớp
                </button>
              )}

              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 9, marginBottom: 0 }}>
                Nếu y lệnh giả mạo, hết hạn hoặc thuốc không khớp: ca hủy ngay, bạn <b>không bị phạt</b> và được hỗ trợ chi phí đi lại.
              </p>
            </div>
          </div>

          {/* Right Column: Address, Map, Financials & Cancel Policy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Address */}
            <div className="card" style={{ padding: '22px 24px' }}>
              <h3 style={{ color: 'var(--navy)', fontSize: 18, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={18} color="var(--teal)" />
                Địa chỉ làm ca
              </h3>
              <p style={{ fontSize: 16, margin: '0 0 12px 0' }}>
                <strong style={{ color: 'var(--navy)' }}>
                  {job.fullAddress || `Số 25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng`}
                </strong>
              </p>

              <div className="map-ph" style={{ height: 180 }}>
                <span className="gps-chip">
                  <span className="gps-dot" />
                  Cách bạn {job.distanceKm} km
                </span>
                <div className="pin">
                  <MapPin size={32} color="#DC2626" fill="#DC2626" />
                </div>
                <div className="pin-label">Nhà bệnh nhân {job.patientName}</div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  job.fullAddress || job.district
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-block"
                style={{ minHeight: 48, marginTop: 14 }}
              >
                <Navigation size={16} aria-hidden="true" style={{ marginRight: 6 }} />
                Chỉ đường (Google Maps)
              </a>

              <div className="contact-person-card">
                <div className="contact-person-card__info">
                  <div className="avatar" style={{ background: '#E2E8F0', color: 'var(--navy)' }}>
                    {job.customerName ? getInitials(job.customerName) : 'AN'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: 'var(--navy)', display: 'block', fontSize: 16 }}>
                      {job.customerName || 'Anh Nguyễn Văn An'}
                    </strong>
                    <span style={{ color: 'var(--slate)', fontSize: 14.5, display: 'block', marginTop: 2 }}>
                      Người đặt ca · SĐT: {job.customerPhoneMasked || '0905 ••• 123'}
                    </span>
                  </div>
                </div>
                <div className="contact-person-card__actions">
                  <button className="btn btn-secondary btn-sm" type="button">
                    <MessageSquare size={15} aria-hidden="true" /> Chat
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button">
                    <Phone size={15} aria-hidden="true" /> Gọi
                  </button>
                </div>
              </div>
            </div>

            {/* Financials */}
            <div className="card" style={{ padding: '22px 24px' }}>
              <h3 style={{ color: 'var(--navy)', fontSize: 18, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={18} color="var(--teal)" />
                Chi tiết tiền ca
              </h3>
              <div className="pay-line">
                <span>Giá dịch vụ cơ bản</span>
                <b>{job.baseAmount.toLocaleString('vi-VN')}đ</b>
              </div>
              {(job.urgentBonus ?? 0) > 0 && (
                <div className="pay-line">
                  <span style={{ color: 'var(--red)' }}>Thưởng nóng ca gấp</span>
                  <b style={{ color: 'var(--red)' }}>+{job.urgentBonus?.toLocaleString('vi-VN')}đ</b>
                </div>
              )}
              {(job.nightSurcharge ?? 0) > 0 && (
                <div className="pay-line">
                  <span>Phụ phí ca đêm</span>
                  <b>+{job.nightSurcharge?.toLocaleString('vi-VN')}đ</b>
                </div>
              )}
              <div className="pay-line">
                <span>Hình thức</span>
                <b>{job.paymentStatus === 'ESCROW_HELD' ? 'Chuyển khoản · Đã tạm giữ' : 'Tiền mặt'}</b>
              </div>
              <div className="pay-line total">
                <span>Bạn nhận sau quyết toán</span>
                <span style={{ color: 'var(--teal)' }}>{netEarnings.toLocaleString('vi-VN')}đ</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 9, marginBottom: 0 }}>
                Quyết toán sau khi kết thúc ca {DEFAULT_SETTLEMENT_COOLING_HOURS} giờ nếu không có khiếu nại, hoặc sớm hơn khi khách xác nhận.
              </p>
            </div>

            {/* Cancellation Rule */}
            <div className="card" style={{ padding: '20px 24px', borderColor: '#F3C2C2' }}>
              <h3 style={{ color: 'var(--red)', fontSize: 17, marginBottom: 5 }}>Hủy ca này</h3>
              <p style={{ color: 'var(--slate)', fontSize: 15, margin: 0 }}>
                Hủy bây giờ (trước giờ hẹn trên 12 giờ): <b style={{ color: 'var(--navy)' }}>−5 điểm TrustScore</b>, không phạt tiền.
                <br />
                Hủy trong vòng 12 giờ trước ca: <b style={{ color: 'var(--navy)' }}>−20 điểm TrustScore, trừ {penaltyPercent}% giá trị ca ({penaltyAmount.toLocaleString('vi-VN')}đ) từ ký quỹ</b> — khoản phạt chuyển thành thưởng nóng cho điều dưỡng thay thế.
              </p>
              {cancelNotice ? (
                <div className="alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                  {cancelNotice}
                </div>
              ) : (
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ minHeight: 48, color: 'var(--red)', borderColor: '#F3C2C2', marginTop: 12 }}
                  onClick={() => setShowCancelModal(true)}
                >
                  Yêu cầu hủy ca
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cancel Shift Confirmation Modal */}
        <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} titleId={cancelModalTitleId} maxWidth={500}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 id={cancelModalTitleId} style={{ margin: 0, fontSize: 20, color: 'var(--red)', fontWeight: 800 }}>
              Xác nhận yêu cầu hủy ca
            </h2>
            <ModalCloseButton onClick={() => setShowCancelModal(false)} />
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: 14,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            Hủy ca sau khi đã xác nhận sẽ ảnh hưởng tới <strong>TrustScore (−5 đến −20 điểm)</strong> và có thể bị trừ <strong>{penaltyPercent}% ({penaltyAmount.toLocaleString('vi-VN')}đ)</strong> nếu hủy trong vòng 12 giờ trước giờ hẹn.
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCancelNotice(
                `Đã ghi nhận yêu cầu hủy ca với lý do: "${cancelReason}"${cancelNote.trim() ? ` (${cancelNote.trim()})` : ''}. Đội ngũ điều phối sẽ liên hệ xác nhận.`
              );
              setShowCancelModal(false);
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor={`${cancelBaseId}-reason`}
                style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}
              >
                Lý do hủy ca
              </label>
              <select
                id={`${cancelBaseId}-reason`}
                className="input"
                style={{ width: '100%', minHeight: 48 }}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                <option value="Lý do sức khỏe / việc gia đình đột xuất">Lý do sức khỏe / việc gia đình đột xuất</option>
                <option value="Trùng lịch ca làm việc khác">Trùng lịch ca làm việc khác</option>
                <option value="Khoảng cách di chuyển không phù hợp">Khoảng cách di chuyển không phù hợp</option>
                <option value="Lý do khác">Lý do khác</option>
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor={`${cancelBaseId}-note`}
                style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}
              >
                Ghi chú thêm cho điều phối viên (tùy chọn)
              </label>
              <textarea
                id={`${cancelBaseId}-note`}
                className="input"
                style={{ width: '100%', minHeight: 80, padding: 10, fontSize: 14 }}
                placeholder="Mô tả ngắn để bộ phận điều phối sắp xếp điều dưỡng thay thế..."
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minHeight: 48 }}
                onClick={() => setShowCancelModal(false)}
              >
                Giữ lại ca này
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                style={{ flex: 1, minHeight: 48 }}
              >
                Xác nhận gửi yêu cầu hủy
              </button>
            </div>
          </form>
        </Modal>

        {/* Check-In Modal (Dual check-in: GPS + Camera live capture) */}
        {showCheckInModal && shiftExecState && (
          <CheckInModal
            shift={shiftExecState}
            onSuccess={(updated) => {
              setShowCheckInModal(false);
              setShiftExecState(updated);
              setJob({ ...job, status: 'IN_PROGRESS' });
              navigate(`/shifts/${job.id}/execute`);
            }}
            onClose={() => setShowCheckInModal(false)}
          />
        )}

        {/* Invalid Prescription Report Modal (routes to rejectInvalidPrescription API) */}
        {showInvalidRxModal && (
          <InvalidPrescriptionModal
            bookingId={job.id}
            bookingCode={job.code}
            onSuccess={() => {
              setShowInvalidRxModal(false);
              setReportedMismatch(true);
              setToastMessage('Đã gửi báo cáo y lệnh không khớp và ghi nhận bảo vệ miễn phạt tới hệ thống.');
            }}
            onClose={() => setShowInvalidRxModal(false)}
          />
        )}
    </div>
  );
};
export default ShiftDetailPage;
