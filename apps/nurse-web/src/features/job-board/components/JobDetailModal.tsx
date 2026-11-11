import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  FileText,
  Phone,
  MessageSquare,
  AlertTriangle,
  Check,
  CreditCard,
  Lock,
  Zap,
} from 'lucide-react';
import { JobItem } from '../job-board.types';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_CANCELLATION_PENALTY_RATE,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
} from '@healthcare-system/shared';
import { Modal, ModalCloseButton } from '../../../components';
import { InvalidPrescriptionModal } from '../../shifts/components/InvalidPrescriptionModal';

interface JobDetailModalProps {
  job: JobItem;
  onClose: () => void;
  onAccept?: (jobId: string) => void;
  isAccepting?: boolean;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onAccept,
  isAccepting = false,
}) => {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [reportedMismatch, setReportedMismatch] = useState(false);
  const [showInvalidRxModal, setShowInvalidRxModal] = useState(false);

  // BR-11: Nurse receives net amount from backend snapshot, fallback to config rate
  const netEarnings =
    job.netAmount ?? Math.round(job.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE));
  const penaltyPercent =
    job.cancellationPenaltyPercent ?? Math.round(DEFAULT_CANCELLATION_PENALTY_RATE * 100);
  const penaltyAmount = Math.round(job.totalAmount * (penaltyPercent / 100));

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (showInvalidRxModal) {
    return (
      <InvalidPrescriptionModal
        bookingId={job.id}
        bookingCode={job.code}
        onSuccess={() => {
          setShowInvalidRxModal(false);
          setReportedMismatch(true);
        }}
        onClose={() => setShowInvalidRxModal(false)}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      titleId="job-detail-dialog-title"
      overlayClassName="job-detail-overlay"
      panelClassName="job-detail-dialog elder"
      panelStyle={{ padding: '26px 28px' }}
    >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid var(--line)',
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span className="chip" style={{ background: '#E2E8F0', color: 'var(--navy)', fontWeight: 700 }}>
                Đơn {job.code}
              </span>
              {job.isInvasive ? (
                <span className="chip">Xâm lấn · Chỉ Cấp 2</span>
              ) : (
                <span className="chip teal">Không xâm lấn · Cấp 1 & 2</span>
              )}
              {job.hasPrescription && <span className="chip teal">Có y lệnh</span>}
              {job.status === 'CONFIRMED' ? (
                <span className="chip teal">Đã xác nhận</span>
              ) : (
                <span className="chip" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  Đang mở nhận việc
                </span>
              )}
            </div>

            <h2 id="job-detail-dialog-title" style={{ color: 'var(--navy)', fontSize: 24, margin: '4px 0 6px 0', fontWeight: 800 }}>
              {job.serviceName}
            </h2>

            <p style={{ color: 'var(--slate)', margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={16} color="var(--teal)" />
                {job.date} · {job.startTime} – {job.endTime}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={16} color="var(--blue)" />
                {job.district} · cách {job.distanceKm} km
              </span>
            </p>
          </div>

          <ModalCloseButton onClick={onClose} />
        </div>

        {/* 2-column Grid matching Screen N5 */}
        <div className="cols-2" style={{ gap: 20, alignItems: 'flex-start' }}>
          {/* Column 1: Patient profile & Medical Prescriptions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Patient Card */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <span className="avatar lg" style={{ background: '#E4F2EC', color: 'var(--teal)', fontWeight: 800 }}>
                  {getInitials(job.patientName)}
                </span>
                <div>
                  <h3 style={{ color: 'var(--navy)', fontSize: 19, margin: 0, fontWeight: 800 }}>
                    {job.patientName} · {job.patientAge} tuổi
                  </h3>
                  <p style={{ color: 'var(--slate)', margin: '3px 0 0 0', fontSize: 15 }}>
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
                <b>{job.medicalHistory || 'Chưa ghi nhận bệnh nền phức tạp'}</b>
              </div>
              <div className="kv">
                <span>Dị ứng</span>
                <b style={{ color: 'var(--red)' }}>{job.allergies || 'Chưa có báo cáo dị ứng'}</b>
              </div>
              <div className="kv">
                <span>Nguy cơ truyền nhiễm</span>
                <b>{job.contagionRisk || 'Không có'}</b>
              </div>

              <div style={{ marginTop: 14 }}>
                <span className="chip amber" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Lock size={13} />
                  Bảo mật y tế: Chỉ xem được tới {DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ sau khi kết thúc ca
                </span>
              </div>
            </div>

            {/* Doctor Prescription & Verification Check-list */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 style={{ color: 'var(--navy)', fontSize: 18, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--blue)" />
                Y lệnh bác sĩ đính kèm
              </h3>
              <p style={{ color: 'var(--slate)', fontSize: 15, margin: '0 0 14px 0' }}>
                Ảnh y lệnh do người nhà tải lên khi đặt ca. Điều dưỡng cần đối chiếu kỹ tại chỗ trước khi thực hiện.
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
                <span className="chip teal" style={{ fontSize: 13 }}>Đã duyệt sơ bộ ✓</span>
              </div>

              <div style={{ marginTop: 16 }}>
                <b style={{ color: 'var(--navy)', fontSize: 15 }}>Đối chiếu khi tới nơi (bắt buộc trước khi làm thủ thuật):</b>
                <label className="check-item" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={check1}
                    onChange={(e) => setCheck1(e.target.checked)}
                  />
                  <span>Thuốc & vật tư khớp với y lệnh giấy bản gốc tại nhà bệnh nhân</span>
                </label>
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={check2}
                    onChange={(e) => setCheck2(e.target.checked)}
                  />
                  <span>Liều lượng, đường dùng và họ tên bệnh nhân hoàn toàn trùng khớp</span>
                </label>
              </div>

              {reportedMismatch ? (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: 'var(--red)', fontSize: 14 }}>
                  ✓ Đã ghi nhận báo cáo không khớp y lệnh. Hệ thống sẽ hỗ trợ bạn hủy ca miễn phí và hoàn phí đi lại nếu cần.
                </div>
              ) : (
                <button
                  className="btn btn-secondary btn-block"
                  type="button"
                  style={{ height: 46, color: 'var(--red)', borderColor: '#F3C2C2', marginTop: 12, fontSize: 14.5 }}
                  onClick={() => setShowInvalidRxModal(true)}
                >
                  <AlertTriangle size={16} style={{ marginRight: 6 }} />
                  Báo cáo y lệnh không khớp
                </button>
              )}
            </div>
          </div>

          {/* Column 2: Address, Map, Pricing breakdown, Cancellation Policy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Address & Map */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 style={{ color: 'var(--navy)', fontSize: 18, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={18} color="var(--teal)" />
                Địa chỉ làm ca
              </h3>
              <p style={{ fontSize: 16, color: 'var(--navy)', fontWeight: 700, margin: '0 0 12px 0' }}>
                {job.fullAddress || `Số 25 Quang Trung, Phường Hải Châu 1, Quận Hải Châu, TP. Đà Nẵng`}
              </p>

              <div className="map-ph">
                <span className="gps-chip">
                  <span className="gps-dot" />
                  Cách bạn {job.distanceKm} km
                </span>
                <div className="pin">
                  <MapPin size={32} color="#DC2626" fill="#DC2626" />
                </div>
                <div className="pin-label">Nhà {job.patientName}</div>
              </div>

              <div className="contact-person-card">
                <div className="contact-person-card__info">
                  <div className="avatar" style={{ background: '#E2E8F0', color: 'var(--navy)' }}>
                    {job.customerName ? getInitials(job.customerName) : 'KH'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ color: 'var(--navy)', fontSize: 15.5, display: 'block' }}>
                      {job.customerName || 'Người nhà bệnh nhân'}
                    </b>
                    <div style={{ color: 'var(--slate)', fontSize: 14, marginTop: 2 }}>
                      SĐT: {job.customerPhoneMasked || '0905 ••• 123'} (Bảo mật)
                    </div>
                  </div>
                </div>
                <div className="contact-person-card__actions">
                  <button className="btn btn-secondary btn-sm" type="button">
                    <MessageSquare size={15} aria-hidden="true" />
                    Chat
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button">
                    <Phone size={15} aria-hidden="true" />
                    Gọi
                  </button>
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 style={{ color: 'var(--navy)', fontSize: 18, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={18} color="var(--teal)" />
                Chi tiết thu nhập ca
              </h3>
              <div className="pay-line">
                <span>Giá dịch vụ cơ bản</span>
                <b>{job.baseAmount.toLocaleString('vi-VN')}đ</b>
              </div>
              {(job.urgentBonus ?? 0) > 0 && (
                <div className="pay-line">
                  <span style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={14} /> Thưởng nóng
                  </span>
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
                <span>Hình thức thanh toán</span>
                <b>{job.paymentStatus === 'ESCROW_HELD' ? 'Chuyển khoản · Đã tạm giữ' : 'Tiền mặt'}</b>
              </div>
              <div className="pay-line total">
                <span>Bạn thực nhận sau quyết toán</span>
                <span style={{ color: 'var(--teal)', fontSize: 20 }}>{netEarnings.toLocaleString('vi-VN')}đ</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '8px 0 0 0' }}>
                Tiền tự động quyết toán vào Ví điều dưỡng sau {DEFAULT_SETTLEMENT_COOLING_HOURS} giờ kể từ khi hoàn tất ca, hoặc ngay khi khách hàng bấm xác nhận.
              </p>
            </div>

            {/* Cancellation Policy summary (Screen N5 / BR rules) */}
            <div className="card" style={{ padding: '18px 20px', borderColor: '#F3C2C2', background: '#FFFAFA' }}>
              <h4 style={{ color: 'var(--red)', fontSize: 16, margin: '0 0 4px 0', fontWeight: 700 }}>
                Chính sách cam kết & Hủy ca
              </h4>
              <p style={{ color: 'var(--slate)', fontSize: 14, margin: 0, lineHeight: 1.45 }}>
                • Hủy trước ca &gt; 12 giờ: <strong>−5 điểm TrustScore</strong>, không phạt tiền.<br />
                • Hủy gấp trong vòng 12 giờ: <strong>−20 điểm TrustScore</strong> và <strong>phạt {penaltyPercent}% giá trị ca ({penaltyAmount.toLocaleString('vi-VN')}đ)</strong> trích từ ví ký quỹ để bù thưởng nóng cho điều dưỡng thay thế.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            borderTop: '1px solid var(--line)',
            paddingTop: 18,
            marginTop: 22,
          }}
        >
          <button className="btn btn-secondary btn-lg" type="button" style={{ height: 50 }} onClick={onClose}>
            Đóng
          </button>
          {onAccept && job.status !== 'CONFIRMED' && (
            <button
              className="btn btn-primary btn-lg"
              type="button"
              style={{ height: 50, minWidth: 200 }}
              onClick={() => {
                onAccept(job.id);
                onClose();
              }}
              disabled={isAccepting || job.isLockedForTier1}
            >
              {isAccepting ? 'Đang nhận ca...' : (
                <>
                  <Check size={20} style={{ marginRight: 6 }} />
                  Nhận ca này · {job.totalAmount.toLocaleString('vi-VN')}đ
                </>
              )}
            </button>
          )}
        </div>
    </Modal>
  );
};
export default JobDetailModal;
