import type { ReactNode } from 'react';

/** "Nguyễn Văn An" → "AN" (2 chữ đầu của tên — giống avatar trong thiết kế). */
export function initialsOf(fullName?: string | null): string {
  const given = fullName?.trim().split(/\s+/).pop();
  return given ? given.slice(0, 2).toUpperCase() : 'KH';
}

export function LogoMark({ size = 33 }: { size?: number }) {
  return (
    <span className="logo-mark logo-mark--sm" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 32 32">
        <path d="M5 14 L16 5 L27 14" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 20.5 Q16 25.5 23.5 20.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="14.9" y="12.6" width="2.2" height="7" fill="#fff" />
        <rect x="12.5" y="15" width="7" height="2.2" fill="#fff" />
      </svg>
    </span>
  );
}

interface SetupLayoutProps {
  fullName?: string | null;
  onSignOut: () => void;
  children: ReactNode;
}

/** Navbar biến thể SETUP (NAV-0): chỉ logo + chip trạng thái + avatar. Dùng cho SH3. */
export function SetupLayout({ fullName, onSignOut, children }: SetupLayoutProps) {
  return (
    <div className="app-shell">
      <header className="navbar">
        <span className="navbar__logo"><LogoMark />CareNest</span>
        <div className="navbar__right">
          <span className="chip">Đang thiết lập tài khoản</span>
          <button type="button" className="link-button navbar__signout" onClick={onSignOut}>Đăng xuất</button>
          <span className="avatar" aria-hidden="true">{initialsOf(fullName)}</span>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
