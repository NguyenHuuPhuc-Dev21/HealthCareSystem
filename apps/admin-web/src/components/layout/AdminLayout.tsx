import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Lock,
  LogOut,
  Scale,
  ScrollText,
  Settings,
  Siren,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Sidebar Admin Console (M0) — đúng 10 mục, thứ tự đã khoá trong thiết kế A1–A10.
 * Mục chưa có màn hình: `to: null` → hiển thị mờ.
 * Icon: Lucide (nét, đơn sắc) — không dùng emoji. Sidebar thu gọn được;
 * bấm vào logo CareNest để thu gọn / mở rộng; trạng thái nhớ trong localStorage.
 */
const NAV: Array<{ Icon: ComponentType<{ size?: number | string }>; label: string; to: string | null; badgeKey?: 'nurseQueue' }> = [
  { Icon: LayoutDashboard, label: 'Tổng quan', to: null },
  { Icon: ClipboardCheck, label: 'Duyệt hồ sơ', to: '/nurse-verification', badgeKey: 'nurseQueue' },
  { Icon: CalendarDays, label: 'Đặt lịch', to: null },
  { Icon: Scale, label: 'Khiếu nại', to: null },
  { Icon: Wallet, label: 'Tài chính', to: null },
  { Icon: Stethoscope, label: 'Dịch vụ', to: null },
  { Icon: Settings, label: 'Cấu hình', to: null },
  { Icon: Users, label: 'Người dùng', to: null },
  { Icon: Siren, label: 'SOS', to: null },
  { Icon: ScrollText, label: 'Nhật ký', to: null },
];

const COLLAPSE_KEY = 'admin_sidebar_collapsed';

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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      } catch {
        // bỏ qua nếu localStorage không dùng được
      }
      return !prev;
    });
  };

  return (
    <div className={`admin-shell${collapsed ? ' admin-shell--collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Điều hướng Admin">
        <div className="sidebar__brand">
          <button
            type="button"
            className="sidebar__brand-btn"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Bấm vào logo để mở rộng thanh điều hướng' : 'Bấm vào logo để thu gọn thanh điều hướng'}
            title={collapsed ? 'Bấm để mở rộng' : 'Bấm để thu gọn'}
          >
            <LogoMark />
            <span className="sidebar__brand-text">
              <span className="sidebar__brand-name">CareNest</span>
              <small>ADMIN CONSOLE</small>
            </span>
          </button>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((item) => {
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            const content = (
              <>
                <span className="sidebar__icon" aria-hidden="true"><item.Icon size={20} /></span>
                <span className="sidebar__label">{item.label}</span>
                {!!badge && <span className="sidebar__badge">{badge}</span>}
              </>
            );
            if (!item.to) {
              return (
                <span key={item.label} className="sidebar__item is-disabled" aria-disabled="true" title={collapsed ? item.label : 'Đang phát triển'}>
                  {content}
                </span>
              );
            }
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`sidebar__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user" title={collapsed ? fullName ?? 'Admin' : undefined}>
            <span className="avatar" aria-hidden="true">{initialsOf(fullName)}</span>
            <div className="sidebar__user-text">
              <b>{fullName || 'Admin vận hành'}</b>
              <small><Lock size={12} aria-hidden="true" /> Đã bật xác thực 2 lớp (2FA)</small>
            </div>
          </div>
          <button
            type="button"
            className="sidebar__logout"
            onClick={onSignOut}
            title={collapsed ? 'Đăng xuất' : undefined}
            aria-label="Đăng xuất"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="sidebar__logout-text">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
