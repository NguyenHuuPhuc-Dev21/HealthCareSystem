import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Alert, Button } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { useAuth } from '../auth';
import { listDisputes } from './disputes.api';
import { CATEGORY_LABEL, STATUS_LABEL } from './disputes.types';
import type { Dispute, StatusFilter } from './disputes.types';
import { rebuttalSla } from './sla';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: Dispute[] };

const TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'ACTIVE', label: 'Cần xử lý' },
  { key: 'OPEN', label: 'Mới mở' },
  { key: 'UNDER_REVIEW', label: 'Đang xem xét' },
  { key: 'RESOLVED', label: 'Đã xử lý' },
  { key: 'ALL', label: 'Tất cả' },
];

const matches = (d: Dispute, f: StatusFilter) =>
  f === 'ALL' || (f === 'ACTIVE' && (d.status === 'OPEN' || d.status === 'UNDER_REVIEW')) || (f === 'RESOLVED' && d.status.startsWith('RESOLVED')) || d.status === f;

/** A4 · Khiếu nại: hàng đợi các khiếu nại của khách/điều dưỡng và khiếu nại phạt ký quỹ; vào từng ca để điều tra và phán quyết. */
export function DisputesPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [tab, setTab] = useState<StatusFilter>('ACTIVE');
  const [search, setSearch] = useState('');

  const fetchList = useCallback(async () => {
    setLoad({ state: 'loading' });
    const res = await listDisputes();
    setLoad(res.success ? { state: 'ready', items: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được danh sách khiếu nại.') });
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const items = load.state === 'ready' ? load.items : [];
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, items.filter((d) => matches(d, t.key)).length])) as Record<StatusFilter, number>, [items]);
  const rows = items.filter((d) => matches(d, tab)).filter((d) => !search.trim() || d.bookingCode.toLowerCase().includes(search.trim().toLowerCase()) || d.description.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <AdminLayout fullName={user?.full_name} onSignOut={signOut}>
      <div className="page-head">
        <h1>Khiếu nại</h1>
        <p>Điều tra và phán quyết khiếu nại của khách hàng, điều dưỡng và kháng cáo khoản phạt ký quỹ. Khi khiếu nại mở, tiền của ca bị đóng băng cho tới khi bạn quyết định.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Lọc khiếu nại">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {load.state === 'ready' && <span className="tab__count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="toolbar__search-wrap">
          <Search size={16} className="toolbar__search-icon" aria-hidden="true" />
          <input className="input toolbar__search" type="search" placeholder="Tìm theo mã ca hoặc nội dung…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm khiếu nại" />
        </div>
      </div>

      <div className="card table-card">
        {load.state === 'loading' && <div className="table-empty">Đang tải…</div>}
        {load.state === 'error' && <div className="table-empty"><Alert title={load.message} /><Button variant="secondary" onClick={fetchList}>Thử lại</Button></div>}
        {load.state === 'ready' && rows.length === 0 && <div className="table-empty">Không có khiếu nại nào trong mục này.</div>}
        {load.state === 'ready' && rows.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Ca</th><th>Loại</th><th>Người mở</th><th>Trạng thái</th><th>Hạn phản hồi</th><th>Mở lúc</th><th aria-label="Thao tác" /></tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const st = STATUS_LABEL[d.status];
                const sla = rebuttalSla(d);
                return (
                  <tr key={d.id} className="row-link" onClick={() => navigate(`/disputes/${d.id}`)}>
                    <td>
                      <b className="cell-title">{d.bookingCode}</b>
                      <div className="cell-sub">{d.description.length > 70 ? `${d.description.slice(0, 70)}…` : d.description}</div>
                    </td>
                    <td>
                      {d.kind === 'PENALTY_APPEAL' ? <span className="chip amber">Kháng cáo phạt ký quỹ</span> : <span className="chip">{CATEGORY_LABEL[d.category]}</span>}
                    </td>
                    <td>{d.openedBy === 'PATIENT' ? 'Khách hàng' : 'Điều dưỡng'}</td>
                    <td><span className={`chip ${st.tone}`}>{st.text}</span></td>
                    <td className={`nowrap age age--${sla.tone}`}>{sla.text}</td>
                    <td className="nowrap">{formatDateTime(d.createdAt)}</td>
                    <td><Button size="sm" variant={d.status === 'OPEN' || d.status === 'UNDER_REVIEW' ? 'primary' : 'secondary'} onClick={(e) => { e.stopPropagation(); navigate(`/disputes/${d.id}`); }}>{d.status.startsWith('RESOLVED') ? 'Xem' : 'Điều tra'}</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="footnote">Quyết định của Admin là cuối cùng và không hoàn tác được; mọi phán quyết ghi nhật ký kiểm toán (RESOLVE_DISPUTE). Chia tỷ lệ một phần (PARTIALLY_SETTLED) chưa nằm trong MVP.</p>
    </AdminLayout>
  );
}
