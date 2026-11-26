import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { Alert, Button } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { downloadCsvText } from '../../lib/download';
import { getErrorMessage } from '../../lib/errors';
import { formatVND } from '../../lib/formatters';
import { useAuth } from '../auth';
import { exportLedgerCsv, getFinancialReconciliation } from './finance.api';
import type { FinancialReconDto } from './finance.api';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: FinancialReconDto };

const CHECK_LABEL: Record<string, string> = {
  ESCROW_LEDGER: 'Ví escrow (tiền khách đang tạm giữ)',
  AVAILABLE_LEDGER: 'Ví khả dụng của điều dưỡng',
  DEPOSIT_LEDGER: 'Ví ký quỹ của điều dưỡng',
};

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function presets() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevLast = new Date(now.getFullYear(), now.getMonth(), 0);
  const d7 = new Date(now.getTime() - 6 * 86_400_000);
  return [
    { key: 'today', label: 'Hôm nay', from: ymd(now), to: ymd(now) },
    { key: '7d', label: '7 ngày', from: ymd(d7), to: ymd(now) },
    { key: 'month', label: 'Tháng này', from: ymd(first), to: ymd(now) },
    { key: 'prev', label: 'Tháng trước', from: ymd(prevFirst), to: ymd(prevLast) },
  ];
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'teal' | 'amber' }) {
  return (
    <div className={`card fin-kpi${tone ? ` fin-kpi--${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

/** A5 · Tài chính (CT-15): đối soát escrow, hoa hồng, chi trả, hoàn tiền, rút tiền; kiểm sổ cái; xuất báo cáo. */
export function FinancePage() {
  const { user, signOut } = useAuth();
  const quick = useMemo(presets, []);
  const [from, setFrom] = useState(quick[2].from);
  const [to, setTo] = useState(quick[2].to);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const periodError = from > to ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' : (Date.parse(to) - Date.parse(from)) / 86_400_000 >= 366 ? 'Kỳ báo cáo tối đa 366 ngày.' : null;

  const fetchReport = useCallback(async () => {
    if (periodError) return;
    setLoad({ state: 'loading' });
    const res = await getFinancialReconciliation(from, to);
    setLoad(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được báo cáo đối soát.') });
  }, [from, to, periodError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportLedger = async () => {
    setExporting(true);
    setExportMsg(null);
    const res = await exportLedgerCsv(from, to);
    setExporting(false);
    if (res.ok) setExportMsg({ tone: 'success', text: 'Đã tải sổ cái. Lượt xuất này được ghi nhật ký kiểm toán (EXPORT_FINANCE_REPORT).' });
    else if (res.code === 'EXPORT_TOO_LARGE') setExportMsg({ tone: 'error', text: 'Kỳ này có quá nhiều dòng (tối đa 50.000). Hãy chọn kỳ ngắn hơn.' });
    else setExportMsg({ tone: 'error', text: res.message ?? 'Chưa xuất được. Vui lòng thử lại.' });
  };

  const exportSummary = () => {
    if (load.state !== 'ready') return;
    const r = load.data;
    const v = (n: number) => n;
    downloadCsvText(
      [
        ['Báo cáo đối soát', `${from} → ${to}`],
        [],
        ['Chỉ tiêu', 'Giá trị (VNĐ)', 'Loại'],
        ['Tiền khách đang tạm giữ (escrow)', v(r.total_escrow_held), 'tại thời điểm xem'],
        ['Hoa hồng nền tảng thu được', v(r.total_commission_collected), 'trong kỳ'],
        ['  - từ đơn chuyển khoản', v(r.commission_transfer), 'trong kỳ'],
        ['  - từ đơn tiền mặt', v(r.commission_cash), 'trong kỳ'],
        ['Đã chi trả cho điều dưỡng', v(r.total_payouts), 'trong kỳ'],
        ['Đã hoàn cho khách', v(r.total_refunds), 'trong kỳ'],
        ['Yêu cầu rút tiền chờ duyệt', v(r.pending_withdrawals), 'tại thời điểm xem'],
        ['Rút tiền đã chi', v(r.withdrawals_paid), 'trong kỳ'],
        ['Tiền ký quỹ đang giữ', v(r.deposits_held), 'tại thời điểm xem'],
        ['Công nợ ký quỹ âm của điều dưỡng', v(r.nurse_deposit_debt), 'tại thời điểm xem'],
        ['Hoa hồng tiền mặt chưa nộp', v(r.cash_commission_unpaid), 'tại thời điểm xem'],
        ['  - trong đó quá hạn', v(r.cash_commission_overdue), 'tại thời điểm xem'],
        [],
        ['Đối chiếu sổ cái', 'Tổng ví', 'Tổng sổ cái', 'Kết quả'],
        ...r.checks.map((c) => [CHECK_LABEL[c.name] ?? c.name, c.walletsTotal, c.ledgerTotal, c.ok ? 'KHỚP' : 'LỆCH']),
      ],
      `doi-soat_${from}_${to}.csv`,
    );
  };

  const r = load.state === 'ready' ? load.data : null;
  const allOk = r?.checks.every((c) => c.ok) ?? true;

  return (
    <AdminLayout fullName={user?.full_name} onSignOut={signOut}>
      <div className="page-head">
        <h1>Tài chính</h1>
        <p>Đối soát tiền nền tảng đang giữ, hoa hồng, chi trả, hoàn tiền và rút tiền; kiểm tra số dư ví khớp với sổ cái chỉ-ghi-thêm.</p>
      </div>

      <div className="toolbar fin-period">
        <div className="chip-select" role="group" aria-label="Kỳ nhanh">
          {quick.map((p) => (
            <button key={p.key} type="button" className={from === p.from && to === p.to ? 'selected' : ''} aria-pressed={from === p.from && to === p.to} onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>
          ))}
        </div>
        <label className="fin-date">Từ <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="fin-date">Đến <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {periodError && <Alert title={periodError} />}

      {load.state === 'loading' && !periodError && <div className="card table-card"><div className="table-empty">Đang tải báo cáo…</div></div>}
      {load.state === 'error' && <Alert title={load.message}><Button size="sm" variant="secondary" onClick={fetchReport}>Thử lại</Button></Alert>}

      {r && (
        <>
          {allOk ? (
            <Alert tone="success" title="Sổ cái khớp: mọi số dư ví đều bằng tổng các bút toán.">Escrow, ví khả dụng và ký quỹ đã được đối chiếu với sổ cái chỉ-ghi-thêm tại thời điểm xem.</Alert>
          ) : (
            <Alert title="PHÁT HIỆN CHÊNH LỆCH SỔ CÁI — dừng chi trả ký quỹ.">Có ví không khớp với tổng bút toán (xem bảng đối chiếu). Không thủ công sửa số dư; điều tra bút toán rồi ghi nhận xử lý ở hàng đợi tài chính.</Alert>
          )}

          <div className="fin-kpis">
            <Kpi label="Tiền khách đang tạm giữ (escrow)" value={formatVND(r.total_escrow_held)} sub="tại thời điểm xem" />
            <Kpi tone="teal" label="Hoa hồng nền tảng thu được" value={formatVND(r.total_commission_collected)} sub={`Chuyển khoản ${formatVND(r.commission_transfer)} · tiền mặt ${formatVND(r.commission_cash)}`} />
            <Kpi label="Đã chi trả cho điều dưỡng" value={formatVND(r.total_payouts)} sub={`Giữ lại nạp ký quỹ ${formatVND(r.deposit_withheld)}`} />
            <Kpi label="Đã hoàn cho khách" value={formatVND(r.total_refunds)} sub="trong kỳ" />
            <Kpi tone={r.pending_withdrawals_count > 0 ? 'amber' : undefined} label="Rút tiền chờ duyệt" value={formatVND(r.pending_withdrawals)} sub={`${r.pending_withdrawals_count} yêu cầu`} />
          </div>

          <section className="card fin-card" aria-labelledby="fin-checks">
            <h3 id="fin-checks" className="section-title">Đối chiếu sổ cái</h3>
            <table className="data-table">
              <thead><tr><th>Số dư</th><th className="num">Tổng các ví</th><th className="num">Tổng sổ cái</th><th className="num">Chênh lệch</th><th>Kết quả</th></tr></thead>
              <tbody>
                {r.checks.map((c) => (
                  <tr key={c.name}>
                    <td>{CHECK_LABEL[c.name] ?? c.name}</td>
                    <td className="num">{formatVND(c.walletsTotal)}</td>
                    <td className="num">{formatVND(c.ledgerTotal)}</td>
                    <td className={`num${c.ok ? '' : ' fin-bad'}`}>{formatVND(c.walletsTotal - c.ledgerTotal)}</td>
                    <td>{c.ok ? <span className="chip teal"><CheckCircle2 size={13} aria-hidden="true" /> Khớp</span> : <span className="chip red"><AlertTriangle size={13} aria-hidden="true" /> Lệch</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.last_deposit_reconciliation && (
              <p className="muted fin-note">Lần đối soát ký quỹ gần nhất: {r.last_deposit_reconciliation.run_date} — {r.last_deposit_reconciliation.status === 'OK' ? 'đạt' : r.last_deposit_reconciliation.resolved ? 'đã xử lý lệch' : 'ĐANG LỆCH, chưa xử lý'}.</p>
            )}
          </section>

          <div className="fin-two">
            <section className="card fin-card" aria-labelledby="fin-dep">
              <h3 id="fin-dep" className="section-title">Ký quỹ &amp; công nợ</h3>
              <dl className="fin-dl">
                <div><dt>Ký quỹ đang giữ (đối tác lưu ký)</dt><dd>{formatVND(r.deposits_held)}</dd></div>
                <div><dt>Công nợ ký quỹ âm</dt><dd className={r.nurse_deposit_debt > 0 ? 'fin-bad' : ''}>{formatVND(r.nurse_deposit_debt)}</dd></div>
                <div><dt>Phạt ký quỹ trong kỳ</dt><dd>{formatVND(r.deposit_penalties)}</dd></div>
                <div><dt>Hoàn phạt (kháng cáo thành công)</dt><dd>{formatVND(r.deposit_penalty_reversals)}</dd></div>
                <div><dt>Hoàn ký quỹ đã chi</dt><dd>{formatVND(r.deposit_refunds_paid)}</dd></div>
                <div><dt>Hoa hồng tiền mặt chưa nộp</dt><dd>{formatVND(r.cash_commission_unpaid)}</dd></div>
                <div><dt>— trong đó quá hạn 24 giờ</dt><dd className={r.cash_commission_overdue > 0 ? 'fin-bad' : ''}>{formatVND(r.cash_commission_overdue)}</dd></div>
              </dl>
            </section>

            <section className="card fin-card" aria-labelledby="fin-queue">
              <h3 id="fin-queue" className="section-title">Hàng đợi cần xử lý</h3>
              <dl className="fin-dl">
                <div><dt>Yêu cầu rút tiền chờ duyệt</dt><dd>{r.pending_withdrawals_count}</dd></div>
                <div><dt>Yêu cầu hoàn ký quỹ đang mở</dt><dd>{r.pending_deposit_refunds}</dd></div>
                <div><dt>Ca bị giữ quyết toán (lệch escrow)</dt><dd className={r.open_settlement_holds > 0 ? 'fin-bad' : ''}>{r.open_settlement_holds}</dd></div>
                <div><dt>Rút tiền đã chi trong kỳ</dt><dd>{formatVND(r.withdrawals_paid)}</dd></div>
              </dl>
              <p className="muted fin-note">Duyệt/từ chối rút tiền, hoàn ký quỹ và gỡ giữ quyết toán thực hiện qua các API hàng đợi của backend; màn hình xử lý hàng đợi sẽ bổ sung ở bước sau.</p>
            </section>
          </div>

          <section className="card fin-card" aria-labelledby="fin-export">
            <h3 id="fin-export" className="section-title">Xuất báo cáo</h3>
            <p className="muted">Kỳ: <b>{from}</b> → <b>{to}</b> (theo ngày Việt Nam, gồm cả hai đầu).</p>
            <div className="fin-actions">
              <Button onClick={exportLedger} loading={exporting}><Download size={16} aria-hidden="true" /> Xuất sổ cái (CSV)</Button>
              <Button variant="secondary" onClick={exportSummary}><FileSpreadsheet size={16} aria-hidden="true" /> Xuất tóm tắt đối soát (CSV)</Button>
            </div>
            {exportMsg && <Alert tone={exportMsg.tone} title={exportMsg.text} />}
            <p className="muted fin-note">Sổ cái xuất từ máy chủ (tối đa 50.000 dòng) và mỗi lần xuất ghi nhật ký kiểm toán. Ô bắt đầu bằng = + - @ được thêm dấu nháy để chặn chèn công thức vào bảng tính.</p>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
