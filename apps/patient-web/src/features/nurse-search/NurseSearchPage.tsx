import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth';
import { searchNurses, toTimeWindow } from './nurse-search.api';
import { Link } from 'react-router-dom';
import { EMPTY_FILTERS, SERVICE_CATEGORIES } from './nurse-search.types';
import type { NurseSearchFilters, NurseSummary } from './nurse-search.types';
import { NurseCard } from './components/NurseCard';
import { NurseFilters } from './components/NurseFilters';

type Status = 'loading' | 'ready' | 'error';

/**
 * Tìm điều dưỡng (FR-SEARCH-01) — bộ lọc dịch vụ · khu vực · khung giờ · Tier · giới tính.
 * Backend chỉ trả điều dưỡng ACTIVE, đủ ký quỹ, đúng Tier cho dịch vụ và còn lịch trống.
 */
export function NurseSearchPage() {
  const { user, signOut } = useAuth();
  const [filters, setFilters] = useState<NurseSearchFilters>(EMPTY_FILTERS);
  const [items, setItems] = useState<NurseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0); // bỏ kết quả của lượt gọi cũ khi bộ lọc đổi nhanh

  // Chỉ tìm theo khung giờ khi đã nhập đủ; nhập dở thì giữ kết quả theo các bộ lọc còn lại.
  const effective: NurseSearchFilters = toTimeWindow(filters)
    ? filters
    : { ...filters, date: '', startTime: '', durationHours: null };
  const key = JSON.stringify(effective);

  const run = useCallback(async (f: NurseSearchFilters) => {
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    const res = await searchNurses(f);
    if (id !== requestId.current) return;
    if (!res.success) {
      setStatus('error');
      setError(getErrorMessage(res.error, 'Chưa tải được danh sách điều dưỡng. Vui lòng thử lại.'));
      return;
    }
    setItems(res.data.items);
    setTotal(res.data.total);
    setStatus('ready');
  }, []);

  useEffect(() => {
    run(JSON.parse(key) as NurseSearchFilters);
  }, [key, run]);

  const loadMore = async () => {
    setLoadingMore(true);
    const res = await searchNurses(effective, items.length);
    setLoadingMore(false);
    if (!res.success) {
      setError(getErrorMessage(res.error));
      return;
    }
    setItems((prev) => [...prev, ...res.data.items]);
    setTotal(res.data.total);
  };

  const invasiveSelected = SERVICE_CATEGORIES.find((s) => s.code === filters.service)?.group === 'INVASIVE';

  /** Mời trực tiếp: mang theo dịch vụ/khung giờ đang lọc sang luồng đặt ca để khách khỏi nhập lại. */
  const inviteHref = (n: NurseSummary) => {
    const q = new URLSearchParams({ nurseId: n.nurseId, nurseName: n.fullName });
    if (filters.service) q.set('service', filters.service);
    if (toTimeWindow(filters)) {
      q.set('date', filters.date);
      q.set('startTime', filters.startTime);
      if (filters.durationHours) q.set('duration', String(filters.durationHours));
    }
    return `/bookings/new?${q.toString()}`;
  };

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Tìm điều dưỡng</h1>
          <p>Chỉ hiển thị điều dưỡng đã được thẩm định, còn lịch trống và đủ chuyên môn cho dịch vụ bạn chọn.</p>
        </div>
        <Link to="/bookings/new" className="btn btn-secondary">Đặt ca không chọn điều dưỡng</Link>
      </div>

      <div className="ns-layout">
        <NurseFilters value={filters} onChange={setFilters} />

        <section aria-live="polite" aria-busy={status === 'loading'}>
          {error && (
            <Alert title={error}>
              <Button type="button" variant="secondary" size="sm" onClick={() => run(effective)}>Thử lại</Button>
            </Alert>
          )}

          {status === 'loading' && items.length === 0 && <div className="card step-card skeleton">Đang tìm điều dưỡng phù hợp…</div>}

          {status === 'ready' && items.length === 0 && (
            <div className="card step-card text-center">
              <b className="text-navy">Chưa có điều dưỡng phù hợp</b>
              <p className="step-card__sub" style={{ marginTop: 6 }}>
                Thử đổi khung giờ, mở rộng khu vực hoặc bỏ bớt bộ lọc.
              </p>
              <Button type="button" variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Xoá bộ lọc</Button>
            </div>
          )}

          {items.length > 0 && (
            <>
              <p className="ns-count">
                {status === 'loading' ? 'Đang cập nhật…' : `${total} điều dưỡng phù hợp`}
              </p>
              <div className="ns-grid" style={{ opacity: status === 'loading' ? 0.55 : 1 }}>
                {items.map((n) => (
                  <NurseCard
                    key={n.nurseId}
                    nurse={n}
                    inviteHref={inviteHref(n)}
                    inviteBlockedReason={
                      invasiveSelected && n.tier === 'TIER_1_BASIC' ? 'Cấp 1 không thực hiện thủ thuật y tế' : null
                    }
                  />
                ))}
              </div>
              {items.length < total && (
                <div className="step-card__actions" style={{ justifyContent: 'center' }}>
                  <Button type="button" variant="secondary" onClick={loadMore} loading={loadingMore}>Xem thêm</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PatientLayout>
  );
}
