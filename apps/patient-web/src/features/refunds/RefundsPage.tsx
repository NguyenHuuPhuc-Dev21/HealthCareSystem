import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Gift } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatVND } from '../../lib/formatters';
import { useAuth } from '../auth';
import { getRefunds } from './refunds.api';
import { POLICY_MATRIX, SCENARIO_TITLE } from './refunds.types';
import type { PolicyRow, RefundRecord } from './refunds.types';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: RefundRecord[] };

const ACTOR_LABEL: Record<PolicyRow['actor'], string> = { CUSTOMER: 'Khi bạn huỷ / dừng ca', NURSE: 'Khi điều dưỡng huỷ / không đến', SYSTEM: 'Hệ thống tự xử lý' };

const POLL_MS = 4_000;

function RefundCard({ r }: { r: RefundRecord }) {
  const row = POLICY_MATRIX.find((p) => p.scenario === r.scenario);
  const done = r.status === 'REFUNDED';
  const kept = r.amountPaid - r.refundAmount;

  return (
    <li className="card rf-card">
      <div className="rf-card__head">
        <div>
          <b>{SCENARIO_TITLE[r.scenario]}</b>
          <p className="ns-muted">{r.bookingCode} · {r.serviceLabel}</p>
        </div>
        <span className={`chip ${done ? 'teal' : 'amber'}`}>{done ? 'Đã hoàn' : 'Đang xử lý'}</span>
      </div>

      {row && <p className="rf-card__why"><b>Điều kiện:</b> {row.trigger}</p>}

      <dl className="rf-lines">
        <div><dt>Bạn đã trả</dt><dd>{formatVND(r.amountPaid)}</dd></div>
        {kept > 0 && <div><dt>Phí huỷ ({100 - r.refundPercent}%)</dt><dd>− {formatVND(kept)}</dd></div>}
        {r.nurseCompensation > 0 && <div className="rf-sub"><dt>→ Đền bù điều dưỡng</dt><dd>{formatVND(r.nurseCompensation)}</dd></div>}
        {r.platformShare > 0 && <div className="rf-sub"><dt>→ Nền tảng thu</dt><dd>{formatVND(r.platformShare)}</dd></div>}
        <div className="rf-total"><dt>Hoàn về bạn ({r.refundPercent}%)</dt><dd>{formatVND(r.refundAmount)}</dd></div>
        {r.voucherAmount > 0 && (
          <div className="rf-voucher"><dt><Gift size={14} aria-hidden="true" /> Voucher xin lỗi</dt><dd>{formatVND(r.voucherAmount)}</dd></div>
        )}
      </dl>

      <ol className="rf-track" aria-label="Tiến độ hoàn tiền">
        <li className="done"><span aria-hidden="true"><Check size={12} /></span>Đã ghi nhận · {formatDateTime(r.createdAt)}</li>
        <li className={done ? 'done' : 'now'}><span aria-hidden="true">{done ? <Check size={12} /> : '2'}</span>Đang chuyển về tài khoản</li>
        <li className={done ? 'done' : ''}><span aria-hidden="true">{done ? <Check size={12} /> : '3'}</span>{done && r.refundedAt ? `Đã hoàn · ${formatDateTime(r.refundedAt)}` : 'Đã hoàn'}</li>
      </ol>
    </li>
  );
}

/** Theo dõi hoàn tiền (Phase 5): từng khoản hoàn gắn với kịch bản trong ma trận huỷ/timeout/đền bù §5.2, kèm bảng chính sách đầy đủ. */
export function RefundsPage() {
  const { user, signOut } = useAuth();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchList = async (silent = false) => {
    if (!silent) setLoad({ state: 'loading' });
    const res = await getRefunds();
    if (res.success) setLoad({ state: 'ready', items: res.data.items });
    else if (!silent) setLoad({ state: 'error', message: getErrorMessage(res.error, 'Chưa tải được danh sách hoàn tiền.') });
  };

  useEffect(() => {
    fetchList();
  }, []);

  const items = load.state === 'ready' ? load.items : [];
  const processing = items.some((r) => r.status === 'PROCESSING');

  // Còn khoản đang xử lý thì hỏi lại định kỳ để thấy trạng thái chuyển sang "Đã hoàn"
  useEffect(() => {
    if (!processing) return;
    const t = window.setInterval(() => fetchList(true), POLL_MS);
    return () => window.clearInterval(t);
  }, [processing]);

  const refunded = items.filter((r) => r.status === 'REFUNDED').reduce((s, r) => s + r.refundAmount, 0);
  const pending = items.filter((r) => r.status === 'PROCESSING').reduce((s, r) => s + r.refundAmount, 0);
  const usedScenarios = new Set(items.map((r) => r.scenario));

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head">
        <Link to="/bookings" className="bt-back"><ArrowLeft size={16} aria-hidden="true" /> Đơn của tôi</Link>
        <h1>Theo dõi hoàn tiền</h1>
        <p>Mỗi khoản hoàn gắn với một kịch bản trong chính sách huỷ lịch &amp; đền bù. Hoàn tiền chỉ áp dụng cho đơn chuyển khoản — đơn tiền mặt chưa trả trước nên không có hoàn tiền.</p>
      </div>

      {load.state === 'loading' && <div className="card step-card skeleton">Đang tải…</div>}
      {load.state === 'error' && (
        <Alert title={load.message}><Button type="button" variant="secondary" size="sm" onClick={() => fetchList()}>Thử lại</Button></Alert>
      )}

      {load.state === 'ready' && (
        <>
          <div className="rf-tiles">
            <div className="card rf-tile"><small>Đã hoàn về tài khoản</small><b>{formatVND(refunded)}</b></div>
            <div className="card rf-tile"><small>Đang xử lý</small><b>{formatVND(pending)}</b></div>
            <div className="card rf-tile"><small>Số khoản hoàn</small><b>{items.length}</b></div>
          </div>

          {items.length === 0 ? (
            <div className="card step-card text-center">
              <b className="text-navy">Chưa có khoản hoàn tiền nào</b>
              <p className="step-card__sub" style={{ marginTop: 6 }}>Khi bạn huỷ ca, ca hết hạn ghép điều dưỡng hoặc điều dưỡng không đến, khoản hoàn sẽ hiện ở đây.</p>
            </div>
          ) : (
            <ul className="rf-list">{items.map((r) => <RefundCard key={r.refundId} r={r} />)}</ul>
          )}

          <section className="card step-card rf-policy" aria-labelledby="rf-policy-title">
            <h2 id="rf-policy-title" className="step-card__title">Chính sách huỷ lịch &amp; hoàn tiền</h2>
            <p className="step-card__sub">Tỷ lệ áp dụng cho đơn chuyển khoản (đã trả vào hệ thống). Số tiền cụ thể do hệ thống tính theo cấu hình hiện hành.</p>
            {(['CUSTOMER', 'NURSE', 'SYSTEM'] as const).map((actor) => (
              <div key={actor} className="rf-group">
                <h3>{ACTOR_LABEL[actor]}</h3>
                <ul>
                  {POLICY_MATRIX.filter((p) => p.actor === actor).map((p) => (
                    <li key={p.no} className={usedScenarios.has(p.scenario) ? 'is-used' : undefined}>
                      <span className="rf-no" aria-hidden="true">{p.no}</span>
                      <div>
                        <b>{p.title}</b>
                        {usedScenarios.has(p.scenario) && <span className="chip teal">Đã áp dụng cho bạn</span>}
                        <p>{p.trigger}</p>
                        <p className="rf-rule">{p.sanction}</p>
                        <p className="ns-muted">{p.handling}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </PatientLayout>
  );
}
