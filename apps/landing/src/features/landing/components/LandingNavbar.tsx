import { useEffect, useState } from 'react';
import Logo from './Logo.tsx';
import { CTA_LINKS, NAV_LINKS } from '../landing-data';

export default function LandingNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
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
                    <a className="nav-login" href={CTA_LINKS.patientApp}>
                        Đăng nhập
                    </a>
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
                <a
                    href={CTA_LINKS.patientApp}
                    onClick={() => setMenuOpen(false)}
                >
                    Đăng nhập (gia đình)
                </a>
                <a
                    href={CTA_LINKS.nurseApp}
                    onClick={() => setMenuOpen(false)}
                >
                    Đăng nhập (điều dưỡng)
                </a>
                <a
                    href={CTA_LINKS.primaryBooking}
                    style={{ color: 'var(--blue)', fontWeight: 700 }}
                    onClick={() => setMenuOpen(false)}
                >
                    Đặt điều dưỡng ngay →
                </a>
            </div>
        </header>
    );
}