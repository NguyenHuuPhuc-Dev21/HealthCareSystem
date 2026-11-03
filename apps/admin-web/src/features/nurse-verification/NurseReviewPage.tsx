import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { AdminLayout, initialsOf } from '../../components/layout/AdminLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { useAuth } from '../auth';
import { getNurseReview, verifyNurse } from './nurse-verification.api';
import type { NurseReviewDetail, ReviewStatus, VerifyNurseRequest } from './nurse-verification.types';
import { TIER_LABEL } from './nurse-verification.types';
import { DecisionPanel } from './components/DecisionPanel';
import { DocumentViewer } from './components/DocumentViewer';
import { formatPlainDate } from './format';
import { useQueueSummary } from './useQueueSummary';
import { CreditCard, GraduationCap, Medal } from 'lucide-react';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: NurseReviewDetail };

const STATUS_CHIP: Record<ReviewStatus, { cls: string; text: string }> = {
  PENDING: { cls: 'amber', text: 'Trạng thái: Chờ duyệt' },
  APPROVED: { cls: 'teal', text: 'Trạng thái: Đã duyệt' },
  REJECTED: { cls: 'red', text: 'Trạng thái: Đã từ chối' },
};

const CRED_CHIP: Record<ReviewStatus, { cls: string; text: string }> = {
  PENDING: { cls: 'grey', text: 'Chờ đối chiếu' },
  APPROVED: { cls: 'teal', text: 'Đã duyệt' },
  REJECTED: { cls: 'red', text: 'Không đạt' },
};

