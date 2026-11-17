import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Phone, Siren } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { usePolling } from '../../lib/usePolling';
import { useAuth } from '../auth';
import { EXECUTION_LABEL } from '../booking/booking.types';
import { getBookingTracking, raiseSos } from './booking-tracking.api';
import type { BookingTracking } from './booking-tracking.types';
import { EXTENSION_WINDOW_MINUTES } from './booking-tracking.types';
import { CareLog } from './components/CareLog';
import { CheckInCard } from './components/CheckInCard';
import { ExtendModal } from './components/ExtendModal';
import { ExtensionsCard } from './components/ExtensionsCard';
import { VitalsPanel } from './components/VitalsPanel';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: BookingTracking };

const POLL_ACTIVE_MS = 5_000;
const POLL_IDLE_MS = 20_000;

const timeWithSeconds = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const STEPS = ['Đã xác nhận', 'Đã check-in', 'Đang chăm sóc', 'Hoàn thành'] as const;

/** Chỉ số bước hiện tại trên dòng thời gian (0–3). */
function stepIndex(t: BookingTracking): number {
  if (t.executionStatus === 'COMPLETED') return 3;
  if (t.executionStatus === 'IN_PROGRESS') return t.vitals.length > 0 ? 2 : 1;
  return 0;
}

/**
 * Theo dõi ca (Phase 4): trạng thái trực tiếp, selfie check-in, sinh hiệu, nhật ký chăm sóc, gia hạn và SOS.
 * Dữ liệu cập nhật mỗi vài giây (hỏi lại định kỳ; backend thật sẽ đẩy qua WebSocket).
 */
