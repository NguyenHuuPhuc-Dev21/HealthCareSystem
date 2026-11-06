import React, { useState, useEffect } from 'react';
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

export const ShiftDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [reportedMismatch, setReportedMismatch] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      setLoading(true);
      const res = await getJobById(id);
      if (res.success && res.data) {
        setJob(res.data);
      } else {
        // Fallback: create mock display for demo shift codes if not found in active jobs
        setJob({
          id: id,
          code: id.startsWith('HC-') ? id : `HC-2026-${id.slice(-4)}`,
          serviceName: 'Thay băng vết mổ hậu phẫu',
          serviceType: 'procedure',
          requiredTier: 'TIER_2_SPECIALIST',
          isInvasive: true,
          hasPrescription: true,
          prescriptionFileName: 'ylenh_thaybang_1042.jpg',
          prescriptionPrescribedDate: '26/10/2026',
          prescriptionExpiryDays: 7,
          date: 'Hôm nay',
          startTime: '14:30',
          endTime: '15:30',
          district: 'Hải Châu',
          distanceKm: 1.2,
          patientName: 'Bà Nguyễn Thị Hoa',
          patientAge: 78,
          patientWeight: 52,
          mobilityStatus: 'Hỗ trợ di chuyển',
          medicalCondition: 'Sau phẫu thuật thay khớp háng phải (3 tháng)',
          medicalHistory: 'Tăng huyết áp · Đái tháo đường type 2',
          allergies: 'Penicillin (mề đay, khó thở nhẹ)',
          contagionRisk: 'Không có',
          fullAddress: 'Số 25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
          customerName: 'Anh Nguyễn Văn An',
          customerPhoneMasked: '0905 ••• 123',
          note: 'Vết mổ tiến triển tốt, cần thay băng vô khuẩn theo đúng y lệnh.',
          baseAmount: 500000,
          totalAmount: 500000,
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'ESCROW_HELD',
          matchingMode: 'JOB_BOARD',
          status: 'CONFIRMED',
        });
      }
      setLoading(false);
    }
    fetchDetail();
  }, [id]);

  const handleAccept = async () => {
    if (!job) return;
    setIsAccepting(true);
    const result = await acceptJob(job.id, 'TIER_2_SPECIALIST', 300000);
    setIsAccepting(false);
    if (result.success) {
      setToastMessage(result.message ?? 'Đã nhận ca thành công!');
      setJob({ ...job, status: 'CONFIRMED' });
    } else {
      setError(result.message ?? 'Không thể nhận ca lúc này.');
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
      <div className="screen-body elder">
        <div className="page" style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 18, color: 'var(--slate)' }}>Đang tải thông tin chi tiết ca...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="screen-body elder">
        <div className="page">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
            <ArrowLeft size={16} style={{ marginRight: 6 }} /> Quay lại
          </button>
          <div className="card" style={{ padding: 30, textAlign: 'center' }}>
            <h3 style={{ color: 'var(--navy)' }}>Không tìm thấy thông tin ca làm việc</h3>
            <p style={{ color: 'var(--slate)' }}>Ca này có thể đã được giao hoặc không còn tồn tại trên hệ thống.</p>
            <Link to="/jobs" className="btn btn-primary" style={{ marginTop: 14 }}>
              Về Bảng việc làm
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const netEarnings = Math.round(job.totalAmount * 0.85);

  return (
    <div className="screen-body elder">
      <div className="page">
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: 14 }}>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => navigate(-1)}
            style={{ fontSize: 14 }}
          >
            <ArrowLeft size={16} style={{ marginRight: 6 }} />
            Quay lại danh sách
          </button>
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
              {job.status === 'CONFIRMED' ? (
                <span className="chip teal">Đã xác nhận</span>
              ) : (
                <span className="chip" style={{ background: '#FEF3C7', color: '#92400E' }}>Đang mở nhận</span>
              )}
            </p>
          </div>

          <div>
            {job.status === 'CONFIRMED' ? (
              <button
                className="btn btn-primary btn-lg"
                type="button"
                style={{ fontSize: 17, height: 52 }}
                onClick={() => alert(`Chuẩn bị mở Check-in GPS trong bán kính 200m cho đơn ${job.code}`)}
              >
                Check-in khi tới nơi →
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                type="button"
                style={{ fontSize: 17, height: 52, minWidth: 180 }}
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? 'Đang nhận...' : `Nhận ca · ${job.totalAmount.toLocaleString('vi-VN')}đ`}
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
                  Xem được tới 12 giờ sau khi kết thúc ca
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
                  ✓ Đã gửi báo cáo y lệnh không khớp tới đội ngũ điều phối.
                </div>
              ) : (
                <button
                  className="btn btn-secondary btn-block"
                  type="button"
                  style={{ height: 50, color: 'var(--red)', borderColor: '#F3C2C2', marginTop: 12 }}
                  onClick={() => setReportedMismatch(true)}
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

              <button
                className="btn btn-secondary btn-block"
                type="button"
                style={{ height: 48, marginTop: 14 }}
                onClick={() => alert(`Mở bản đồ điều hướng tới: ${job.fullAddress || job.district}`)}
              >
                <Navigation size={16} style={{ marginRight: 6 }} />
                Chỉ đường (Google Maps)
              </button>

              <div style={{ display: 'flex', gap: 13, alignItems: 'center', borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 15 }}>
                <div className="avatar" style={{ background: '#E2E8F0', color: 'var(--navy)' }}>
                  {job.customerName ? getInitials(job.customerName) : 'AN'}
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--navy)' }}>{job.customerName || 'Anh Nguyễn Văn An'}</strong>
                  <br />
                  <span style={{ color: 'var(--slate)', fontSize: 14.5 }}>
                    Người đặt ca · SĐT: {job.customerPhoneMasked || '0905 ••• 123'}
                  </span>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" style={{ height: 42 }}>
                  <MessageSquare size={15} style={{ marginRight: 4 }} /> Chat
                </button>
                <button className="btn btn-secondary btn-sm" type="button" style={{ height: 42 }}>
                  <Phone size={15} style={{ marginRight: 4 }} /> Gọi
                </button>
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
              {job.urgentBonus && job.urgentBonus > 0 && (
                <div className="pay-line">
                  <span style={{ color: 'var(--red)' }}>Thưởng nóng ca gấp</span>
                  <b style={{ color: 'var(--red)' }}>+{job.urgentBonus.toLocaleString('vi-VN')}đ</b>
                </div>
              )}
              {job.nightSurcharge && job.nightSurcharge > 0 && (
                <div className="pay-line">
                  <span>Phụ phí ca đêm</span>
                  <b>+{job.nightSurcharge.toLocaleString('vi-VN')}đ</b>
                </div>
              )}
              <div className="pay-line">
                <span>Hình thức</span>
                <b>{job.paymentStatus === 'ESCROW_HELD' ? 'Chuyển khoản · Đã tạm giữ' : 'Tiền mặt'}</b>
              </div>
              <div className="pay-line total">
                <span>Bạn nhận sau quyết toán (85%)</span>
                <span style={{ color: 'var(--teal)' }}>{netEarnings.toLocaleString('vi-VN')}đ</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 9, marginBottom: 0 }}>
                Quyết toán sau khi kết thúc ca 24 giờ nếu không có khiếu nại, hoặc sớm hơn khi khách xác nhận.
              </p>
            </div>

            {/* Cancellation Rule */}
            <div className="card" style={{ padding: '20px 24px', borderColor: '#F3C2C2' }}>
              <h3 style={{ color: 'var(--red)', fontSize: 17, marginBottom: 5 }}>Hủy ca này</h3>
              <p style={{ color: 'var(--slate)', fontSize: 15, margin: 0 }}>
                Hủy bây giờ (trước giờ hẹn trên 12 giờ): <b style={{ color: 'var(--navy)' }}>−5 điểm TrustScore</b>, không phạt tiền.
                <br />
                Hủy trong vòng 12 giờ trước ca: <b style={{ color: 'var(--navy)' }}>−20 điểm TrustScore, trừ 20% giá trị ca ({Math.round(job.totalAmount * 0.2).toLocaleString('vi-VN')}đ) từ ký quỹ</b> — khoản phạt chuyển thành thưởng nóng cho điều dưỡng thay thế.
              </p>
              <button
                className="btn btn-secondary"
                type="button"
                style={{ height: 48, color: 'var(--red)', borderColor: '#F3C2C2', marginTop: 12 }}
                onClick={() => alert('Yêu cầu hủy ca cần xác nhận lý do và trừ điểm TrustScore theo quy định.')}
              >
                Yêu cầu hủy ca
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ShiftDetailPage;
