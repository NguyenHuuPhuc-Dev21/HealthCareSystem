import { CTA_LINKS } from '../landing-data';

export default function FinalCta() {
    return (
        <section id="dat-ca" style={{ paddingTop: 10 }}>
            <div className="wrap">
                <div className="cta-band reveal">
                    <h2>Người thân của bạn cần chăm sóc ngay hôm nay?</h2>
                    <p>
                        Đăng ký bằng số điện thoại, tạo hồ sơ trong vài phút và đặt ca đầu tiên — điều dưỡng
                        đã thẩm định đang ở gần nhà bạn tại Đà Nẵng.
                    </p>
                    <div className="row">
                        <a className="btn btn-white" href={CTA_LINKS.patientApp}>
                            Đặt điều dưỡng ngay →
                        </a>
                        <a className="btn btn-outline-w" href={CTA_LINKS.nurseSection}>
                            Đăng ký làm điều dưỡng
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}   