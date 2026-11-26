import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, FileText } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { useAuth } from '../auth';
import { getDispute, getMyDisputes } from './disputes.api';
import { CATEGORY_LABEL, STATUS_LABEL } from './disputes.types';
import type { Dispute, DisputeEvidence } from './disputes.types';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: Dispute[] };

function EvidenceList({ items, title }: { items: DisputeEvidence[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <div className="dp-ev">
      <b>{title}</b>
      <ul>
        {items.map((e) => (
          <li key={e.id}>
            <a href={e.url} target="_blank" rel="noreferrer">
              {e.url.startsWith('data:image') || /\.(jpe?g|png|webp)(\?|$)/i.test(e.url) ? <img src={e.url} alt={e.fileName ?? 'Bằng chứng'} /> : <span className="ev__pdf"><FileText size={22} aria-hidden="true" /></span>}
              <small>{e.fileName ?? 'Bằng chứng'}</small>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Một khiếu nại: tóm tắt + (mở rộng) diễn biến — nội dung, bằng chứng, phản hồi của điều dưỡng, quyết định của Admin. */
function DisputeCard({ d, open, onToggle }: { d: Dispute; open: boolean; onToggle: () => void }) {
  const [detail, setDetail] = useState<Dispute>(d);
  const [loading, setLoading] = useState(false);
  const st = STATUS_LABEL[d.status];

  // Mở rộng thì tải chi tiết mới nhất (link bằng chứng presigned hết hạn nhanh)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getDispute(d.id).then((res) => {
      if (!cancelled) {
        if (res.success) setDetail(res.data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, d.id]);

  const due = detail.rebuttalDueAt && detail.status === 'OPEN' ? detail.rebuttalDueAt : null;

  return (
    <li className={`card dp-card${open ? ' is-open' : ''}`} id={`dispute-${d.id}`}>
      <button type="button" className="dp-card__head" aria-expanded={open} onClick={onToggle}>
        <span>
          <b>{CATEGORY_LABEL[d.category]}</b>
          <small className="ns-muted"> · ca {d.bookingCode} · gửi {formatDateTime(d.createdAt)}</small>
        </span>
        <span className="dp-card__right">
          <span className={`chip ${st.tone}`}>{st.text}</span>
          <ChevronDown size={18} aria-hidden="true" className="dp-card__chev" />
        </span>
      </button>

      {open && (
        <div className="dp-card__body">
          {loading && <p className="skeleton">Đang tải chi tiết…</p>}

          <ol className="dp-timeline">
            <li className="done">
              <b>Bạn gửi khiếu nại</b>
              <time>{formatDateTime(detail.createdAt)}</time>
              <p>{detail.description}</p>
              <EvidenceList items={detail.evidences} title="Bằng chứng của bạn" />
            </li>

            {detail.nurseRebuttal ? (
              <li className="done">
                <b>Điều dưỡng phản hồi</b>
                <time>{formatDateTime(detail.nurseRebuttal.submittedAt)}</time>
                <p>{detail.nurseRebuttal.content}</p>
                <EvidenceList items={detail.nurseRebuttal.evidences ?? []} title="Bằng chứng của điều dưỡng" />
              </li>
            ) : due ? (
              <li className="now">
                <b>Chờ điều dưỡng phản hồi</b>
                <p>Điều dưỡng có tới {formatDateTime(due)} để giải trình. Sau đó Admin sẽ xem xét.</p>
              </li>
            ) : null}

            {detail.status === 'UNDER_REVIEW' && (
              <li className="now">
                <b>Admin đang xem xét</b>
                <p>Admin đối chiếu nhật ký GPS, giờ check-in/out, nhật ký chăm sóc và lịch sử chat để quyết định.</p>
              </li>
            )}

            {detail.resolution && (
              <li className={detail.resolution.outcome === 'RESOLVED_CUSTOMER' ? 'done ok' : 'done'}>
                <b>{detail.resolution.outcome === 'RESOLVED_CUSTOMER' ? 'Khiếu nại được chấp nhận' : 'Khiếu nại không được chấp nhận'}</b>
                <time>{formatDateTime(detail.resolution.resolvedAt)}</time>
                <p>{detail.resolution.note}</p>
                <p className="dp-outcome">
                  {detail.resolution.outcome === 'RESOLVED_CUSTOMER'
                    ? 'Khoản tiền đang tạm giữ được hoàn 100% cho bạn.'
                    : 'Khoản tiền được giải ngân cho điều dưỡng theo quy trình quyết toán.'}
                  {detail.resolution.outcome === 'RESOLVED_CUSTOMER' && <> <Link to="/refunds" className="link-strong">Theo dõi hoàn tiền →</Link></>}
                </p>
              </li>
            )}
          </ol>
        </div>
      )}
    </li>
  );
}

/** Khiếu nại của tôi (FR-DISP-01): danh sách khiếu nại của các ca do khách đặt và diễn biến xử lý. */
export function DisputesPage() {
  const { user, signOut } = useAuth();
  const [params] = useSearchParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [openId, setOpenId] = useState<string | null>(params.get('open'));

  const fetchList = useCallback(async () => {
    setLoad({ state: 'loading' });
    const res = await getMyDisputes();
    setLoad(res.success ? { state: 'ready', items: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Chưa tải được danh sách khiếu nại.') });
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Mở sẵn khiếu nại được trỏ tới từ thông báo
  useEffect(() => {
    if (load.state === 'ready' && openId) document.getElementById(`dispute-${openId}`)?.scrollIntoView({ block: 'center' });
  }, [load.state, openId]);

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head">
        <Link to="/bookings" className="bt-back"><ArrowLeft size={16} aria-hidden="true" /> Đơn của tôi</Link>
        <h1>Khiếu nại của tôi</h1>
        <p>Theo dõi diễn biến xử lý. Khi khiếu nại đang mở, tiền tạm giữ của ca bị đóng băng cho tới khi Admin quyết định.</p>
      </div>

      {load.state === 'loading' && <div className="card step-card skeleton">Đang tải…</div>}
      {load.state === 'error' && <Alert title={load.message}><Button type="button" variant="secondary" size="sm" onClick={fetchList}>Thử lại</Button></Alert>}
      {load.state === 'ready' && load.items.length === 0 && (
        <div className="card step-card text-center">
          <b className="text-navy">Bạn chưa có khiếu nại nào</b>
          <p className="step-card__sub" style={{ marginTop: 6 }}>Nếu ca chăm sóc có vấn đề, bạn có thể khiếu nại từ trang "Đơn của tôi" trong ca hoặc 24 giờ sau khi điều dưỡng kết thúc.</p>
          <Link to="/bookings" className="btn btn-primary">Về Đơn của tôi</Link>
        </div>
      )}
      {load.state === 'ready' && load.items.length > 0 && (
        <ul className="dp-list">
          {load.items.map((d) => <DisputeCard key={d.id} d={d} open={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} />)}
        </ul>
      )}
    </PatientLayout>
  );
}
