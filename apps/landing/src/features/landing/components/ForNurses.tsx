import { CTA_LINKS, NURSE_EARNINGS, NURSE_POINTS } from '../landing-data';
import { formatVND } from '../../../lib/formatters';

export default function ForNurses() {
    return (
        <section className="nurses" id="dieu-duong">
            <div className="wrap nurse-grid">
                <div className="reveal">
                    <div className="eyebrow" style={{ color: 'var(--sky)' }}>
                        Dành cho điều dưỡng &amp; bác sĩ
                    </div>
                    <h2 className="title">Kinh nghiệm của bạn xứng đáng có thêm thu nhập</h2>
                    <p className="sub">
                        Dù bạn là nhân viên y tế đã nghỉ hưu hay sinh viên điều dưỡng mới ra trường — hãy nhận
                        ca theo lịch rảnh của chính bạn, gần nhà bạn.
                    </p>
                    <div className="nurse-points">
                        {NURSE_POINTS.map((point) => (
                            <div key={point.title}>
                                <span className="ic">✓</span>
                                <div>
                                    <b>{point.title}</b>
                                    <p>{point.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 30, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <a className="btn btn-white" href={CTA_LINKS.nurseApp}>
                            Đăng ký làm điều dưỡng →
                        </a>
                        <a className="btn btn-outline-w" href={CTA_LINKS.faq}>
                            Xem câu hỏi thường gặp
                        </a>
                    </div>
                </div>

                <div className="earn-card reveal">
                    <h3>{NURSE_EARNINGS.title}</h3>
                    {NURSE_EARNINGS.rows.map((row) => (
                        <div className="earn-row" key={row.label}>
                            <span>{row.label}</span>
                            <b>+{formatVND(row.amount)}</b>
                        </div>
                    ))}
                    <div className="earn-row">
                        <span>{NURSE_EARNINGS.depositLabel}</span>
                        <b>{formatVND(NURSE_EARNINGS.deposit)}</b>
                    </div>
                    <div className="earn-row total">
                        <span>Số dư khả dụng</span>
                        <span>{formatVND(NURSE_EARNINGS.total)}</span>
                    </div>
                    <p className="note">{NURSE_EARNINGS.note}</p>
                </div>
            </div>
        </section>
    );
}