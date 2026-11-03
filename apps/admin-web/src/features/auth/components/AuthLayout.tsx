import type { ReactNode } from 'react';

/** Nền + thẻ trắng ở giữa màn hình, không navbar (SH1/SH2). */
export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="auth-zone">
      <div className={`auth-card${wide ? ' auth-card--wide' : ''}`}>{children}</div>
    </main>
  );
}

export function BrandMark() {
  return (
    <div className="auth-logo">
      <div className="logo-mark" aria-hidden="true">+</div>
      <div className="auth-logo__name">CareNest</div>
    </div>
  );
}
