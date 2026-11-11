import React, { useId, useState } from 'react';
import { CheckCircle2, HeartPulse, FileText } from 'lucide-react';
import { ShiftExecutionState, VitalSignRecord } from '../shift.types';
import { submitCheckOut } from '../shift.api';
import {
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
} from '@healthcare-system/shared';
import { Modal, ModalCloseButton } from '../../../components';

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
    const res = await submitCheckOut({
      bookingId: shift.bookingId,
      checkoutTime: new Date().toISOString(),
      finalVitals,
      completedActivityIds: completedActivities.map((a) => a.id),
      handoverNote,
    });
    setIsSubmitting(false);

    if (res.success && res.data) {
      onSuccess(res.data);
    } else {
      setErrorMessage(res.message || 'Check-out thất bại.');
    }
  };

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
