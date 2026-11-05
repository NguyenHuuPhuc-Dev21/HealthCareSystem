import { CTA_LINKS, HERO_POINTS, SAMPLE_SHIFT } from '../landing-data';
import { formatVND } from '../../../lib/formatters';

export default function Hero() {
    return (
        <div className="hero">
            <div className="wrap hero-grid">
                <div>
                    <span className="chip">● Nền tảng điều dưỡng tại nhà · Đang phục vụ tại Đà Nẵng</span>
                    <h1>
                        Điều dưỡng <span className="grad">đã thẩm định</span>, chăm sóc tận nhà cho người thân
                        của bạn
                    </h1>
                    <p className="lead">
                        Đặt ca trong vài phút — thay băng, tiêm truyền theo y lệnh, chăm sóc sau phẫu thuật hay
                        trông nom theo ca. Mọi điều dưỡng đều được kiểm tra chứng chỉ hành nghề trước khi nhận
                        ca đầu tiên.
                    </p>
                    <div className="hero-cta">
                        <a className="btn btn-primary" href={CTA_LINKS.primaryBooking}>
                            Đặt điều dưỡng ngay →
                        </a>
                        <a className="btn btn-ghost" href={CTA_LINKS.nurseApp}>
                            Tôi là điều dưỡng — tìm việc làm
                        </a>
                    </div>
                    <div className="trust-row">
                        {HERO_POINTS.map((point) => (
                            <div key={point.title}>
                                <span className="ic">✓</span>
                                <span>
                                    <b>{point.title}</b> — {point.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="hero-vis" aria-hidden="true">
                    <div className="card card-main float">
                        <div className="row">
                            <div className="avatar">{SAMPLE_SHIFT.nurseInitials}</div>
                            <div>
                                <h3>{SAMPLE_SHIFT.nurse}</h3>
                                <div className="meta">
                                    {SAMPLE_SHIFT.nurseMeta} · <span className="stars">★★★★★</span>{' '}
                                    {SAMPLE_SHIFT.rating}
                                </div>
                            </div>
                        </div>
                        <div className="score">
                            <span className="chip teal">✓ GPHN còn hiệu lực</span>
                            <span className="chip">TrustScore {SAMPLE_SHIFT.trustScore}/100</span>
                            <span className="chip amber">Huy hiệu: Nhân viên y tế hưu trí</span>
                        </div>
                    </div>

                    <div className="card card-book float d2">
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                            <h4>
                                Đơn <span className="mono">{SAMPLE_SHIFT.code}</span>
                            </h4>
                            <span className="chip teal">Đã ghép ca</span>
                        </div>
                        <p style={{ color: 'var(--slate)', fontSize: 15, margin: '8px 0' }}>
                            {SAMPLE_SHIFT.service} · {SAMPLE_SHIFT.area}
                            <br />
                            {SAMPLE_SHIFT.time} · Bệnh nhân: {SAMPLE_SHIFT.patient}
                        </p>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                            <span className="price">{formatVND(SAMPLE_SHIFT.price)}</span>
                            <span className="chip">Tạm giữ an toàn ✓</span>
                        </div>
                    </div>

                    <div className="card card-check float d3">
                        <div className="row">
                            <span className="pulse"></span>
                            <div>
                                <b style={{ color: 'var(--navy)' }}>Đã check-in tại nhà bệnh nhân</b>
                                <div style={{ fontSize: 14, color: 'var(--slate)' }}>
                                    {SAMPLE_SHIFT.checkInProof}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}