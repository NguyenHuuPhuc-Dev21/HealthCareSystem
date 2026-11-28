import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Alert, Button } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatVND } from '../../lib/formatters';
import { useAuth } from '../auth';
import { getServiceCategories } from './catalog.api';
import { GROUP_INFO, TIER_LABEL, TYPE_LABEL, UNIT_LABEL, groupOf } from './catalog.types';
import type { ServiceCategory, ServiceGroup } from './catalog.types';
import { ServiceFormModal } from './ServiceFormModal';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: ServiceCategory[] };

const GROUPS: ServiceGroup[] = ['NON_INVASIVE', 'INVASIVE', 'PROHIBITED'];

/** A6 · Dịch vụ (FR-ADMIN-01): danh mục theo 3 nhóm BR-15, giá cơ bản, cờ xâm lấn/cấm và cấp yêu cầu. */
export function CatalogPage() {
  const { user, signOut } = useAuth();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(true);
  const [editing, setEditing] = useState<ServiceCategory | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await getServiceCategories();
    setLoad(res.success ? { state: 'ready', items: res.data.items } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được danh mục dịch vụ.') });
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const q = search.trim().toLowerCase();
  const items = load.state === 'ready' ? load.items.filter((s) => (showHidden || s.isActive) && (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))) : [];

  return (
    <AdminLayout fullName={user?.full_name} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Dịch vụ</h1>
          <p>Quản lý danh mục, giá cơ bản và điều kiện thực hiện. Cờ xâm lấn/cấm quyết định ai được nhận ca và dịch vụ có đặt được hay không.</p>
        </div>
        <Button onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> Thêm dịch vụ</Button>
      </div>

      {notice && <Alert tone="success" title={notice} />}

      <div className="toolbar">
        <div className="toolbar__search-wrap">
          <Search size={16} className="toolbar__search-icon" aria-hidden="true" />
          <input className="input toolbar__search" type="search" placeholder="Tìm theo tên hoặc mã dịch vụ…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm dịch vụ" />
        </div>
        <label className="toolbar__check"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Hiện cả dịch vụ đã ẩn</label>
      </div>

      {load.state === 'loading' && <div className="card table-card"><div className="table-empty">Đang tải…</div></div>}
      {load.state === 'error' && <Alert title={load.message}><Button size="sm" variant="secondary" onClick={fetchList}>Thử lại</Button></Alert>}

      {load.state === 'ready' && GROUPS.map((g) => {
        const rows = items.filter((s) => groupOf(s) === g);
        const info = GROUP_INFO[g];
        return (
          <section key={g} className="catalog-group" aria-labelledby={`grp-${g}`}>
            <h2 id={`grp-${g}`} className="section-title">{info.title} <span className={`chip ${info.tone}`}>{rows.length}</span></h2>
            <p className="muted">{info.description}</p>
            <div className="card table-card">
              {rows.length === 0 ? <div className="table-empty">Chưa có dịch vụ nào.</div> : (
                <table className="data-table">
                  <thead><tr><th>Dịch vụ</th><th>Loại</th><th className="num">Giá cơ bản</th><th>Cấp yêu cầu</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id} className={s.isActive ? '' : 'row-muted'}>
                        <td><b className="cell-title">{s.name}</b><div className="cell-sub"><code>{s.code}</code></div></td>
                        <td>{TYPE_LABEL[s.serviceType]}</td>
                        <td className="num nowrap">{g === 'PROHIBITED' ? '—' : `${formatVND(s.basePrice)} / ${UNIT_LABEL[s.unit]}`}</td>
                        <td>{TIER_LABEL[s.requiredTier]}</td>
                        <td>
                          {s.isProhibited ? <span className="chip red">Cấm đặt</span> : s.isActive ? <span className="chip teal">Đang bán</span> : <span className="chip grey">Đã ẩn</span>}
                          {s.isInvasive && !s.isProhibited && <span className="chip amber">Cần y lệnh</span>}
                        </td>
                        <td><Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Sửa</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        );
      })}

      <p className="footnote">Không có xoá cứng: dịch vụ đã từng được đặt chỉ có thể ẩn. Giá thay đổi chỉ áp dụng cho đặt chỗ mới. Mọi thay đổi ghi nhật ký kiểm toán.</p>

      {editing && (
        <ServiceFormModal
          service={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setNotice(editing === 'new' ? 'Đã tạo dịch vụ mới.' : 'Đã lưu thay đổi dịch vụ.');
            setEditing(null);
            fetchList();
          }}
        />
      )}
    </AdminLayout>
  );
}
