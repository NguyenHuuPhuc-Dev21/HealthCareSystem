import Logo from './Logo';
import { FOOTER_COLS } from '../landing-data';

export default function LandingFooter() {
    return (
        <footer>
            <div className="wrap">
                <div className="foot-grid">
                    <div>
                        <Logo onDark />
                        <p style={{ marginTop: 14, fontSize: 15, maxWidth: 300 }}>
                            Nền tảng kết nối bệnh nhân, gia đình với điều dưỡng độc lập đã thẩm định — chăm sóc
                            tận nhà và tại bệnh viện, minh bạch từ giá cả tới quyết toán.
                        </p>
                    </div>
                    {FOOTER_COLS.map((col) => (
                        <div key={col.heading}>
                            <h4>{col.heading}</h4>
                            {col.links.map((link) => (
                                <a key={link.label} href={link.href}>
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="foot-bottom">
                    <span>© 2026 CareNest · Đà Nẵng, Việt Nam</span>
                    <span>Hỗ trợ: mục “Hỗ trợ” ngay trong ứng dụng · Khẩn cấp y tế: gọi 115</span>
                </div>
            </div>
        </footer>
    );
}