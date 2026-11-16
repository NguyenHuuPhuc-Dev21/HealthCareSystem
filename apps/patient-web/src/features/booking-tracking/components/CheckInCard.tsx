import { Camera, MapPinCheck } from 'lucide-react';
import { initialsOf } from '../../../components/layout/SetupLayout';
import { formatDateTime } from '../../../lib/formatters';
import type { BookingTracking } from '../booking-tracking.types';

/** Giới hạn khoảng cách check-in (CHECKIN_MAX_RADIUS_METERS) — chỉ để hiển thị, backend mới là nơi kiểm tra. */
const CHECKIN_MAX_RADIUS_METERS = 200;

/**
 * Selfie check-in của điều dưỡng (FR-SHIFT-01): chụp trực tiếp trong app, đóng dấu giờ + toạ độ từ server,
 * gửi tới gia đình để đối chiếu danh tính với người đến nhà.
 */
export function CheckInCard({ tracking }: { tracking: BookingTracking }) {
  const { checkIn, nurse } = tracking;

  return (
    <section className="card step-card bt-card" aria-labelledby="bt-checkin">
      <h3 id="bt-checkin" className="step-card__title"><Camera size={18} aria-hidden="true" /> Ảnh check-in của điều dưỡng</h3>

      {!checkIn ? (
        <p className="bt-empty">Điều dưỡng chưa check-in. Ảnh selfie chụp trực tiếp tại địa chỉ chăm sóc sẽ hiện ở đây để bạn đối chiếu.</p>
      ) : (
        <>
          <div className="bt-checkin">
            <figure className="bt-selfie">
              <img src={checkIn.selfieUrl} alt={`Ảnh selfie check-in của ${nurse?.fullName ?? 'điều dưỡng'}`} />
              <figcaption>{checkIn.watermark}</figcaption>
            </figure>
            <div className="bt-checkin__meta">
              <div className="bt-who">
                <span className="avatar avatar--lg" aria-hidden="true">{initialsOf(nurse?.fullName)}</span>
                <div>
                  <b>{nurse?.fullName ?? 'Điều dưỡng'}</b>
                  <span className="ns-muted">Hồ sơ đã được Admin thẩm định</span>
                </div>
              </div>
              <p><b>Check-in lúc</b> {formatDateTime(checkIn.at)}</p>
              <p>
                <MapPinCheck size={15} aria-hidden="true" /> Cách địa chỉ chăm sóc <b>{checkIn.distanceMeters} m</b>
                <span className="ns-muted"> (cho phép ≤ {CHECKIN_MAX_RADIUS_METERS} m)</span>
              </p>
            </div>
          </div>
          <p className="bt-note">
            Hãy đối chiếu ảnh với người đang ở nhà bạn. Nếu không phải người trong ảnh, đừng để họ chăm sóc và liên hệ hỗ trợ ngay.
          </p>
        </>
      )}
    </section>
  );
}
