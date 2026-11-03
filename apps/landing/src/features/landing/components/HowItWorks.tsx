import { STEPS } from '../landing-data';

export default function HowItWorks() {
    return (
        <section className="how" id="cach-hoat-dong">
            <div className="wrap">
                <div className="reveal">
                    <div className="eyebrow">Cách hoạt động</div>
                    <h2 className="title">Đặt một ca chăm sóc trong 4 bước</h2>
                </div>
                <div className="steps">
                    {STEPS.map((step, index) => (
                        <div className="step reveal" key={step.title}>
                            <div className="n">{index + 1}</div>
                            <h3>{step.title}</h3>
                            <p>{step.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}