export function ShiftTrackingPage() {
  const { id = '' } = useParams();
  const { user, signOut } = useAuth();
  const now = useNow();

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await getBookingTracking(id);
    if (res.success) {
      setLoad({ state: 'ready', data: res.data });
      setUpdatedAt(new Date());
    } else {
      setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'error', message: getErrorMessage(res.error, 'Không tải được thông tin ca.') }));
    }
  }, [id]);

  const t = load.state === 'ready' ? load.data : null;
  const live = t?.executionStatus === 'IN_PROGRESS' || t?.executionStatus === 'CONFIRMED';
  usePolling(refresh, live ? POLL_ACTIVE_MS : POLL_IDLE_MS);

  const endMs = t ? Date.parse(t.scheduledEndAt) : 0;
  const startMs = t ? Date.parse(t.scheduledStartAt) : 0;
  const remainingMin = Math.ceil((endMs - now) / 60_000);
  const pending = t?.extensions.some((e) => e.status === 'AWAITING_PAYMENT' || e.status === 'AWAITING_NURSE') ?? false;
  const canExtend = t?.executionStatus === 'IN_PROGRESS' && remainingMin > 0 && remainingMin <= EXTENSION_WINDOW_MINUTES && !pending;
  const progress = t && endMs > startMs ? Math.max(0, Math.min(100, ((now - startMs) / (endMs - startMs)) * 100)) : 0;

  /**
   * SOS (FR-SHIFT-05): mở bàn phím gọi 115 NGAY, không hỏi xác nhận; báo tin cho gia đình/Admin chạy song song.
   * Nền tảng không tự gọi 115 và không thay thế cấp cứu.
   */
  const sos = async () => {
    window.location.href = 'tel:115';
    setSosBusy(true);
    setSosError(null);
    const getPos = () =>
      new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
        if (!navigator.geolocation) return resolve(undefined);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(undefined),
          { timeout: 1500, maximumAge: 60_000 },
        );
      });
    const res = await raiseSos(id, await getPos());
    setSosBusy(false);
    if (!res.success) setSosError(getErrorMessage(res.error, 'Chưa gửi được cảnh báo SOS tới Admin. Hãy gọi 115 ngay.'));
    refresh();
  };

  const body = () => {
    if (load.state === 'loading') return <div className="card step-card skeleton">Đang tải thông tin ca…</div>;
    if (load.state === 'error') return <Alert title={load.message}><Button type="button" variant="secondary" size="sm" onClick={refresh}>Thử lại</Button></Alert>;
    const data = load.data;
    const exec = EXECUTION_LABEL[data.executionStatus];
    const step = stepIndex(data);

    return (
      <>
        {notice && <Alert tone="success" title={notice} />}

        {/* Trạng thái trực tiếp */}
        <section className="card step-card bt-live" aria-label="Trạng thái ca">
          <div className="bt-live__top">
            <div>
              <span className={`chip ${exec.tone}`}>{exec.text}</span>
              <h2>{data.serviceLabel}</h2>
              <p className="bt-sub">{data.patientName}{data.addressText ? ` · ${data.addressText}` : ''}</p>
            </div>
            <span className="bt-livedot" role="status">
              <i aria-hidden="true" className={live ? 'is-live' : ''} />
              {live ? 'Cập nhật trực tiếp' : 'Không cập nhật trực tiếp'}
              {updatedAt && <small> · lúc {timeWithSeconds(updatedAt)}</small>}
            </span>
          </div>

          <ol className="bt-steps" aria-label="Tiến trình ca">
            {STEPS.map((label, i) => (
              <li key={label} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>
                <span aria-hidden="true">{i < step ? <CheckCircle2 size={16} /> : i + 1}</span>{label}
              </li>
            ))}
          </ol>

          {data.executionStatus === 'IN_PROGRESS' && (
            <div className="bt-time">
              <div className="bk-progress bt-time__bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
              <p>
                {formatDateTime(data.scheduledStartAt)} → <b>{formatDateTime(data.scheduledEndAt)}</b>
                {' · '}
                {remainingMin > 0 ? <>còn <b>{remainingMin >= 60 ? `${Math.floor(remainingMin / 60)} giờ ${remainingMin % 60} phút` : `${remainingMin} phút`}</b></> : 'đã đến giờ kết thúc'}
              </p>
            </div>
          )}
          {data.executionStatus === 'CONFIRMED' && (
            <p className="bt-sub">Ca bắt đầu lúc {formatDateTime(data.scheduledStartAt)}. Bạn sẽ thấy ảnh check-in ngay khi điều dưỡng đến nơi.</p>
          )}
          {data.executionStatus === 'COMPLETED' && data.checkOutAt && (
            <p className="bt-sub">Điều dưỡng đã check-out lúc {formatDateTime(data.checkOutAt)}. Bạn có 24 giờ để khiếu nại nếu có vấn đề.</p>
          )}
          {data.nurse && <p className="bt-sub">Điều dưỡng: <b>{data.nurse.fullName}</b> · {data.nurse.tier === 'TIER_2_SPECIALIST' ? 'Cấp 2' : 'Cấp 1'}</p>}
        </section>

        {/* Khẩn cấp + gia hạn (chỉ khi ca đang thực hiện) */}
        {data.executionStatus === 'IN_PROGRESS' && (
          <div className="bt-actions">
            <section className="card step-card bt-sos" aria-labelledby="bt-sos-title">
              <h3 id="bt-sos-title"><Siren size={18} aria-hidden="true" /> Tình huống khẩn cấp?</h3>
              <p>Người bệnh ngưng thở, tím tái, co giật, nghi đột quỵ hoặc sốc phản vệ — <b>gọi 115 ngay</b>. Hệ thống đồng thời báo cho gia đình và Admin kèm vị trí.</p>
              <button type="button" className="btn bt-sos__btn" onClick={sos} disabled={sosBusy} aria-busy={sosBusy}>
                <Phone size={18} aria-hidden="true" /> Gọi 115 &amp; báo SOS
              </button>
              {sosError && <Alert title={sosError} />}
              {data.emergency && <p className="bt-sos__state" role="status">Đã gửi cảnh báo lúc {formatDateTime(data.emergency.raisedAt)}.</p>}
            </section>

            <section className="card step-card bt-extend-card" aria-labelledby="bt-extend-title">
              <h3 id="bt-extend-title">Cần thêm thời gian?</h3>
              {canExtend ? (
                <>
                  <p>Gia hạn theo bội số 1 giờ. Điều dưỡng cần đồng ý và không vướng ca kế tiếp.</p>
                  <Button type="button" onClick={() => setExtendOpen(true)}>Gia hạn ca</Button>
                </>
              ) : pending ? (
                <p>Đang có một yêu cầu gia hạn chưa hoàn tất — xem bên dưới.</p>
              ) : remainingMin > EXTENSION_WINDOW_MINUTES ? (
                <p>Có thể gia hạn trong {EXTENSION_WINDOW_MINUTES} phút cuối của ca (mở sau khoảng {remainingMin - EXTENSION_WINDOW_MINUTES} phút nữa).</p>
              ) : (
                <p>Ca đã đến giờ kết thúc, không thể gia hạn.</p>
              )}
            </section>
          </div>
        )}

        <ExtensionsCard bookingId={data.bookingId} extensions={data.extensions} onChanged={refresh} />

        <div className="bt-grid">
          <div className="bt-col">
            <CheckInCard tracking={data} />
            <VitalsPanel vitals={data.vitals} />
          </div>
          <div className="bt-col">
            <CareLog activities={data.activities} />
          </div>
        </div>

        {t && (
          <ExtendModal
            bookingId={data.bookingId}
            isOpen={extendOpen}
            paymentMethod={data.paymentMethod}
            onClose={() => setExtendOpen(false)}
            onRequested={(ext) => {
              setExtendOpen(false);
              setNotice(ext.status === 'AWAITING_PAYMENT' ? 'Đã tạo yêu cầu gia hạn — hãy nạp tiền để gia hạn có hiệu lực.' : 'Đã gửi yêu cầu gia hạn tới điều dưỡng.');
              refresh();
            }}
          />
        )}
      </>
    );
  };

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head">
        <Link to="/bookings" className="bt-back"><ArrowLeft size={16} aria-hidden="true" /> Đơn của tôi</Link>
        <h1>Theo dõi ca {t?.code ?? ''}</h1>
      </div>
      {body()}
    </PatientLayout>
  );
}
