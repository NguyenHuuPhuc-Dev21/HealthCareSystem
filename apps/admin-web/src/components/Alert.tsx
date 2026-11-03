import React from 'react';

export interface AlertProps {
  tone?: 'error' | 'info' | 'success';
  title?: React.ReactNode;
  children?: React.ReactNode;
}

const ICON: Record<NonNullable<AlertProps['tone']>, string> = {
  error: '⚠️',
  info: 'ⓘ',
  success: '✓',
};

export const Alert: React.FC<AlertProps> = ({ tone = 'error', title, children }) => (
  <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span aria-hidden="true">{ICON[tone]}</span>
    <span>
      {title && <b>{title}</b>}
      {title && children && <br />}
      {children}
    </span>
  </div>
);
