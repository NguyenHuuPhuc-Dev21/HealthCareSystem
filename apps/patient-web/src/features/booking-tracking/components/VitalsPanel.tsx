import { useState } from 'react';
import { Activity, Droplets, HeartPulse, Thermometer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { VitalReading } from '../booking-tracking.types';

const timeOnly = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const fmt = (v: number | null, digits = 0, unit = '') => (v === null ? '—' : `${v.toFixed(digits).replace('.', ',')}${unit}`);
const bp = (r: VitalReading) => (r.systolic !== null && r.diastolic !== null ? `${r.systolic}/${r.diastolic}` : '—');

const VISIBLE_ROWS = 6;

function Tile({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="bt-tile">
      <span className="bt-tile__icon" aria-hidden="true">{icon}</span>
      <span className="bt-tile__label">{label}</span>
      <b>{value}</b>
      <small>{unit}</small>
    </div>
  );
}

/**
 * Sinh hiệu do điều dưỡng ghi trong ca (FR-SHIFT-02): chỉ hiển thị số liệu được ghi nhận,
 * không đánh giá/chẩn đoán. Nếu thấy dấu hiệu nguy hiểm, gọi 115 trước.
 */
export function VitalsPanel({ vitals }: { vitals: VitalReading[] }) {
  const [showAll, setShowAll] = useState(false);
  const latest = vitals[vitals.length - 1];
  const history = [...vitals].reverse();
  const rows = showAll ? history : history.slice(0, VISIBLE_ROWS);

  return (
    <section className="card step-card bt-card" aria-labelledby="bt-vitals">
      <h3 id="bt-vitals" className="step-card__title"><HeartPulse size={18} aria-hidden="true" /> Sinh hiệu</h3>

      {!latest ? (
        <p className="bt-empty">Điều dưỡng sẽ ghi sinh hiệu đầu ca trong 30 phút đầu sau khi check-in.</p>
      ) : (
        <>
          <p className="bt-sub">Lần đo gần nhất · {timeOnly(latest.recordedAt)}</p>
          <div className="bt-tiles">
            <Tile icon={<HeartPulse size={18} />} label="Mạch" value={fmt(latest.pulse)} unit="lần/phút" />
            <Tile icon={<Thermometer size={18} />} label="Nhiệt độ" value={fmt(latest.temperatureC, 1)} unit="°C" />
            <Tile icon={<Activity size={18} />} label="Huyết áp" value={bp(latest)} unit="mmHg" />
            <Tile icon={<Droplets size={18} />} label="SpO₂" value={fmt(latest.spo2)} unit="%" />
          </div>

          <div className="bt-table-wrap">
            <table className="bt-table">
              <caption className="sr-only">Lịch sử sinh hiệu trong ca</caption>
              <thead>
                <tr><th>Giờ</th><th>Mạch</th><th>Nhiệt độ</th><th>Huyết áp</th><th>SpO₂</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{timeOnly(r.recordedAt)}{r.note && <small> · {r.note}</small>}</td>
                    <td>{fmt(r.pulse)}</td>
                    <td>{fmt(r.temperatureC, 1)}</td>
                    <td>{bp(r)}</td>
                    <td>{fmt(r.spo2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length > VISIBLE_ROWS && (
            <button type="button" className="link-button" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Thu gọn' : `Xem tất cả ${history.length} lần đo`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
