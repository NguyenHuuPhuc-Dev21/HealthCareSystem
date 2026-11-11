import React, { useState } from 'react';
import { Clock, X, HeartPulse } from 'lucide-react';
import { ShiftExecutionState, VitalSignRecord } from '../shift.types';
import { submitInitialAssessment } from '../shift.api';
import { MobilityStatus, DEFAULT_SURCHARGE_HEAVY_PATIENT_RATE } from '@healthcare-system/shared';

interface InitialAssessmentModalProps {
  shift: ShiftExecutionState;
  onSuccess: (updated: ShiftExecutionState) => void;
  onClose: () => void;
}

export const InitialAssessmentModal: React.FC<InitialAssessmentModalProps> = ({
  shift,
  onSuccess,
  onClose,
}) => {
  const [mobility, setMobility] = useState<MobilityStatus>(shift.mobilityStatus || MobilityStatus.NORMAL);
  const [mentalStatus, setMentalStatus] = useState<string>('Tỉnh táo, tiếp xúc tốt');
  const [hasMismatch, setHasMismatch] = useState<boolean>(false);
  const [mismatchReason, setMismatchReason] = useState<string>('');
  const [requestedAction, setRequestedAction] = useState<'SURCHARGE' | 'REFUSE'>('SURCHARGE');

  // Initial baseline vital signs
  const [heartRate, setHeartRate] = useState<number>(75);
  const [bpSystolic, setBpSystolic] = useState<number>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(80);
  const [temp, setTemp] = useState<number>(36.6);
  const [spo2, setSpo2] = useState<number>(98);
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (hasMismatch && mismatchReason.trim().length < 5) {
      setErrorMessage('Vui lòng mô tả chi tiết lý do sai lệch tình trạng người bệnh.');
      return;
    }

    const initialVitals: VitalSignRecord = {
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      heartRate,
      bloodPressureSystolic: bpSystolic,
      bloodPressureDiastolic: bpDiastolic,
      temperature: temp,
      spo2,
      notes: notes || 'Chỉ số sinh tồn ban đầu khi tiếp nhận ca',
    };

    setIsSubmitting(true);
    const res = await submitInitialAssessment({
      bookingId: shift.bookingId,
      actualMobility: mobility,
      mentalStatus,
      isConditionMatched: !hasMismatch,
      mismatchReason: hasMismatch ? mismatchReason : undefined,
      requestedAction: hasMismatch ? requestedAction : undefined,
      initialVitals,
    });
    setIsSubmitting(false);

    if (res.success && res.data) {
      onSuccess(res.data);
    } else {
      setErrorMessage(res.message || 'Lưu đánh giá ban đầu thất bại.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 24,
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy)', fontWeight: 800 }}>
              Đánh Giá Ban Đầu & Đối Soát Tình Trạng
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--slate)', fontSize: 13.5 }}>
              Nhiệm vụ bắt buộc trong 30 phút đầu sau check-in (FR-SHIFT-02, BR-07 §2.2)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: 36, height: 36, padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 30-min notice alert */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1E40AF',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Clock size={18} style={{ flexShrink: 0 }} />
          <span>
            Bác sĩ và gia đình sẽ nhận thông báo đối chiếu này ngay lập tức để đồng nhất kế hoạch chăm sóc.
          </span>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: '#FEF2F2',
              color: '#991B1B',
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Initial Vitals */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, color: 'var(--navy)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HeartPulse size={18} color="var(--red)" />
              1. Chỉ số sinh tồn tiếp nhận đầu ca
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                  Mạch (nhịp/phút)
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ height: 44, width: '100%', fontSize: 16, fontWeight: 700 }}
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                  Nhiệt độ (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  style={{ height: 44, width: '100%', fontSize: 16, fontWeight: 700 }}
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                  Huyết áp (Tâm thu / Tâm trương)
                </label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    className="input"
                    style={{ height: 44, width: '100%', fontSize: 16, fontWeight: 700 }}
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(Number(e.target.value))}
                    required
                  />
                  <span>/</span>
                  <input
                    type="number"
                    className="input"
                    style={{ height: 44, width: '100%', fontSize: 16, fontWeight: 700 }}
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ height: 44, width: '100%', fontSize: 16, fontWeight: 700 }}
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                className="input"
                style={{ width: '100%', height: 40, fontSize: 13.5 }}
                placeholder="Ghi chú lâm sàng ban đầu (tùy chọn)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Patient Assessment & Mobility */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, color: 'var(--navy)', margin: '0 0 10px 0' }}>
              2. Khả năng vận động &amp; Tri giác thực tế
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Bình thường', val: MobilityStatus.NORMAL },
                { label: 'Hỗ trợ 1 phần', val: MobilityStatus.PARTIAL },
                { label: 'Nằm liệt giường', val: MobilityStatus.BEDRIDDEN },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setMobility(item.val)}
                  className={`btn btn-sm ${mobility === item.val ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 40, fontSize: 13 }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="input"
              style={{ width: '100%', height: 44 }}
              placeholder="Ghi nhận tri giác (vd: Tỉnh táo, ngủ gà, lú lẫn...)"
              value={mentalStatus}
              onChange={(e) => setMentalStatus(e.target.value)}
            />
          </div>

          {/* Section 3: Condition Mismatch Trigger (BR-16 §2.3) */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: hasMismatch ? '#FFFBEB' : '#F8FAFC',
              border: `1.5px solid ${hasMismatch ? '#FDE68A' : '#E2E8F0'}`,
              marginBottom: 20,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: hasMismatch ? '#92400E' : 'var(--navy)' }}>
              <input
                type="checkbox"
                checked={hasMismatch}
                onChange={(e) => setHasMismatch(e.target.checked)}
              />
              Báo cáo sai lệch tình trạng so với khai báo ban đầu
            </label>

            {hasMismatch && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, color: '#92400E', margin: '0 0 8px 0' }}>
                  Nếu bệnh nhân nặng hơn khai báo (ví dụ liệt giường $\ge 80$kg chưa tính phụ phí), bạn có quyền yêu cầu phụ phí hoặc dừng ca không phạt (BR-16 §2.3).
                </p>

                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="mismatchAction"
                      checked={requestedAction === 'SURCHARGE'}
                      onChange={() => setRequestedAction('SURCHARGE')}
                    />
                    Yêu cầu phụ phí bệnh nhân nặng (+{Math.round(DEFAULT_SURCHARGE_HEAVY_PATIENT_RATE * 100)}%)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer', color: 'var(--red)' }}>
                    <input
                      type="radio"
                      name="mismatchAction"
                      checked={requestedAction === 'REFUSE'}
                      onChange={() => setRequestedAction('REFUSE')}
                    />
                    Dừng ca không bị phạt (Không đủ điều kiện an toàn)
                  </label>
                </div>

                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: 70, padding: 8, fontSize: 14 }}
                  placeholder="Mô tả lý do sai lệch tình trạng cụ thể..."
                  value={mismatchReason}
                  onChange={(e) => setMismatchReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, height: 48 }}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2, height: 48, fontSize: 15, fontWeight: 700 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang gửi đánh giá...' : 'Xác nhận Báo Cáo 30 Phút'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
