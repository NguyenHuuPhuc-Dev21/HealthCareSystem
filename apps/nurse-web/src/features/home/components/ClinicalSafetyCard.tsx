import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, PackageCheck, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'carenest_nurse_gear_checklist_v1';

interface GearItem {
  id: string;
  label: string;
  requiredFor: string;
}

const DEFAULT_GEAR: GearItem[] = [
  { id: 'bp-spo2', label: 'Máy đo huyết áp điện tử & máy đo SpO2', requiredFor: 'Bắt buộc đo sinh tồn đầu ca' },
  { id: 'gloves-gauze', label: 'Găng tay vô trùng & gạc y tế tiệt trùng', requiredFor: 'Quy trình chăm sóc vô khuẩn' },
  { id: 'antiseptic', label: 'Cồn sát khuẩn, cồn đỏ Povidone & NaCl 0.9%', requiredFor: 'Vệ sinh & xử lý vết thương' },
  { id: 'id-card', label: 'Thẻ điều dưỡng CareNest & đồng phục Blouse', requiredFor: 'Nhận diện chuyên môn người nhà' },
];

export const ClinicalSafetyCard: React.FC = () => {
  const [checkedIds, setCheckedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['bp-spo2', 'gloves-gauze'];
    } catch {
      return ['bp-spo2', 'gloves-gauze'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedIds));
    } catch {
      // ignore
    }
  }, [checkedIds]);

  const toggleItem = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetChecklist = () => {
    setCheckedIds([]);
  };

  const isAllReady = checkedIds.length === DEFAULT_GEAR.length;

  return (
    <aside className="ledger-panel" aria-label="Túi y cụ và an toàn lâm sàng">
      <div className="ledger-panel__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PackageCheck size={18} color="var(--brand-jade)" aria-hidden="true" />
          <h3 className="ledger-panel__title">Túi y cụ & Chuẩn bị lâm sàng</h3>
        </div>
        <span
          className={`status-pill ${isAllReady ? 'status-pill--jade' : 'status-pill--ochre'}`}
          style={{ fontSize: 12.5 }}
        >
          {checkedIds.length}/{DEFAULT_GEAR.length} sẵn sàng
        </span>
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', margin: '12px 0 6px' }}>
        Tích chọn các vật tư y tế trong túi trước khi di chuyển đến nhà người bệnh:
      </p>

      <div className="clinical-checklist" role="group" aria-label="Danh sách y cụ">
        {DEFAULT_GEAR.map((item) => {
          const isChecked = checkedIds.includes(item.id);
          return (
            <label
              key={item.id}
              className={`checklist-item ${isChecked ? 'checklist-item--checked' : ''}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={isChecked}
                onChange={() => toggleItem(item.id)}
              />
              <div className="checklist-item__box" aria-hidden="true">
                <Check size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="checklist-item__text">{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                  {item.requiredFor}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          type="button"
          onClick={resetChecklist}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 12.5, minHeight: 30, padding: '2px 8px' }}
        >
          <RotateCcw size={12} />
          Đặt lại túi y cụ
        </button>
      </div>

      {/* Safety Notice Box */}
      <div
        role="note"
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 14px',
          background: 'var(--brand-jade-soft)',
          border: '1px solid rgba(26, 83, 54, 0.2)',
          borderRadius: 10,
          color: 'var(--ink-primary)',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        <AlertCircle size={18} color="var(--brand-jade)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div>
          <b>Nguyên tắc an toàn CareNest:</b> Luôn yêu cầu người nhà cung cấp <b>mã OTP 6 số</b> để
          bắt đầu ca; tuyệt đối không thực hiện thủ thuật xâm lấn ngoài y lệnh bác sĩ đã được duyệt.
        </div>
      </div>
    </aside>
  );
};
