import { Award, BadgeCheck, MapPin, Send, ShieldCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { initialsOf } from '../../../components/layout/SetupLayout';
import type { NurseSummary } from '../nurse-search.types';

/** Nhãn Tier hiển thị cho khách (BR-21). */
export const TIER_LABEL: Record<NurseSummary['tier'], string> = {
  TIER_1_BASIC: 'Cấp 1 · Chăm sóc cơ bản',
  TIER_2_SPECIALIST: 'Cấp 2 · Chuyên môn',
};

/** Điểm tin cậy → màu chip: ≥ 90 tốt, 75–89 khá, còn lại cần lưu ý. */
function trustTone(score: number): 'teal' | '' | 'amber' {
  if (score >= 90) return 'teal';
  if (score >= 75) return '';
  return 'amber';
}

interface NurseCardProps {
  nurse: NurseSummary;
  /** Đường dẫn mở luồng đặt ca với lời mời trực tiếp tới điều dưỡng này; không có thì ẩn nút. */
  inviteHref?: string;
  /** Lý do không mời được (vd. Cấp 1 không làm thủ thuật) */
  inviteBlockedReason?: string | null;
}

/** Thẻ tóm tắt điều dưỡng: TrustScore, điểm đánh giá, kinh nghiệm đã xác thực, huy hiệu hưu trí. */
export function NurseCard({ nurse, inviteHref, inviteBlockedReason }: NurseCardProps) {
  const rating = nurse.ratingAvg !== null ? nurse.ratingAvg.toFixed(1).replace('.', ',') : null;

  return (
    <article className="card ns-card" aria-label={`Điều dưỡng ${nurse.fullName}`}>
      <header className="ns-card__head">
        <div className="avatar avatar--lg" aria-hidden="true">
          {nurse.avatarUrl ? <img src={nurse.avatarUrl} alt="" /> : initialsOf(nurse.fullName)}
        </div>
        <div className="ns-card__who">
          <h3>
            {nurse.fullName}
            <span className="ns-verified" title="Hồ sơ đã được Admin thẩm định">
              <BadgeCheck size={17} aria-label="Đã thẩm định" />
            </span>
          </h3>
          <span className={`chip ${nurse.tier === 'TIER_2_SPECIALIST' ? 'teal' : ''}`}>
            <ShieldCheck size={14} aria-hidden="true" /> {TIER_LABEL[nurse.tier]}
          </span>
        </div>
      </header>

      {nurse.isRetiredStaff && (
        <div className="ns-honor" role="note">
          <Award size={16} aria-hidden="true" /> Chuyên gia hưu trí giàu kinh nghiệm
        </div>
      )}

      <dl className="ns-stats">
        <div>
          <dt>Điểm tin cậy</dt>
          <dd>
            <span className={`chip ${trustTone(nurse.trustScore)}`}>{nurse.trustScore}/100</span>
          </dd>
        </div>
        <div>
          <dt>Đánh giá</dt>
          <dd>
            {rating ? (
              <>
                <Star size={15} className="ns-star" aria-hidden="true" /> <b>{rating}</b>
                <span className="ns-muted"> ({nurse.ratingCount})</span>
              </>
            ) : (
              <span className="ns-muted">Chưa có đánh giá</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Kinh nghiệm</dt>
          <dd>
            <b>{nurse.yearsExperience}</b> năm
            <span className="ns-muted"> · {nurse.completedShifts} ca</span>
          </dd>
        </div>
      </dl>

      <p className="ns-card__bio">{nurse.bio}</p>

      <footer className="ns-card__foot">
        <span className="ns-muted">
          <MapPin size={14} aria-hidden="true" /> {nurse.districts.join(', ')}
          {nurse.distanceKm != null && ` · ${nurse.distanceKm.toFixed(1).replace('.', ',')} km`}
        </span>
        {inviteHref && (
          inviteBlockedReason ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled title={inviteBlockedReason}>
              <Send size={14} aria-hidden="true" /> Mời điều dưỡng này
            </button>
          ) : (
            <Link to={inviteHref} className="btn btn-primary btn-sm">
              <Send size={14} aria-hidden="true" /> Mời điều dưỡng này
            </Link>
          )
        )}
        {inviteBlockedReason && <small className="ns-muted">{inviteBlockedReason}</small>}
      </footer>
    </article>
  );
}
