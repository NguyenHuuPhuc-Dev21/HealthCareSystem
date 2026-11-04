import { useEffect, useRef, useState } from 'react';
import Logo from './Logo.tsx';
import { CTA_LINKS, NAV_LINKS } from '../landing-data';

export default function LandingNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const loginRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
                setLoginOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className={scrolled ? 'nav scrolled' : 'nav'} id="topnav">
            <div className="wrap nav-in">
                <Logo />
                <nav className="nav-links">
                    {NAV_LINKS.map((link) => (
                        <a key={link.href + link.label} href={link.href}>
                            {link.label}
                        </a>
                    ))}
                </nav>
                <div className="nav-cta">
                    <div className="nav-login-wrap" ref={loginRef}>
                        <button
                            type="button"
                            className="nav-login-btn"
                            onClick={() => setLoginOpen((prev) => !prev)}
                            aria-expanded={loginOpen}
                        >
                            Đăng nhập <span className="nav-login-arrow" aria-hidden="true">▾</span>
                        </button>
                        {loginOpen && (
                            <div className="nav-login-dropdown">
                                <a className="nav-login-item" href={CTA_LINKS.nurseApp}>
                                    <span className="nav-login-role">Cổng Điều dưỡng</span>
                                    <small>Đăng nhập tài khoản điều dưỡng</small>
                                </a>
                                <a className="nav-login-item" href={CTA_LINKS.adminApp}>
                                    <span className="nav-login-role">Admin Console</span>
                                    <small>Quản trị viên & thẩm định hồ sơ</small>
                                </a>
                                <div className="nav-login-divider" />
                                <a className="nav-login-item" href={CTA_LINKS.patientApp}>
                                    <span className="nav-login-role">Gia đình / Bệnh nhân</span>
                                    <small>Đặt lịch & quản lý chăm sóc</small>
                                </a>
                            </div>
                        )}
                    </div>
                    <a className="btn btn-primary" href={CTA_LINKS.primaryBooking}>
                        Đặt điều dưỡng ngay
                    </a>
                    <button
                        className="burger"
                        type="button"
                        aria-label="Mở menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        ☰
                    </button>
                </div>
            </div>
            <div className={menuOpen ? 'mobile-menu open' : 'mobile-menu'}>
                {NAV_LINKS.map((link) => (
                    <a key={link.href + link.label} href={link.href} onClick={() => setMenuOpen(false)}>
                        {link.label}
                    </a>
                ))}
                <div className="mobile-login-group">
                    <span className="mobile-login-label">CỔNG ĐĂNG NHẬP</span>
                    <a href={CTA_LINKS.nurseApp} onClick={() => setMenuOpen(false)}>
                        → Đăng nhập Điều dưỡng
                    </a>
                    <a href={CTA_LINKS.adminApp} onClick={() => setMenuOpen(false)}>
                        → Đăng nhập Quản trị viên (Admin)
                    </a>
                    <a href={CTA_LINKS.patientApp} onClick={() => setMenuOpen(false)}>
                        → Đăng nhập Bệnh nhân / Gia đình
                    </a>
                </div>
                <a
                    href={CTA_LINKS.primaryBooking}
                    style={{ color: 'var(--blue)', fontWeight: 700, marginTop: 12 }}
                    onClick={() => setMenuOpen(false)}
                >
                    Đặt điều dưỡng ngay →
                </a>
            </div>
        </header>
    );
}
