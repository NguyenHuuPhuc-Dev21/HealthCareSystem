import { useState } from 'react';
import { FAQS } from '../landing-data';

export default function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section id="faq" style={{ paddingTop: 20 }}>
            <div className="wrap">
                <div className="reveal" style={{ textAlign: 'center' }}>
                    <div className="eyebrow">Giải đáp</div>
                    <h2 className="title">Câu hỏi thường gặp</h2>
                </div>
                <div className="faq">
                    {FAQS.map((item, index) => {
                        const open = openIndex === index;
                        return (
                            <div className={open ? 'faq-item open' : 'faq-item'} key={item.question}>
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => setOpenIndex(open ? null : index)}
                                >
                                    {item.question}
                                    <span className="arr">+</span>
                                </button>
                                <div className="ans">
                                    <p>{item.answer}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}