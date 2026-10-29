import React from 'react';

export interface StatusBadgeProps {
  status: string;
  axis?: 'execution' | 'payment' | 'dispute';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, axis = 'execution' }) => {
  return (
    <span className={`badge badge-${axis} badge-${status.toLowerCase()}`}>
      {status}
    </span>
  );
};

