import { ClipboardList } from 'lucide-react';
import type { CareActivity } from '../booking-tracking.types';

const timeOnly = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Nhật ký chăm sóc điều dưỡng ghi trong ca (`care_activities_log`, FR-SHIFT-02), mới nhất ở trên cùng. */
export function CareLog({ activities }: { activities: CareActivity[] }) {
  const items = [...activities].reverse();

  return (
    <section className="card step-card bt-card" aria-labelledby="bt-log">
      <h3 id="bt-log" className="step-card__title"><ClipboardList size={18} aria-hidden="true" /> Nhật ký chăm sóc</h3>
      {items.length === 0 ? (
        <p className="bt-empty">Chưa có hoạt động nào được ghi nhận.</p>
      ) : (
        <ol className="bt-log">
          {items.map((a) => (
            <li key={a.id}>
              <time dateTime={a.at}>{timeOnly(a.at)}</time>
              <span>{a.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