/** A3 — Chi tiết duyệt hồ sơ & gán Tier. */
export function NurseReviewPage() {
  const { nurseId = '' } = useParams<{ nurseId: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromTab = (location.state as { fromTab?: string } | null)?.fromTab ?? 'NEW';
  const { total, refresh: refreshSummary } = useQueueSummary();

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoad({ state: 'loading' });
    const res = await getNurseReview(nurseId);
    setLoad(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error) });
  }, [nurseId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDecision = async (payload: VerifyNurseRequest) => {
    if (load.state !== 'ready') return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await verifyNurse(nurseId, payload);
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(getErrorMessage(res.error, 'Chưa lưu được quyết định. Vui lòng thử lại.'));
      return;
    }
    refreshSummary();
    const name = load.data.full_name;
    const flash =
      payload.decision === 'APPROVED'
        ? `Đã duyệt hồ sơ ${name}${res.data.assigned_tier ? ` · ${TIER_LABEL[res.data.assigned_tier]}` : ''}.`
        : `Đã từ chối hồ sơ ${name}. Ứng viên sẽ nhận thông báo kèm lý do.`;
    navigate(`/nurse-verification?tab=${fromTab}`, { state: { flash } });
  };

  const backLink = <Link to={`/nurse-verification?tab=${fromTab}`}>← Hàng đợi duyệt hồ sơ</Link>;

  if (load.state !== 'ready') {
    return (
      <AdminLayout fullName={user?.full_name} badges={{ nurseQueue: total }} onSignOut={signOut}>
        <p className="crumb">{backLink}</p>
        {load.state === 'loading' ? (
          <div className="card step-card skeleton">Đang tải hồ sơ…</div>
        ) : (
          <div className="card step-card">
            <Alert title="Không tải được hồ sơ.">{load.message}</Alert>
            <Button variant="secondary" onClick={fetchDetail}>Thử lại</Button>
          </div>
        )}
      </AdminLayout>
    );
  }

  const d = load.data;
  const status = STATUS_CHIP[d.review_status];
  const credOf = (type: string) => d.credentials.find((c) => c.doc_type === type);
  const cccdStatus = credOf('CCCD_FRONT')?.verification_status ?? 'PENDING';
  const degreeStatus = credOf('DEGREE')?.verification_status ?? 'PENDING';

  return (
    <AdminLayout fullName={user?.full_name} badges={{ nurseQueue: total }} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Thẩm định hồ sơ · {d.full_name}</h1>
          <p className="crumb">
            {backLink} · Nộp lúc {formatDateTime(d.submitted_at)} · Loại: {d.request_type === 'RENEWAL' ? 'Gia hạn GPHN' : 'Đăng ký mới'}
          </p>
        </div>
        <span className={`chip ${status.cls}`}>{status.text}</span>
      </div>

      {/* Thông tin ứng viên */}
      <div className="card applicant">
        <span className="avatar avatar--xl" aria-hidden="true">{initialsOf(d.full_name)}</span>
        <div className="applicant__info">
          <b>{d.full_name}</b>
          <p>
            {[d.phone_masked, d.address, d.years_of_exp !== null ? `${d.years_of_exp} năm kinh nghiệm điều dưỡng` : null, d.cccd_number_masked && `CCCD ${d.cccd_number_masked}`]
              .filter(Boolean)
              .join(' · ')}
            {d.current_tier && <> · Hiện tại: <b>{TIER_LABEL[d.current_tier]}</b></>}
          </p>
        </div>
        <span className="chip teal">Gợi ý theo quy tắc: {TIER_LABEL[d.suggested_tier]} ({d.suggestion_reason})</span>
      </div>

      {/* GPHN + trình xem giấy tờ */}
      <h2 className="section-title">Giấy phép hành nghề (GPHN) — tài liệu quyết định cấp bậc</h2>
      <div className="review-grid">
        <div className="card review-grid__viewer">
          <DocumentViewer nurseId={d.nurse_id} credentials={d.credentials} initialDocType={d.gphn ? 'GPHN' : 'CCCD_FRONT'} />
        </div>
        <div className="card info-table">
          <h3>Thông tin trên giấy phép</h3>
          {d.gphn ? (
            <dl>
              <div><dt>Số GPHN</dt><dd>{d.gphn.number}</dd></div>
              <div><dt>Cơ quan cấp</dt><dd>{d.gphn.issuer}</dd></div>
              <div><dt>Ngày cấp</dt><dd>{formatPlainDate(d.gphn.issued_date)}</dd></div>
              <div><dt>Ngày hết hạn</dt><dd>{formatPlainDate(d.gphn.expiry_date)}</dd></div>
              <div>
                <dt>Hiệu lực</dt>
                <dd>
                  {d.gphn.is_valid ? (
                    <span className="chip teal">Còn hạn{d.gphn.days_remaining !== null ? ` ${d.gphn.days_remaining} ngày` : ''}</span>
                  ) : (
                    <span className="chip red">Đã hết hạn</span>
                  )}
                </dd>
              </div>
              <div><dt>Phạm vi chuyên môn</dt><dd>{d.gphn.scope_of_practice}</dd></div>
              <div>
                <dt>Đối chiếu với CCCD</dt>
                <dd>
                  {d.gphn.identity_match === null ? (
                    <span className="chip grey">Admin tự đối chiếu</span>
                  ) : d.gphn.identity_match ? (
                    <span className="chip teal">Khớp họ tên & ngày sinh</span>
                  ) : (
                    <span className="chip red">Không khớp — kiểm tra kỹ</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Ứng viên chưa nộp GPHN — chỉ có thể gán Cấp 1 (dịch vụ không xâm lấn).</p>
          )}
        </div>
      </div>

      {/* 3 thẻ giấy tờ còn lại */}
      <div className="doc-cards">
        <div className="card doc-card">
          <span className="doc-card__icon" aria-hidden="true"><CreditCard size={20} /></span>
          <div>
            <b>CCCD (2 mặt)</b>
            <p>{d.cccd_number_masked ?? '—'}</p>
            <span className={`chip ${CRED_CHIP[cccdStatus].cls}`}>{CRED_CHIP[cccdStatus].text}</span>
          </div>
        </div>
        <div className="card doc-card">
          <span className="doc-card__icon" aria-hidden="true"><GraduationCap size={20} /></span>
          <div>
            <b>Bằng tốt nghiệp</b>
            <p>{d.degree ? [d.degree.title, d.degree.year].filter(Boolean).join(' · ') : 'Không nộp'}</p>
            {d.degree && <span className={`chip ${CRED_CHIP[degreeStatus].cls}`}>{CRED_CHIP[degreeStatus].text}</span>}
          </div>
        </div>
        <div className="card doc-card">
          <span className="doc-card__icon" aria-hidden="true"><Medal size={20} /></span>
          <div>
            <b>Quyết định nghỉ hưu</b>
            <p>{d.retirement_submitted ? 'Đã nộp' : 'Không nộp'}</p>
            <span className={`chip ${d.retirement_submitted ? 'teal' : 'grey'}`}>
              {d.retirement_submitted ? 'Gắn huy hiệu hưu trí' : 'Không có huy hiệu hưu trí'}
            </span>
          </div>
        </div>
      </div>

      {/* Quyết định */}
      {d.review_status === 'PENDING' ? (
        <DecisionPanel detail={d} submitting={submitting} error={submitError} onSubmit={handleDecision} />
      ) : (
        <section className="card decision">
          <h3 className="decision__title">Kết quả thẩm định</h3>
          <p>
            {d.review_status === 'APPROVED' ? (
              <>Đã duyệt{d.assigned_tier && <> · gán <b>{TIER_LABEL[d.assigned_tier]}</b></>}</>
            ) : (
              <>Đã từ chối{d.rejection_reason && <> — lý do: “{d.rejection_reason}”</>}</>
            )}
          </p>
          <p className="muted">
            Người duyệt: {d.reviewed_by_name ?? '—'}{d.reviewed_at && <> · {formatDateTime(d.reviewed_at)}</>}
          </p>
        </section>
      )}
    </AdminLayout>
  );
}
