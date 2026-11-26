import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell,
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeft,
  ShieldCheck,
  Stethoscope,
  User,
  UserRound,
  X,
} from 'lucide-react';
import { maskPhone } from '../../lib/phone';
import { SosBanner } from '../../features/sos/SosBanner';
import { useNotifications } from '../../features/notifications/NotificationProvider';
import { initialsOf, LogoMark } from './SetupLayout';

/**
 * Sidebar dọc Patient (NAV-0): logo · 5 mục điều hướng · chuông · avatar + menu.
 * Có nút thu gọn/mở rộng (nhớ lựa chọn); trên điện thoại sidebar là ngăn kéo mở bằng nút ☰.
 * Mục chưa có màn hình thì để `to: null` → hiển thị mờ, chưa bấm được.
 */
const NAV_ITEMS: Array<{ label: string; icon: ReactNode; to: string | null; match?: string[] }> = [
  { label: 'Trang chủ', icon: <Home size={20} />, to: '/' },
  { label: 'Dịch vụ', icon: <Stethoscope size={20} />, to: '/nurses', match: ['/nurses'] },
  { label: 'Đơn của tôi', icon: <ClipboardList size={20} />, to: '/bookings', match: ['/bookings', '/refunds', '/disputes'] },
  { label: 'Tin nhắn', icon: <MessageSquare size={20} />, to: null },
  { label: 'Tài khoản', icon: <UserRound size={20} />, to: '/patient-profiles', match: ['/patient-profiles'] },
];

const MENU_ITEMS: Array<{ icon: ReactNode; label: string; to: string | null }> = [
  { icon: <User size={16} />, label: 'Hồ sơ cá nhân', to: null },
  { icon: <Stethoscope size={16} />, label: 'Hồ sơ người được chăm sóc', to: '/patient-profiles' },
  { icon: <CreditCard size={16} />, label: 'Thanh toán của tôi', to: null },
  { icon: <Bell size={16} />, label: 'Thông báo', to: '/notifications' },
  { icon: <ShieldCheck size={16} />, label: 'Quyền riêng tư & dữ liệu', to: null },
  { icon: <MessageSquare size={16} />, label: 'Hỗ trợ', to: null },
];

const COLLAPSE_KEY = 'patient-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

interface PatientLayoutProps {
  fullName?: string | null;
  phone?: string | null;
  onSignOut: () => void;
  children: ReactNode;
}

export function PatientLayout({ fullName, phone, onSignOut, children }: PatientLayoutProps) {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false); // chỉ dùng trên điện thoại
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = fullName || 'Tài khoản của tôi';

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* localStorage bị chặn — bỏ qua */
      }
      return !c;
    });
    setMenuOpen(false);
  };

  // Đóng menu avatar khi bấm ra ngoài / nhấn Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Đóng ngăn kéo / menu khi chuyển trang
  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
  }, [location.pathname]);

  // Esc đóng ngăn kéo trên điện thoại
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.to === location.pathname || (item.match ?? []).some((m) => location.pathname.startsWith(m));

  const shellClass = ['side-shell', collapsed ? 'is-collapsed' : '', drawerOpen ? 'is-drawer-open' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      {/* Thanh trên cùng — chỉ hiện trên điện thoại */}
      <div className="mobile-bar">
        <button type="button" className="icon-btn" aria-label="Mở menu" onClick={() => setDrawerOpen(true)}>
          <Menu size={22} />
        </button>
        <Link to="/" className="navbar__logo"><LogoMark />CareNest</Link>
      </div>

      {drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <aside className="sidebar" id="patient-sidebar" aria-label="Thanh điều hướng">
        <div className="sidebar__head">
          <Link to="/" className="navbar__logo" title="CareNest — Trang chủ">
            <LogoMark />
            <span className="sidebar__label">CareNest</span>
          </Link>
          <button
            type="button"
            className="icon-btn sidebar__toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-expanded={!collapsed}
            aria-controls="patient-sidebar"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <PanelLeft size={20} />
          </button>
          <button type="button" className="icon-btn sidebar__close" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)}>
            <X size={22} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className={isActive(item) ? 'active' : undefined}
                aria-current={isActive(item) ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
                <span className="sidebar__label">{item.label}</span>
              </Link>
            ) : (
              <span key={item.label} className="is-disabled" aria-disabled="true" title="Đang phát triển">
                <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
                <span className="sidebar__label">{item.label}</span>
              </span>
            )
          )}
        </nav>

        <div className="sidebar__foot" ref={menuRef}>
          {/* TODO: số thông báo chưa đọc — làm ở Phase 6 (notifications) */}
          <Link
            to="/notifications"
            className={`sidebar__bell${location.pathname.startsWith('/notifications') ? ' active' : ''}`}
            aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
            aria-current={location.pathname.startsWith('/notifications') ? 'page' : undefined}
            title={collapsed ? 'Thông báo' : undefined}
          >
            <span className="sidebar__icon bell-wrap" aria-hidden="true">
              <Bell size={20} />
              {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </span>
            <span className="sidebar__label">Thông báo</span>
          </Link>

          <button
            type="button"
            className="userblock"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            title={collapsed ? displayName : undefined}
          >
            <span className="avatar" aria-hidden="true">{initialsOf(fullName)}</span>
            <span className="userblock__name sidebar__label">{displayName}</span>
          </button>

          {menuOpen && (
            <div className="avatar-menu avatar-menu--side" role="menu">
              <div className="avatar-menu__head">
                <span className="avatar avatar--lg" aria-hidden="true">{initialsOf(fullName)}</span>
                <div>
                  <b>{displayName}</b>
                  {phone && <span>{maskPhone(phone)}</span>}
                </div>
              </div>
              {MENU_ITEMS.map((m) =>
                m.to ? (
                  <Link key={m.label} to={m.to} role="menuitem">
                    <span className="mi" aria-hidden="true">{m.icon}</span>{m.label}
                  </Link>
                ) : (
                  <span key={m.label} className="is-disabled" role="menuitem" aria-disabled="true">
                    <span className="mi" aria-hidden="true">{m.icon}</span>{m.label}
                  </span>
                )
              )}
              <div className="avatar-menu__divider" />
              <button type="button" role="menuitem" className="avatar-menu__logout" onClick={onSignOut}>
                <span className="mi" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}><LogOut size={16} /></span>Đăng xuất
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="page page--wide side-main">
        <SosBanner />
        {children}
      </main>
    </div>
  );
}
