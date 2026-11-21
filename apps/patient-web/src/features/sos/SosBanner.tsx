import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Siren, X } from 'lucide-react';
import { formatDateTime } from '../../lib/formatters';
import { usePolling } from '../../lib/usePolling';
import { acknowledgeSos, getOpenSosAlerts } from '../booking-tracking/booking-tracking.api';
import type { SosAlert } from '../booking-tracking/booking-tracking.types';

const POLL_MS = 8_000;
const DISMISSED_KEY = 'sos-banner-dismissed';

/**
 * Banner cảnh báo khẩn cấp phát tới gia đình (FR-SHIFT-05 / BR-23): hiện trên mọi trang khi một ca của tài khoản
 * có SOS chưa đóng. Gọi 115 luôn là bước đầu tiên — nền tảng chỉ báo tin, định vị và phối hợp, không thay thế cấp cứu.
 */
export function SosBanner() {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Ẩn banner chỉ ở phía người xem (không xác nhận, không đóng cảnh báo); nhớ trong phiên để khỏi hiện lại mỗi lần hỏi.
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]'));
    } catch {
      return new Set<string>();
    }
  });

  usePolling(async () => {
    const res = await getOpenSosAlerts();
    if (res.success) setAlerts(res.data.items);
    // Lỗi mạng: giữ nguyên banner đang hiển thị — không được làm mất cảnh báo khẩn cấp vì một lần hỏi lỗi.
  }, POLL_MS);

  const acknowledge = async (id: string) => {
    setBusyId(id);
    const res = await acknowledgeSos(id);
    setBusyId(null);
    if (res.success) setAlerts((prev) => prev.map((a) => (a.alertId === id ? res.data : a)));
  };

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      } catch {
        /* sessionStorage bị chặn — chỉ ẩn trong lần hiển thị này */
      }
      return next;
    });
  };

  const visible = alerts.filter((a) => !dismissed.has(a.alertId));
  if (visible.length === 0) return null;

  return (
    <div className="sos-stack" role="region" aria-label="Cảnh báo khẩn cấp">
      {visible.map((a) => {
        const v = a.latestVitals;
        return (
          <div key={a.alertId} className={`sos-banner${a.status === 'ACKNOWLEDGED' ? ' is-ack' : ''}`} role="alert" aria-live="assertive">
            <Siren size={26} aria-hidden="true" className="sos-banner__icon" />
            <div className="sos-banner__body">
              <b>KHẨN CẤP · {a.patientName} · ca {a.bookingCode}</b>
              <p>
                {a.raisedBy === 'NURSE' ? `Điều dưỡng ${a.nurseName ?? ''}`.trim() : 'Người nhà tại hiện trường'} đã bấm SOS lúc {formatDateTime(a.raisedAt)}.
                {' '}<strong>Hãy gọi 115 ngay nếu chưa gọi</strong> — hệ thống chỉ báo tin, không thay thế cấp cứu.
              </p>
              <p className="sos-banner__meta">
                {v && (
                  <span>
                    Sinh hiệu gần nhất: mạch {v.pulse ?? '—'} · SpO₂ {v.spo2 ?? '—'}% · HA {v.systolic ?? '—'}/{v.diastolic ?? '—'} · {v.temperatureC ?? '—'}°C
                  </span>
                )}
                {a.lat !== null && a.lng !== null && (
                  <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
                    <MapPin size={14} aria-hidden="true" /> Xem vị trí
                  </a>
                )}
              </p>
              {a.status === 'ACKNOWLEDGED' && a.acknowledgedAt && (
                <p className="sos-banner__meta">Bạn đã xác nhận lúc {formatDateTime(a.acknowledgedAt)} · Admin đang phối hợp hỗ trợ.</p>
              )}
            </div>
            <button type="button" className="sos-banner__close" aria-label="Ẩn banner cảnh báo" title="Ẩn banner" onClick={() => dismiss(a.alertId)}>
              <X size={18} aria-hidden="true" />
            </button>
            <div className="sos-banner__actions">
              <a href="tel:115" className="btn sos-banner__call"><Phone size={16} aria-hidden="true" /> Gọi 115</a>
              <Link to={`/bookings/${a.bookingId}`} className="btn btn-secondary btn-sm">Xem ca</Link>
              {a.status === 'ACTIVE' && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => acknowledge(a.alertId)} disabled={busyId === a.alertId}>
                  Tôi đã nhận tin
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
