import { STORY } from '../landing-data';

export default function CaseStory() {
    return (
        <section>
            <div className="wrap story">
                <div className="reveal">
                    <div className="eyebrow">Ca mẫu minh họa</div>
                    <h2 className="title">Một buổi chiều thay băng, từ đặt ca tới quyết toán</h2>
                    <blockquote>{STORY.quote}</blockquote>
                    <div className="who">
                        {STORY.who}
                        <br />
                        <span style={{ fontSize: 13.5 }}>{STORY.whoNote}</span>
                    </div>
                </div>
                <div className="timeline reveal">
                    {STORY.timeline.map((item) => (
                        <div key={item.time}>
                            <span className="t">{item.time}</span>
                            <p>
                                <b>{item.lead}</b> {item.text}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}