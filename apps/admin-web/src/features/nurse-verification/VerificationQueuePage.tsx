import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Minus, Search } from 'lucide-react';
import { Alert, Button } from '../../components';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth';
import { getVerificationQueue } from './nurse-verification.api';
import type { QueueItem, QueueQuery, QueueTab } from './nurse-verification.types';
import { TIER_LABEL } from './nurse-verification.types';
import { ageTone, documentsSegments, formatAge, formatShortDateTime, suggestionLabel } from './format';
import { useQueueSummary } from './useQueueSummary';

const TABS: Array<{ key: QueueTab; label: string }> = [
  { key: 'NEW', label: 'Chờ duyệt mới' },
  { key: 'RENEWAL', label: 'Duyệt gia hạn GPHN' },
  { key: 'PROCESSED', label: 'Đã xử lý' },
];

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: QueueItem[] };

/** A2 — Hàng đợi duyệt hồ sơ điều dưỡng. Tab lưu trên URL (?tab=) để F5/back giữ đúng chỗ. */
export function VerificationQueuePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const flash = (location.state as { flash?: string } | null)?.flash;

  const tab = (TABS.find((t) => t.key === searchParams.get('tab'))?.key ?? 'NEW') as QueueTab;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [submitted, setSubmitted] = useState<NonNullable<QueueQuery['submitted']>>('ALL');
  const [docs, setDocs] = useState<NonNullable<QueueQuery['docs']>>('ALL');
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const { summary, total } = useQueueSummary();

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    getVerificationQueue({ tab, q: debounced, submitted, docs }).then((res) => {
      if (cancelled) return;
      setLoad(res.success ? { state: 'ready', items: res.data } : { state: 'error', message: getErrorMessage(res.error) });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, debounced, submitted, docs, reloadKey]);

  const open = (item: QueueItem) => navigate(`/nurse-verification/${item.nurse_id}`, { state: { fromTab: tab } });
  const processed = tab === 'PROCESSED';

  return (
    <AdminLayout fullName={user?.full_name} badges={{ nurseQueue: total }} onSignOut={signOut}>
      <div className="page-head">
        <h1>Duyệt hồ sơ điều dưỡng</h1>
        <p>Đội ngũ vận hành thẩm định CCCD, bằng cấp và GPHN trước khi kích hoạt tài khoản</p>
      </div>

      {flash && <Alert tone="success">{flash}</Alert>}

      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          const count = t.key === 'PROCESSED' ? undefined : summary?.[t.key];
          return (
            <Link
              key={t.key}
              to={`/nurse-verification?tab=${t.key}`}
              replace
              role="tab"
              aria-selected={tab === t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
            >
              {t.label}
              {count !== undefined && <span className="tab__count">{count}</span>}
            </Link>
          );
        })}
      </div>

      <div className="toolbar">
        <div className="toolbar__search-wrap">
          <Search size={16} className="toolbar__search-icon" aria-hidden="true" />
          <input
            className="input toolbar__search"
            type="search"
            placeholder="Tìm theo tên, số điện thoại…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm hồ sơ"
          />
        </div>
        <select className="input toolbar__select" value={submitted} onChange={(e) => setSubmitted(e.target.value as typeof submitted)} aria-label="Lọc thời điểm nộp">
          <option value="ALL">Nộp: mọi thời gian</option>
          <option value="TODAY">Nộp: hôm nay</option>
          <option value="OVER_24H">Quá 24 giờ (ưu tiên)</option>
        </select>
        <select className="input toolbar__select" value={docs} onChange={(e) => setDocs(e.target.value as typeof docs)} aria-label="Lọc giấy tờ">
          <option value="ALL">Giấy tờ: tất cả</option>
          <option value="HAS_GPHN">Có GPHN</option>
          <option value="DEGREE_ONLY">Chỉ bằng tốt nghiệp</option>
          <option value="HAS_RETIREMENT">Có quyết định nghỉ hưu</option>
        </select>
      </div>

      <div className="card table-card">
        {load.state === 'loading' && <div className="table-empty">Đang tải hồ sơ…</div>}
        {load.state === 'error' && (
          <div className="table-empty">
            <Alert title="Không tải được hàng đợi.">{load.message}</Alert>
            <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>
          </div>
        )}
        {load.state === 'ready' && load.items.length === 0 && (
          <div className="table-empty">
            {debounced || submitted !== 'ALL' || docs !== 'ALL' ? 'Không có hồ sơ khớp bộ lọc.' : 'Không còn hồ sơ nào trong mục này.'}
          </div>
        )}
        {load.state === 'ready' && load.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ứng viên</th>
                <th>Điện thoại</th>
                <th>Loại hồ sơ</th>
                <th>Nộp lúc</th>
                <th>Giấy tờ đã nộp</th>
                {processed ? (
                  <>
                    <th>Kết quả</th>
                    <th>Người duyệt</th>
                  </>
                ) : (
                  <>
                    <th>Cấp gợi ý (theo quy tắc)</th>
                    <th>Tuổi hồ sơ</th>
                  </>
                )}
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {load.items.map((item, i) => {
                const age = formatAge(item.submitted_at);
                return (
                  <tr key={item.nurse_id}>
                    <td>
                      <b className="cell-title">{item.full_name}</b>
                      <div className="cell-sub">{item.subtitle}</div>
                    </td>
                    <td className="nowrap">{item.phone_masked}</td>
                    <td>
                      <span className={`chip ${item.request_type === 'RENEWAL' ? 'amber' : ''}`}>
                        {item.request_type === 'RENEWAL' ? 'Gia hạn GPHN' : 'Đăng ký mới'}
                      </span>
                    </td>
                    <td className="nowrap">{formatShortDateTime(item.submitted_at)}</td>
                    <td className="cell-docs">
                      {documentsSegments(item.documents).map((seg, sIdx, arr) => (
                        <span key={seg.label} className="doc-seg">
                          {seg.ok ? <Check size={13} className="text-navy" aria-hidden="true" /> : <Minus size={13} className="text-muted" aria-hidden="true" />}
                          {' '}{seg.label}
                          {sIdx < arr.length - 1 && ' · '}
                        </span>
                      ))}
                    </td>
                    {processed ? (
                      <>
                        <td>
                          {item.review_status === 'APPROVED' ? (
                            <span className="chip teal">Đã duyệt · {item.assigned_tier ? TIER_LABEL[item.assigned_tier] : ''}</span>
                          ) : (
                            <span className="chip red">Từ chối</span>
                          )}
                        </td>
                        <td>
                          <div>{item.reviewed_by_name ?? '—'}</div>
                          {item.reviewed_at && <div className="cell-sub">{formatShortDateTime(item.reviewed_at)}</div>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <span className="chip teal">{suggestionLabel(item.suggested_tier, item.current_tier)}</span>
                          <div className="cell-sub">{item.suggestion_note}</div>
                        </td>
                        <td className={`nowrap age age--${ageTone(age.hours)}`}>{age.text}</td>
                      </>
                    )}
                    <td>
                      <Button size="sm" variant={!processed && i === 0 ? 'primary' : 'secondary'} onClick={() => open(item)}>
                        {processed ? 'Xem' : 'Thẩm định'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!processed && (
        <p className="footnote">
          Quy tắc gợi ý cấp: có GPHN còn hạn và đúng phạm vi → Cấp 2; còn lại → Cấp 1. Gợi ý do hệ thống tính và chỉ để
          tham khảo — quyết định cuối cùng thuộc về Admin và được ghi vào nhật ký kiểm toán.
        </p>
      )}
    </AdminLayout>
  );
}
