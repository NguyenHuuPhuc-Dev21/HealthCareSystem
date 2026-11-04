import type { ReactNode } from 'react';
import { LogoMark } from '../../../components/layout/AdminLayout';

/** Nền + thẻ trắng ở giữa màn hình, không navbar (SH1/SH2). */
export function AuthLayout({
  children,
  wide = false,
  secondary,
}: {
  children: ReactNode;
  wide?: boolean;
  secondary?: ReactNode;
}) {
  return (
    <main className="auth-zone">
      <div className={`auth-card${wide ? ' auth-card--wide' : ''}`}>{children}</div>
      {secondary}
    </main>
  );
}

export function BrandMark() {
  return (
    <div className="auth-logo">
      <LogoMark size={56} />
      <div className="auth-logo__name">CareNest</div>
      <div className="auth-logo__tagline">YOUR HOME, OUR CARE</div>
    </div>
  );
}
