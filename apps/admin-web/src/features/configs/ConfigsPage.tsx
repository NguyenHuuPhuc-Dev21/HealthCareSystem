import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Alert, Button } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { useAuth } from '../auth';
import { ConfigEditModal } from './ConfigEditModal';
import { getSystemConfigs } from './configs.api';
import { CRITICAL_KEYS, GROUP_ORDER, displayValue, groupOfKey } from './configs.types';
import type { ConfigItem } from './configs.types';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: ConfigItem[] };

/** A7 · Cấu hình (FR-ADMIN-01): sửa tham số `system_configs` không cần triển khai lại; mọi thay đổi có người sửa và nhật ký kiểm toán. */
export function ConfigsPage() {
  const { user, signOut } = useAuth();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ConfigItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await getSystemConfigs();
    setLoad(res.success ? { state: 'ready', items: res.data.items } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được tham số hệ thống.') });
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const q = search.trim().toLowerCase();
  const groups = useMemo(() => {
    const items = load.state === 'ready' ? load.items.filter((c) => !q || c.key.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)) : [];
    return GROUP_ORDER.map((g) => ({ name: g, rows: items.filter((c) => groupOfKey(c.key) === g) })).filter((g) => g.rows.length > 0);
  }, [load, q]);

  const onSaved = (updated: ConfigItem) => {
    setLoad((p) => (p.state === 'ready' ? { state: 'ready', items: p.items.map((c) => (c.key === updated.key ? updated : c)) } : p));
    setNotice(`Đã cập nhật ${updated.key} = ${displayValue(updated)}.`);
    setEditing(null);
  };

  return (
    <AdminLayout fullName={user?.full_name} onSignOut={signOut}>
      <div className="page-head">
        <h1>Cấu hình hệ thống</h1>
        <p>Các tham số vận hành (hoa hồng, phụ phí, thời hạn, phạt…) nằm ở đây thay vì trong mã nguồn. Thay đổi có hiệu lực ngay và được ghi nhật ký kiểm toán cùng người thực hiện.</p>
      </div>

      {notice && <Alert tone="success" title={notice} />}

      <div className="toolbar">
        <div className="toolbar__search-wrap">
          <Search size={16} className="toolbar__search-icon" aria-hidden="true" />
          <input className="input toolbar__search" type="search" placeholder="Tìm theo tên khoá hoặc mô tả…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm tham số" />
        </div>
      </div>

      {load.state === 'loading' && <div className="card table-card"><div className="table-empty">Đang tải…</div></div>}
      {load.state === 'error' && <Alert title={load.message}><Button size="sm" variant="secondary" onClick={fetchList}>Thử lại</Button></Alert>}
      {load.state === 'ready' && groups.length === 0 && <div className="card table-card"><div className="table-empty">Không có tham số khớp từ khoá.</div></div>}

      {groups.map((g) => (
        <section key={g.name} className="catalog-group" aria-labelledby={`cfg-${g.name}`}>
          <h2 id={`cfg-${g.name}`} className="section-title">{g.name} <span className="chip">{g.rows.length}</span></h2>
          <div className="card table-card">
            <table className="data-table">
              <thead><tr><th>Tham số</th><th className="num">Giá trị</th><th>Cập nhật</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>
                {g.rows.map((c) => (
                  <tr key={c.key}>
                    <td>
                      <code className="cell-title">{c.key}</code>{CRITICAL_KEYS.has(c.key) && <span className="chip amber cfg-crit">Quan trọng</span>}
                      {c.description && <div className="cell-sub">{c.description}</div>}
                    </td>
                    <td className="num nowrap"><b>{displayValue(c)}</b></td>
                    <td className="nowrap">
                      {c.updatedBy ? <>{c.updatedBy.name}<div className="cell-sub">{formatDateTime(c.updatedAt)}</div></> : <span className="muted">Giá trị mặc định</span>}
                    </td>
                    <td><Button size="sm" variant="secondary" onClick={() => { setNotice(null); setEditing(c); }}>Sửa</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="footnote">Không hard-code số nghiệp vụ trong mã: mọi giá trị ở đây được backend đọc lúc chạy. Đổi tham số tài chính/an toàn cần có quyết định của PO.</p>

      {editing && <ConfigEditModal config={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </AdminLayout>
  );
}
