import React from 'react';

const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: 'Chờ duyệt hồ sơ',
  PENDING: 'Đang chờ duyệt',
  APPROVED: 'Đã duyệt',
  ACTIVE: 'Đang hoạt động',
  REJECTED: 'Bị từ chối',
  SUSPENDED: 'Tạm khóa',
  BANNED: 'Đã khóa vĩnh viễn',
  TIER_1_BASIC: 'Hạng Cơ bản (Cấp 1)',
  TIER_2_SPECIALIST: 'Hạng Chuyên môn (Cấp 2)',
};

export interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toUpperCase();
  const label = STATUS_LABELS[normalized] ?? status;
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      {label}
    </span>
  );
};

