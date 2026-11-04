import React from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface AlertProps {
  tone?: 'error' | 'info' | 'success';
  title?: React.ReactNode;
  children?: React.ReactNode;
}

const ICON: Record<NonNullable<AlertProps['tone']>, ReactNode> = {
  error: <AlertTriangle size={17} />,
  info: <Info size={17} />,
  success: <CheckCircle2 size={17} />,
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
