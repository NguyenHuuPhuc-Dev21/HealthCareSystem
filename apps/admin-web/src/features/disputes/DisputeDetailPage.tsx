import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatVND } from '../../lib/formatters';
import { useAuth } from '../auth';
import { ChatEvidence } from './components/ChatEvidence';
import { EvidenceGallery } from './components/EvidenceGallery';
import { ResolvePanel } from './components/ResolvePanel';
import { getDispute } from './disputes.api';
import { CATEGORY_LABEL, STATUS_LABEL } from './disputes.types';
import type { Dispute } from './disputes.types';
import { rebuttalSla } from './sla';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Dispute };

/** Bàn điều tra một khiếu nại: nội dung + bằng chứng hai bên, phản hồi, lịch sử chat (ghi nhật ký) và phán quyết. */
export function DisputeDetailPage() {
  const { id = '' } = useParams();
  const { user, signOut } = useAuth();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchDetail = useCallback(async () => {
    const res = await getDispute(id);
    setLoad(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được khiếu nại.') });
  }, [id]);

  useEffect(() => {
    setLoad({ state: 'loading' });
    fetchDetail();
  }, [fetchDetail]);

  const d = load.state === 'ready' ? load.data : null;
  const appeal = d?.kind === 'PENALTY_APPEAL';
  const open = d?.status === 'OPEN' || d?.status === 'UNDER_REVIEW';
  const st = d ? STATUS_LABEL[d.status] : null;
  const sla = d ? rebuttalSla(d) : null;

  return (
    <AdminLayout fullName={user?.full_name} onSignOut={signOut}>
      <p className="crumb"><Link to="/disputes">Khiếu nại</Link> / {d?.bookingCode ?? '…'}</p>

      {load.state === 'loading' && <div className="card table-card"><div className="table-empty">Đang tải…</div></div>}
      {load.state === 'error' && <Alert title={load.message}><Button size="sm" variant="secondary" onClick={fetchDetail}>Thử lại</Button></Alert>}

      {d && st && sla && (
        <>
          <div className="page-head page-head--row">
            <div>
              <h1>{appeal ? 'Kháng cáo khoản phạt ký quỹ' : CATEGORY_LABEL[d.category]}</h1>
              <p>Ca <b>{d.bookingCode}</b> · mở bởi {d.openedBy === 'PATIENT' ? 'khách hàng' : 'điều dưỡng'} lúc {formatDateTime(d.createdAt)}</p>
            </div>
            <div className="dsp-state">
              <span className={`chip ${st.tone}`}>{st.text}</span>
              {open && !appeal && <span className={`age age--${sla.tone}`}>Hạn phản hồi: {sla.text}</span>}
            </div>
          </div>

          {open && <Alert tone="info" title="Tiền của ca đang bị đóng băng.">Thanh toán/giải ngân không chạy cho tới khi khiếu nại được phán quyết.</Alert>}

          <div className="dsp-grid">
            <div className="dsp-col">
              <section className="card dsp-card" aria-labelledby="dsp-claim">
                <h3 id="dsp-claim" className="section-title">{d.openedBy === 'PATIENT' ? 'Nội dung khiếu nại của khách' : 'Nội dung khiếu nại của điều dưỡng'}</h3>
                <p className="dsp-text">{d.description}</p>
                {appeal && d.penaltyAmount != null && (
                  <p className="dsp-penalty">Khoản phạt bị kháng cáo: <b>{formatVND(d.penaltyAmount)}</b>{d.penaltyReason && <> · lý do <code>{d.penaltyReason}</code></>}</p>
                )}
                <h4 className="dsp-sub">Bằng chứng</h4>
                <EvidenceGallery items={d.evidences} empty="Không đính kèm bằng chứng." />
              </section>

              {!appeal && (
                <section className="card dsp-card" aria-labelledby="dsp-rebut">
                  <h3 id="dsp-rebut" className="section-title">Phản hồi của {d.openedBy === 'PATIENT' ? 'điều dưỡng' : 'khách hàng'}</h3>
                  {d.nurseRebuttal ? (
                    <>
                      <p className="muted">Gửi lúc {formatDateTime(d.nurseRebuttal.submittedAt)}</p>
                      <p className="dsp-text">{d.nurseRebuttal.content}</p>
                      <h4 className="dsp-sub">Bằng chứng</h4>
                      <EvidenceGallery items={d.nurseRebuttal.evidences ?? []} empty="Không đính kèm bằng chứng." />
                    </>
                  ) : (
                    <p className="muted">
                      {sla.tone === 'late' ? 'Bên bị khiếu nại không phản hồi trong thời hạn. Bạn có thể phán quyết dựa trên bằng chứng hiện có.' : 'Chưa có phản hồi — vẫn còn trong thời hạn.'}
                    </p>
                  )}
                </section>
              )}

              {!appeal && <ChatEvidence bookingId={d.bookingId} />}
            </div>

            <div className="dsp-col">
              {open ? (
                <ResolvePanel dispute={d} onResolved={fetchDetail} />
              ) : (
                d.resolution && (
                  <section className="card dsp-card" aria-labelledby="dsp-final">
                    <h3 id="dsp-final" className="section-title">Quyết định</h3>
                    <p><span className={`chip ${st.tone}`}>{st.text}</span> <span className="muted">lúc {formatDateTime(d.resolution.resolvedAt)}</span></p>
                    <p className="dsp-text">{d.resolution.note}</p>
                    <dl className="dsp-summary">
                      {d.resolution.refundedToPatient && <div><dt>Khách</dt><dd>Đã hoàn 100%</dd></div>}
                      {d.resolution.releasedToNurse && <div><dt>Điều dưỡng</dt><dd>Đã được giải ngân / hoàn phạt</dd></div>}
                      {!!d.resolution.trustScoreDelta && <div><dt>TrustScore</dt><dd>{d.resolution.trustScoreDelta}</dd></div>}
                      {!!d.resolution.depositDeducted && <div><dt>Trừ ký quỹ</dt><dd>{formatVND(d.resolution.depositDeducted)}</dd></div>}
                    </dl>
                  </section>
                )
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
