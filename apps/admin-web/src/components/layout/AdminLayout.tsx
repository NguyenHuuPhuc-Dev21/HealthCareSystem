import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Sidebar Admin Console (M0) — đúng 10 mục, thứ tự đã khoá trong thiết kế A1–A10.
 * Mục chưa có màn hình: `to: null` → hiển thị mờ.
 */
const NAV: Array<{ icon: string; label: string; to: string | null; badgeKey?: 'nurseQueue' }> = [
  { icon: '📊', label: 'Tổng quan', to: null },
  { icon: '📋', label: 'Duyệt hồ sơ', to: '/nurse-verification', badgeKey: 'nurseQueue' },
  { icon: '📅', label: 'Đặt lịch', to: null },
  { icon: '⚖️', label: 'Khiếu nại', to: null },
  { icon: '💰', label: 'Tài chính', to: null },
  { icon: '🩺', label: 'Dịch vụ', to: null },
  { icon: '⚙️', label: 'Cấu hình', to: null },
  { icon: '👥', label: 'Người dùng', to: null },
  { icon: '🚨', label: 'SOS', to: null },
  { icon: '📜', label: 'Nhật ký', to: null },
];

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

export function initialsOf(fullName?: string | null): string {
  const given = fullName?.trim().split(/\s+/).pop();
  return given ? given.slice(0, 2).toUpperCase() : 'AD';
}

interface AdminLayoutProps {
  fullName?: string | null;
  badges?: { nurseQueue?: number };
  onSignOut: () => void;
  children: ReactNode;
}

export function AdminLayout({ fullName, badges = {}, onSignOut, children }: AdminLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="admin-shell">
      <aside className="sidebar" aria-label="Điều hướng Admin">
        <div className="sidebar__brand">
          <span className="sidebar__logo"><LogoMark />CareNest</span>
          <small>ADMIN CONSOLE</small>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((item) => {
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            const content = (
              <>
                <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
                <span className="sidebar__label">{item.label}</span>
                {!!badge && <span className="sidebar__badge">{badge}</span>}
              </>
            );
            if (!item.to) {
              return (
                <span key={item.label} className="sidebar__item is-disabled" aria-disabled="true" title="Đang phát triển">
                  {content}
                </span>
              );
            }
            const active = pathname.startsWith(item.to);
            return (
              <Link key={item.label} to={item.to} className={`sidebar__item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__user">
          <span className="avatar" aria-hidden="true">{initialsOf(fullName)}</span>
          <div>
            <b>{fullName || 'Admin vận hành'}</b>
            <span>Đã bật xác thực 2 lớp (2FA) 🔒</span>
            <button type="button" className="link-button sidebar__signout" onClick={onSignOut}>Đăng xuất</button>
          </div>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
