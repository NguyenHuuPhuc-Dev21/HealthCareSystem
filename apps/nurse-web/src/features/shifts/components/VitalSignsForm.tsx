import React, { useState } from 'react';
import { HeartPulse, Plus, AlertTriangle, Clock } from 'lucide-react';
import { VitalSignRecord } from '../shift.types';
import { addVitalSigns } from '../shift.api';

interface VitalSignsFormProps {
  bookingId: string;
  vitalsList: VitalSignRecord[];
  onVitalsAdded: (newRecord: VitalSignRecord) => void;
}

export const VitalSignsForm: React.FC<VitalSignsFormProps> = ({
  bookingId,
  vitalsList,
  onVitalsAdded,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [heartRate, setHeartRate] = useState<number>(78);
  const [bpSystolic, setBpSystolic] = useState<number>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(80);
  const [temperature, setTemperature] = useState<number>(36.8);
  const [spo2, setSpo2] = useState<number>(98);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(18);
  const [glucose, setGlucose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Clinical Alert Checker
  const checkWarnings = (hr: number, sys: number, dia: number, temp: number, sp: number) => {
    const warnings: string[] = [];
    if (hr < 50 || hr > 120) warnings.push(`Nhịp tim ${hr} bpm ngoài ngưỡng bình thường (50-120)`);
    if (sys >= 140 || dia >= 90) warnings.push(`Huyết áp cao (${sys}/${dia} mmHg)`);
    if (sys < 90 || dia < 60) warnings.push(`Huyết áp thấp (${sys}/${dia} mmHg)`);
    if (temp >= 38.5) warnings.push(`Sốt cao (${temp}°C)`);
    if (temp < 35.5) warnings.push(`Hạ thân nhiệt (${temp}°C)`);
    if (sp < 95) warnings.push(`SpO2 tụt thấp (${sp}%)`);
    return warnings;
  };

  const currentWarnings = checkWarnings(heartRate, bpSystolic, bpDiastolic, temperature, spo2);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const newRecord: VitalSignRecord = {
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      heartRate,
      bloodPressureSystolic: bpSystolic,
      bloodPressureDiastolic: bpDiastolic,
      temperature,
      spo2,
      respiratoryRate: respiratoryRate || undefined,
      bloodGlucose: glucose ? Number(glucose) : undefined,
      notes: notes || undefined,
    };

    const res = await addVitalSigns({ bookingId, vitals: newRecord });
    setIsSubmitting(false);

    if (res.success) {
      onVitalsAdded(newRecord);
      setShowAddForm(false);
      setNotes('');
      setFeedback('✓ Đã lưu chỉ số sinh tồn và đồng bộ thời gian thực');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeartPulse size={20} color="var(--red)" />
          Nhật ký chỉ số sinh tồn (Vital Signs)
        </h3>
        {!showAddForm && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddForm(true)}
            style={{ fontSize: 14 }}
          >
            <Plus size={16} style={{ marginRight: 4 }} /> Đo mới
          </button>
        )}
      </div>

      {feedback && (
        <div style={{ padding: '8px 12px', background: '#DEF7EC', color: '#03543F', borderRadius: 8, fontSize: 14, marginBottom: 12 }}>
          {feedback}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleSave}
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'var(--mint)',
            border: '1px solid #A7F3D0',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Mạch (bpm)</label>
              <input
                type="number"
                className="input"
                style={{ width: '100%', height: 42, fontSize: 16, fontWeight: 700 }}
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Huyết áp (mmHg)</label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%', height: 42, fontSize: 15, fontWeight: 700 }}
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(Number(e.target.value))}
                  required
                />
                <span>/</span>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%', height: 42, fontSize: 15, fontWeight: 700 }}
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Thân nhiệt (°C)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                style={{ width: '100%', height: 42, fontSize: 16, fontWeight: 700 }}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>SpO2 (%)</label>
              <input
                type="number"
                className="input"
                style={{ width: '100%', height: 42, fontSize: 16, fontWeight: 700 }}
                value={spo2}
                onChange={(e) => setSpo2(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Nhịp thở (lần/phút)</label>
              <input
                type="number"
                className="input"
                style={{ width: '100%', height: 42, fontSize: 16, fontWeight: 700 }}
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--slate)', display: 'block', marginBottom: 2 }}>Đường huyết (mmol/L)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                style={{ width: '100%', height: 42, fontSize: 16, fontWeight: 700 }}
                value={glucose}
                placeholder="Tùy chọn"
                onChange={(e) => setGlucose(e.target.value)}
              />
            </div>
          </div>

          {currentWarnings.length > 0 && (
            <div style={{ padding: '8px 12px', background: '#FEF3C7', color: '#92400E', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Cảnh báo chỉ số sinh lý:
              </div>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {currentWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <input
            type="text"
            className="input"
            style={{ width: '100%', height: 40, marginBottom: 12, fontSize: 13.5 }}
            placeholder="Ghi chú lâm sàng kèm theo (ví dụ: đo sau khi uống thuốc 15 phút)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddForm(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu chỉ số sinh tồn'}
            </button>
          </div>
        </form>
      )}

      {/* Vitals History List */}
      {vitalsList.length === 0 ? (
        <p style={{ color: 'var(--slate)', fontSize: 14, margin: 0, fontStyle: 'italic' }}>
          Chưa ghi nhận chỉ số sinh tồn nào trong ca. Hãy bấm "Đo mới" để ghi nhận.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vitalsList.map((item, index) => {
            const warnings = checkWarnings(
              item.heartRate,
              item.bloodPressureSystolic,
              item.bloodPressureDiastolic,
              item.temperature,
              item.spo2
            );
            const hasWarning = warnings.length > 0;

            return (
              <div
                key={index}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: hasWarning ? '#FEF2F2' : '#F8FAFC',
                  border: `1px solid ${hasWarning ? '#FECACA' : 'var(--line)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={14} color="var(--slate)" /> {item.timestamp}
                    {index === 0 && <span className="chip teal" style={{ fontSize: 11, padding: '1px 6px' }}>Mới nhất</span>}
                  </span>
                  {hasWarning && (
                    <span className="chip red" style={{ fontSize: 11, padding: '1px 8px' }}>
                      Cần lưu ý
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 13.5 }}>
                  <div>Mạch: <strong>{item.heartRate}</strong> bpm</div>
                  <div>HA: <strong>{item.bloodPressureSystolic}/{item.bloodPressureDiastolic}</strong> mmHg</div>
                  <div>Nhiệt độ: <strong>{item.temperature}</strong>°C</div>
                  <div>SpO2: <strong style={{ color: item.spo2 < 95 ? 'var(--red)' : 'inherit' }}>{item.spo2}%</strong></div>
                </div>

                {item.notes && (
                  <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                    "{item.notes}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
