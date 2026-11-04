import { Button } from '../../../components';
import { initialsOf } from '../../../components/layout/SetupLayout';
import { formatDate } from '../../../lib/formatters';
import { MOBILITY_OPTIONS, RELATIONSHIP_OPTIONS } from '../patient-profiles.types';
import type { PatientProfileDto } from '../patient-profiles.types';

interface ProfileCardProps {
  profile: PatientProfileDto;
  selected: boolean;
  onSelect: () => void;
}

export function describeProfile(p: Pick<PatientProfileDto, 'relationship' | 'birth_year' | 'mobility_status'>): string {
  const relation = RELATIONSHIP_OPTIONS.find((o) => o.value === p.relationship)?.label;
  const age = p.birth_year ? `${new Date().getFullYear() - p.birth_year} tuổi` : null;
  const mobility = MOBILITY_OPTIONS.find((o) => o.value === p.mobility_status)?.title;
  return [relation, age, mobility].filter(Boolean).join(' · ');
}

/** Thẻ hồ sơ ở cột trái P13. */
export function ProfileCard({ profile, selected, onSelect }: ProfileCardProps) {
  const consentChip = profile.deletion_requested_at ? (
    <span className="chip red">Đã yêu cầu xoá dữ liệu</span>
  ) : profile.data_consent_accepted ? (
    <span className="chip teal">
      Đã đồng ý xử lý dữ liệu{profile.consent_timestamp ? ` · ${formatDate(profile.consent_timestamp)}` : ''}
    </span>
  ) : (
    <span className="chip amber">Đã rút đồng ý</span>
  );

  return (
    <article className={`card profile-card${selected ? ' profile-card--selected' : ''}`}>
      <div className="profile-card__head">
        <span className="avatar avatar--lg" aria-hidden="true">{initialsOf(profile.full_name)}</span>
        <div>
          <b className="profile-card__name">{profile.full_name}</b>
          <div className="profile-card__meta">{describeProfile(profile)}</div>
        </div>
      </div>
      <div className="profile-card__chips">
        {consentChip}
        {!!profile.booking_count && <span className="chip grey">{profile.booking_count} ca đã đặt</span>}
      </div>
      <Button
        type="button"
        block
        variant={selected ? 'primary' : 'secondary'}
        className="profile-card__btn"
        onClick={onSelect}
        aria-pressed={selected}
      >
        {selected ? 'Đang chỉnh sửa hồ sơ này' : 'Chỉnh sửa'}
      </Button>
    </article>
  );
}
