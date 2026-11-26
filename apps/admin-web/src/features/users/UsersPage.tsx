import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Alert, Button, Pagination } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/formatters';
import { useDebounced } from '../../lib/useDebounced';
import { useAuth } from '../auth';
import { UserDetailModal } from './components/UserDetailModal';
import { searchUsers } from './users.api';
import { ROLE_LABEL, STATUS_LABEL, SUSPENDED_REASON_LABEL } from './users.types';
import type { ManagedRole, UserList, UserStatus } from './users.types';

const PAGE = 20;
type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: UserList };

/** A8 · Người dùng (FR-ADMIN-01): tìm kiếm, xem chi tiết, tạm khoá / cấm / kích hoạt lại khách và điều dưỡng. */
export function UsersPage() {
  const { user, signOut } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [role, setRole] = useState<ManagedRole | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => setOffset(0), [q, role, status]);

  const fetchList = useCallback(async () => {
    setLoad((p) => (p.state === 'ready' ? p : { state: 'loading' }));
    const res = await searchUsers({ q, role, status, limit: PAGE, offset });
    setLoad(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được danh sách người dùng.') });
  }, [q, role, status, offset]);

  useEffect(() => {
    fetchList();
  }, [fetchList, key]);

  return (
    <AdminLayout fullName={user?.full_name} onSignOut={signOut}>
      <div className="page-head">
        <h1>Người dùng</h1>
        <p>Tìm khách hàng và điều dưỡng, xem hồ sơ và đổi trạng thái tài khoản. Mọi thay đổi đều ghi nhật ký kiểm toán và gửi lý do cho người dùng.</p>
      </div>

      <div className="toolbar">
        <div className="toolbar__search-wrap">
          <Search size={16} className="toolbar__search-icon" aria-hidden="true" />
          <input className="input toolbar__search" type="search" placeholder="Tên, số điện thoại, email hoặc mã người dùng…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm người dùng" />
        </div>
        <select className="input toolbar__select" value={role} onChange={(e) => setRole(e.target.value as ManagedRole | '')} aria-label="Lọc vai trò">
          <option value="">Mọi vai trò</option>
          <option value="NURSE">Điều dưỡng</option>
          <option value="PATIENT">Khách hàng</option>
        </select>
        <select className="input toolbar__select" value={status} onChange={(e) => setStatus(e.target.value as UserStatus | '')} aria-label="Lọc trạng thái">
          <option value="">Mọi trạng thái</option>
          {(Object.keys(STATUS_LABEL) as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s].text}</option>)}
        </select>
      </div>

      <div className="card table-card">
        {load.state === 'loading' && <div className="table-empty">Đang tải…</div>}
        {load.state === 'error' && <div className="table-empty"><Alert title={load.message} /><Button variant="secondary" onClick={() => setKey((k) => k + 1)}>Thử lại</Button></div>}
        {load.state === 'ready' && load.data.items.length === 0 && <div className="table-empty">Không có người dùng khớp bộ lọc.</div>}
        {load.state === 'ready' && load.data.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Cấp · TrustScore</th><th>Tham gia</th><th aria-label="Thao tác" /></tr>
            </thead>
            <tbody>
              {load.data.items.map((u) => {
                const st = STATUS_LABEL[u.status];
                return (
                  <tr key={u.id}>
                    <td><b className="cell-title">{u.fullName}</b><div className="cell-sub">{u.phone}{u.email ? ` · ${u.email}` : ''}</div></td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td>
                      <span className={`chip ${st.tone}`}>{st.text}</span>
                      {u.suspendedReason && <div className="cell-sub">{SUSPENDED_REASON_LABEL[u.suspendedReason]}</div>}
                    </td>
                    <td className="nowrap">{u.role === 'NURSE' ? `${u.tier === 'TIER_2_SPECIALIST' ? 'Cấp 2' : 'Cấp 1'} · ${u.trustScore ?? '—'}` : '—'}</td>
                    <td className="nowrap">{formatDate(u.createdAt)}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => setOpenId(u.id)}>Chi tiết</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {load.state === 'ready' && <Pagination total={load.data.total} limit={load.data.limit} offset={load.data.offset} onChange={setOffset} />}

      <p className="footnote">Tài khoản Admin không hiện ở đây. Điều dưỡng bị tạm khoá do ký quỹ/hoa hồng/TrustScore chỉ kích hoạt lại được khi điều kiện đã đạt (trừ TrustScore, Admin có thể miễn sau khi xem xét).</p>

      {openId && <UserDetailModal userId={openId} onClose={() => setOpenId(null)} onChanged={() => setKey((k) => k + 1)} />}
    </AdminLayout>
  );
}
