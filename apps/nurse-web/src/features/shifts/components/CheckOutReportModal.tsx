import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  QrCode,
} from 'lucide-react';
import { ShiftExecutionState, VitalSignRecord } from '../shift.types';
import { submitCheckOut } from '../shift.api';
import {
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  PaymentMethod,
} from '@healthcare-system/shared';
import { Modal, ModalCloseButton } from '../../../components';
import { formatVND } from '../../../lib/formatters';
import { USE_MOCK_WALLET } from '../../../lib/mock-flags';
import { mockAddCashCommissionDebt } from '../../commission-payment/commission-payment.mock';

interface CheckOutReportModalProps {
  shift: ShiftExecutionState;
  onSuccess: (updated: ShiftExecutionState) => void;
  onClose: () => void;
}

export const CheckOutReportModal: React.FC<CheckOutReportModalProps> = ({
  shift,
  onSuccess,
  onClose,
}) => {
  const navigate = useNavigate();
  const titleId = useId();
  const baseId = useId();
  // Final vital signs defaults from latest recorded or typical
  const latest = shift.vitalSigns[0];
  const [heartRate, setHeartRate] = useState<number>(latest?.heartRate || 76);
  const [bpSystolic, setBpSystolic] = useState<number>(latest?.bloodPressureSystolic || 120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(latest?.bloodPressureDiastolic || 80);
  const [temperature, setTemperature] = useState<number>(latest?.temperature || 36.8);
  const [spo2, setSpo2] = useState<number>(latest?.spo2 || 98);
  const [handoverNote, setHandoverNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cash commission post-checkout flow
  const [completedShift, setCompletedShift] = useState<ShiftExecutionState | null>(null);
  const [showCashPrompt, setShowCashPrompt] = useState(false);

  const isCash =
    shift.paymentMethod === PaymentMethod.CASH ||
    shift.paymentMethod === 'CASH' ||
    (shift as any).payment_method === 'CASH';
  const commissionAmount = Math.floor(shift.totalAmount * 0.15);

  const completedActivities = shift.careActivities.filter((a) => a.completed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Mandatory Minimal Care Report validations (BR-22 §2.2)
    if (!handoverNote || handoverNote.trim().length < 10) {
      setErrorMessage('Bắt buộc phải nhập ghi chú dặn dò/bàn giao tối thiểu 10 ký tự cho gia đình.');
      return;
    }

    const finalVitals: VitalSignRecord = {
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      heartRate,
      bloodPressureSystolic: bpSystolic,
      bloodPressureDiastolic: bpDiastolic,
      temperature,
      spo2,
      notes: 'Chỉ số sinh tồn kết thúc ca trực',
    };

    setIsSubmitting(true);
    try {
      const res = await submitCheckOut({
        bookingId: shift.bookingId,
        checkoutTime: new Date().toISOString(),
        finalVitals,
        completedActivityIds: completedActivities.map((a) => a.id),
        handoverNote,
      });

      if (res.success && res.data) {
        if (isCash) {
          if (USE_MOCK_WALLET) {
            mockAddCashCommissionDebt({
              bookingId: shift.bookingId,
              bookingCode: shift.bookingCode,
              serviceName: shift.serviceName,
              totalAmount: shift.totalAmount,
            });
          }
          setCompletedShift(res.data);
          setShowCashPrompt(true);
        } else {
          onSuccess(res.data);
        }
      } else {
        setErrorMessage(res.message || 'Check-out thất bại.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử nộp báo cáo bàn giao lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Màn hình hoàn tất sau check-out ca tiền mặt (CASH)
  if (showCashPrompt && completedShift) {
    return (
      <Modal open onClose={() => onSuccess(completedShift)} titleId={titleId} maxWidth={540}>
        <div style={{ textAlign: 'center', padding: '10px 6px 16px' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#F0FDF4',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle2 size={36} color="#16A34A" />
          </div>

          <h2
            id={titleId}
            style={{ fontSize: 20, color: 'var(--navy)', fontWeight: 800, margin: '0 0 8px' }}
          >
            Đã Hoàn Tất Check-Out Ca Trực!
          </h2>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: 15,
              lineHeight: 1.6,
              margin: '18px 0',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Banknote size={20} color="#D97706" />
              <strong style={{ fontSize: 15.5 }}>Thu tiền mặt trực tiếp:</strong>
            </div>
            <div>
              Khách trả tiền mặt <b>{formatVND(shift.totalAmount)}</b> — bạn cần nộp{' '}
              <b style={{ color: '#DC2626', fontSize: 16 }}>{formatVND(commissionAmount)}</b> hoa hồng
              (15%) trong 24 giờ.
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#78350F',
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px dashed #FCD34D',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Clock size={14} />
              <span>
                Đồng hồ 24 giờ đã bắt đầu đếm ngược. Quá 24 giờ chưa nộp, tài khoản sẽ tạm bị khóa
                nhận ca mới (BR-05). Hoa hồng không trừ vào tiền ký quỹ.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: 46 }}
              onClick={() => onSuccess(completedShift)}
            >
              Để sau (nộp trong 24h)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                flex: 1,
                minHeight: 46,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onClick={() => {
                onSuccess(completedShift);
                navigate('/wallet/commission');
              }}
            >
              <QrCode size={18} />
              <span>Nộp hoa hồng ngay</span>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} titleId={titleId} maxWidth={580}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 id={titleId} style={{ margin: 0, fontSize: 20, color: 'var(--navy)', fontWeight: 800 }}>
              Nộp Báo Cáo Ca Tối Thiểu &amp; Check-Out
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--slate)', fontSize: 13.5 }}>
              Điều kiện bắt buộc để hoàn tất ca trực (FR-SHIFT-04, BR-22)
            </p>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Legal/System Timer Notification */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1E40AF',
            fontSize: 13.5,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          <strong>Hệ quả sau khi check-out:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li>Kích hoạt đếm ngược {DEFAULT_SETTLEMENT_COOLING_HOURS}h tự động giải ngân thù lao (nếu không có khiếu nại).</li>
            <li>Kích hoạt đếm ngược {DEFAULT_RECORD_ACCESS_EXPIRY_HOURS}h đóng quyền truy cập bệnh án theo Nghị định 13.</li>
            <li>Mở ngay màn hình đánh giá chất lượng 2 chiều.</li>
          </ul>
        </div>

        {/* Ca thanh toán tiền mặt CASH (FR-PAY-01, FR-PAY-02) */}
        {isCash && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: 13.5,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Banknote size={22} color="#D97706" style={{ flexShrink: 0 }} />
            <div>
              <strong>Ca thanh toán tiền mặt:</strong> Khách trả tiền mặt{' '}
              <b>{formatVND(shift.totalAmount)}</b> — bạn cần nộp{' '}
              <b style={{ color: '#DC2626' }}>{formatVND(commissionAmount)}</b> hoa hồng trong 24 giờ.
            </div>
          </div>
        )}

        {errorMessage && (
          <div style={{ padding: 10, borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: 13.5, marginBottom: 14 }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Final Vitals */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, color: 'var(--navy)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HeartPulse size={18} color="var(--red)" />
              1. Chỉ số sinh tồn kết thúc ca (Bắt buộc)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div>
                <label htmlFor={`${baseId}-hr`} style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Mạch (bpm)</label>
                <input
                  id={`${baseId}-hr`}
                  type="number"
                  className="input"
                  style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-temp`} style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Thân nhiệt (°C)</label>
                <input
                  id={`${baseId}-temp`}
                  type="number"
                  step="0.1"
                  className="input"
                  style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-sbp`} style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Huyết áp (mmHg)</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    id={`${baseId}-sbp`}
                    aria-label="Huyết áp tâm thu (mmHg)"
                    type="number"
                    className="input"
                    style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(Number(e.target.value))}
                    required
                  />
                  <span>/</span>
                  <input
                    id={`${baseId}-dbp`}
                    aria-label="Huyết áp tâm trương (mmHg)"
                    type="number"
                    className="input"
                    style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor={`${baseId}-spo2`} style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>SpO2 (%)</label>
                <input
                  id={`${baseId}-spo2`}
                  type="number"
                  className="input"
                  style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Completed tasks confirmation */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, color: 'var(--navy)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={18} color="var(--teal)" />
              2. Các đầu việc đã hoàn tất ({completedActivities.length}/{shift.careActivities.length})
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {completedActivities.map((act) => (
                <span key={act.id} className="chip teal" style={{ fontSize: 12.5 }}>
                  ✓ {act.title}
                </span>
              ))}
            </div>
          </div>

          {/* Section 3: Handover note for family */}
          <div style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 16, color: 'var(--navy)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={18} color="var(--blue)" />
              <label htmlFor={`${baseId}-handover`}>
                3. Ghi chú bàn giao &amp; dặn dò gia đình (Bắt buộc)
              </label>
            </h3>
            <textarea
              id={`${baseId}-handover`}
              className="input"
              style={{ width: '100%', minHeight: 90, padding: 10, fontSize: 14 }}
              placeholder="Ghi nhận tình trạng người bệnh lúc bàn giao, giờ uống thuốc cữ tiếp theo, lưu ý xoay trở hoặc theo dõi đặc biệt..."
              value={handoverNote}
              onChange={(e) => setHandoverNote(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: 48 }}
              onClick={onClose}
            >
              Quay lại ca trực
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2, minHeight: 48, fontSize: 15, fontWeight: 700 }}
              disabled={isSubmitting || !handoverNote || handoverNote.trim().length < 10}
            >
              {isSubmitting ? 'Đang lưu báo cáo...' : 'Nộp Báo Cáo & Hoàn Tất Ca'}
            </button>
          </div>
        </form>
    </Modal>
  );
};
