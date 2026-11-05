import {
  Accessibility,
  Bed,
  Calendar,
  CheckCircle2,
  Footprints,
  Home,
  Hospital,
  MapPin,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Weight,
} from 'lucide-react';
import { Button } from '../../../components';
import { initialsOf } from '../../../components/layout/SetupLayout';
import { formatDate } from '../../../lib/formatters';
import {
  MOBILITY_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from '../patient-profiles.types';
import type { MobilityStatus, PatientProfileDetail } from '../patient-profiles.types';
import { ConsentRecord, DangerZone } from './DataRightsPanel';

interface ProfileDetailViewProps {
  profile: PatientProfileDetail;
  onEdit: () => void;
  canWithdraw: boolean;
  onWithdraw: () => Promise<string | null>;
  onRequestDelete: () => Promise<string | null>;
}

function renderMobilityIcon(status: MobilityStatus) {
  switch (status) {
    case 'NORMAL':
      return <Footprints size={24} />;
    case 'PARTIAL':
      return <Accessibility size={24} />;
    case 'BEDRIDDEN':
      return <Bed size={24} />;
  }
}

/**
 * Màn hình xem chi tiết hồ sơ bệnh nhân (Read-only Detail View).
 * Cột phải P13 — hiển thị toàn bộ thông tin đã lưu, có nút mở modal Chỉnh sửa.
 */
export function ProfileDetailView({
  profile,
  onEdit,
  canWithdraw,
  onWithdraw,
  onRequestDelete,
}: ProfileDetailViewProps) {
  const relationLabel =
    RELATIONSHIP_OPTIONS.find((o) => o.value === profile.relationship)?.label ?? 'Khác';
  const mobility = MOBILITY_OPTIONS.find((o) => o.value === profile.mobility_status);
  const age = new Date().getFullYear() - profile.birth_year;

  return (
    <div className="profile-detail">
      {/* Thẻ thông tin chính & Nút hành động */}
      <div className="card profile-detail__header">
        <div className="profile-detail__profile-info">
          <span className="avatar avatar--xl" aria-hidden="true">
            {initialsOf(profile.full_name)}
          </span>
          <div className="profile-detail__names">
            <div className="profile-detail__title-row">
              <h2 className="profile-detail__name">{profile.full_name}</h2>
              <span className="relationship-badge">{relationLabel}</span>
            </div>
            <div className="profile-detail__chips">
              {profile.data_consent_accepted ? (
                <span className="chip teal">
                  <CheckCircle2 size={13} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
                  Đã đồng ý xử lý dữ liệu{profile.consent_timestamp ? ` · ${formatDate(profile.consent_timestamp)}` : ''}
                </span>
              ) : (
                <span className="chip amber">Đã rút đồng ý</span>
              )}
              {!!profile.booking_count && (
                <span className="chip grey">{profile.booking_count} ca đã đặt</span>
              )}
            </div>
          </div>
        </div>

        <div className="profile-detail__actions">
          <Button
            type="button"
            variant="primary"
            onClick={onEdit}
            disabled={!profile.data_consent_accepted || !!profile.deletion_requested_at}
          >
            <Pencil size={16} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
            Chỉnh sửa hồ sơ
          </Button>
        </div>
      </div>

      {/* Grid chỉ số sức khỏe & thể trạng */}
      <div className="profile-detail__stat-grid">
        <div className="card stat-card">
          <div className="stat-card__icon-wrap">
            <Calendar size={22} />
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Năm sinh & Tuổi</span>
            <b className="stat-card__value">{profile.birth_year} ({age} tuổi)</b>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__icon-wrap">
            <Weight size={22} />
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Cân nặng</span>
            <b className="stat-card__value">{profile.weight_kg} kg</b>
          </div>
        </div>

        <div className="card stat-card">
          <div className={`stat-card__icon-wrap ${profile.is_infectious ? 'stat-card__icon-wrap--danger' : 'stat-card__icon-wrap--teal'}`}>
            {profile.is_infectious ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div className="stat-card__body">
            <span className="stat-card__label">Bệnh truyền nhiễm</span>
            <b className={`stat-card__value ${profile.is_infectious ? 'text-red' : 'text-teal'}`}>
              {profile.is_infectious ? 'Có nguy cơ (cần bảo hộ)' : 'Không có'}
            </b>
          </div>
        </div>
      </div>

      {/* Mức độ vận động */}
      <div className="card detail-section">
        <h4 className="detail-section__title">Mức độ vận động</h4>
        <div className="mobility-highlight">
          <div className="mobility-highlight__icon">
            {renderMobilityIcon(profile.mobility_status)}
          </div>
          <div className="mobility-highlight__content">
            <b className="mobility-highlight__title">{mobility?.title}</b>
            <p className="mobility-highlight__desc">{mobility?.description}</p>
          </div>
        </div>
      </div>

      {/* Nơi chăm sóc & Địa chỉ */}
      <div className="card detail-section">
        <h4 className="detail-section__title">Nơi chăm sóc & Địa chỉ</h4>
        <div className="location-info">
          <div className="location-info__badge">
            {profile.location_type === 'HOSPITAL' ? (
              <span className="chip grey">
                <Hospital size={15} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
                Tại bệnh viện
              </span>
            ) : (
              <span className="chip teal">
                <Home size={15} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
                Tại nhà riêng
              </span>
            )}
          </div>
          <div className="location-info__address">
            <MapPin size={18} className="location-info__pin" />
            <span className="location-info__text">{profile.address_text}</span>
          </div>
          {profile.lat !== null && profile.lng !== null && (
            <div className="geo-row" style={{ marginTop: 10 }}>
              <span className="gps-chip">
                <span className="gps-dot" /> Đã ghim toạ độ GPS ({profile.lat.toFixed(4)}, {profile.lng.toFixed(4)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tiền sử bệnh & Dị ứng */}
      <div className="card detail-section">
        <h4 className="detail-section__title">Tiền sử bệnh & Dị ứng thuốc</h4>
        <div className="medical-history-box">
          {profile.medical_history ? (
            <p className="medical-history-text">{profile.medical_history}</p>
          ) : (
            <span className="hint">Không có tiền sử bệnh lý đặc biệt.</span>
          )}
        </div>
      </div>

      {/* Quyền dữ liệu NĐ 13 */}
      <div className="card detail-section">
        <h4 className="detail-section__title">Đồng ý & Quyền riêng tư dữ liệu (Nghị định 13/2023)</h4>
        <ConsentRecord profile={profile} />
        <DangerZone
          canWithdraw={canWithdraw}
          onWithdraw={onWithdraw}
          onRequestDelete={onRequestDelete}
        />
      </div>
    </div>
  );
}
