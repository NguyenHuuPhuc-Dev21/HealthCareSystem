import React from 'react';

export interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      {status}
    </span>
  );
};

