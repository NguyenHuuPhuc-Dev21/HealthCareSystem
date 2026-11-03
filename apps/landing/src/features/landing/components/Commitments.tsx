import { COMMITMENTS } from '../landing-data';

export default function Commitments() {
    return (
        <div className="commits">
            <div className="wrap commits-grid">
                <div className="cap">
                    Cam kết vận hành — ghi trong quy tắc nền tảng, không phải khẩu hiệu
                </div>
                {COMMITMENTS.map((item) => (
                    <div className="commit" key={item.value}>
                        <div className="num">{item.value}</div>
                        <p>{item.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}