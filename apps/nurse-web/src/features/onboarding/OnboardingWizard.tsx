import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { submitOnboarding } from './onboarding.api';

const DRAFT_KEY = 'onboarding_draft_v1';

const STEPS = [
    'Ảnh CCCD',
    'Ảnh chân dung',
    'Bằng tốt nghiệp',
    'Giấy phép hành nghề (GPHN)',
    'Giấy bổ trợ',
    'Xem lại & nộp',
] as const;

/** Ô chọn một file ảnh/tài liệu, hiện tên file và cho chọn lại. */
const FilePicker: React.FC<{
    label: string;
    file: File | null;
    onChange: (f: File | null) => void;
    accept?: string;
}> = ({ label, file, onChange, accept = 'image/*,.pdf' }) => (
    <div className={`file-picker ${file ? 'has-file' : ''}`}>
        <div className="field">
            <label>{label}</label>
            {file ? (
                <div className="file-name">Đã chọn: {file.name}</div>
            ) : (
                <div className="hint">Chưa chọn file nào</div>
            )}
            <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        </div>
    </div>
);

/** Chụp chân dung trực tiếp bằng camera — không cho chọn ảnh từ thư viện (FR-AUTH-01). */
const CameraCapture: React.FC<{ file: File | null; onCapture: (f: File | null) => void }> = ({
    file,
    onCapture,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [running, setRunning] = useState(false);
    const [camError, setCamError] = useState('');

    const start = async () => {
        setCamError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setRunning(true);
        } catch {
            setCamError('Không mở được camera. Vui lòng cho phép quyền camera rồi thử lại.');
        }
    };

    const stop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRunning(false);
    };

    const capture = () => {
        const video = videoRef.current;
        if (!video) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) onCapture(new File([blob], `chan-dung-${Date.now()}.jpg`, { type: 'image/jpeg' }));
            stop();
        }, 'image/jpeg', 0.9);
    };

    useEffect(() => stop, []);

    return (
        <div className="camera-box">
            {file && <div className="alert-info">Đã chụp: {file.name} — chụp lại nếu ảnh chưa rõ mặt.</div>}
            {!running && (
                <Button type="button" variant="secondary" onClick={start}>
                    {file ? 'Mở camera chụp lại' : 'Mở camera để chụp'}
                </Button>
            )}
            {running && (
                <>
                    <video ref={videoRef} autoPlay playsInline muted />
                    <div className="actions-row">
                        <Button type="button" onClick={capture}>
                            Chụp ảnh chân dung
                        </Button>
                        <Button type="button" variant="secondary" onClick={stop}>
                            Tắt camera
                        </Button>
                    </div>
                </>
            )}
            {camError && <div className="alert-error">{camError}</div>}
        </div>
    );
};

interface DraftText {
    fullName: string;
    gphnNumber: string;
    gphnIssuedDate: string;
    gphnExpiryDate: string;
    scopeOfPractice: string;
    yearsOfExp: string;
    isRetired: boolean;
}

const EMPTY_DRAFT: DraftText = {
    fullName: '',
    gphnNumber: '',
    gphnIssuedDate: '',
    gphnExpiryDate: '',
    scopeOfPractice: '',
    yearsOfExp: '',
    isRetired: false,
};

/**
 * SH4 — Wizard đăng ký hồ sơ eKYC (layout SETUP của NAV-0 được gắn ở routes).
 * 6 bước: CCCD -> chân dung -> bằng -> GPHN -> giấy bổ trợ (bỏ qua được) -> nộp.
 */
export const OnboardingWizard: React.FC = () => {
    const { session, updateProfile } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const [step, setStep] = useState<number>(() => {
        const fromUrl = Number(params.get('step'));
        if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= STEPS.length) return fromUrl - 1;
        try {
            return Number(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}').step ?? 0);
        } catch {
            return 0;
        }
    });
    const [text, setText] = useState<DraftText>(() => {
        try {
            return { ...EMPTY_DRAFT, ...(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}').text ?? {}) };
        } catch {
            return EMPTY_DRAFT;
        }
    });
    const [cccdFront, setCccdFront] = useState<File | null>(null);
    const [cccdBack, setCccdBack] = useState<File | null>(null);
    const [selfie, setSelfie] = useState<File | null>(null);
    const [degree, setDegree] = useState<File | null>(null);
    const [gphnFile, setGphnFile] = useState<File | null>(null);
    const [retirementFile, setRetirementFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Lưu nháp: chỉ bước + phần chữ (file không lưu được vào localStorage).
    useEffect(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, text }));
    }, [step, text]);

    const today = new Date().toISOString().slice(0, 10);
    const canNext = (): boolean => {
        switch (step) {
            case 0:
                return !!cccdFront && !!cccdBack;
            case 1:
                return !!selfie;
            case 2:
                return !!degree;
            case 3:
                // Không có GPHN vẫn qua được bước này — hồ sơ sẽ chỉ xét Tier 1.
                if (!gphnFile) return true;
                return !!text.gphnNumber && !!text.gphnExpiryDate && text.gphnExpiryDate > today;
            default:
                return true;
        }
    };

    const handleSubmit = async () => {
        if (!session) return;
        setError('');
        setSubmitting(true);
        const form = new FormData();
        if (cccdFront) form.append('cccdFront', cccdFront);
        if (cccdBack) form.append('cccdBack', cccdBack);
        if (selfie) form.append('selfie', selfie);
        if (degree) form.append('degree', degree);
        if (gphnFile) form.append('gphn', gphnFile);
        if (retirementFile) form.append('retirementDecision', retirementFile);
        form.append('gphnNumber', text.gphnNumber);
        form.append('gphnIssuedDate', text.gphnIssuedDate);
        form.append('gphnExpiryDate', text.gphnExpiryDate);
        form.append('scopeOfPractice', text.scopeOfPractice);
        form.append('yearsOfExp', text.yearsOfExp || '0');
        form.append('isRetiredMedicalStaff', String(text.isRetired));

        const res = await submitOnboarding(session.user.phone, form);
        setSubmitting(false);
        if (!res.success) {
            setError(res.error?.message ?? 'Nộp hồ sơ thất bại. Vui lòng thử lại');
            return;
        }
        localStorage.removeItem(DRAFT_KEY);
        updateProfile(res.data.profile, res.data.credentials);
        navigate('/pending', { replace: true });
    };

    const setField = (k: keyof DraftText, v: string | boolean) =>
        setText((prev) => ({ ...prev, [k]: v }));

    return (
        <div>
            <div className="stepper">
                {STEPS.map((s, i) => (
                    <span key={s} className={`step ${i === step ? 'current' : i < step ? 'done' : ''}`}>
                        {i + 1}. {s}
                    </span>
                ))}
            </div>

            <div className="card">
                {step === 0 && (
                    <>
                        <h2>Bước 1 — Ảnh căn cước công dân</h2>
                        <p>Chụp/tải ảnh rõ nét cả hai mặt CCCD. Ảnh mờ sẽ bị từ chối khi duyệt.</p>
                        <FilePicker label="CCCD mặt trước" file={cccdFront} onChange={setCccdFront} accept="image/*" />
                        <FilePicker label="CCCD mặt sau" file={cccdBack} onChange={setCccdBack} accept="image/*" />
                    </>
                )}

                {step === 1 && (
                    <>
                        <h2>Bước 2 — Ảnh chân dung chụp trực tiếp</h2>
                        <p>
                            Ảnh phải chụp ngay bằng camera để đối chiếu với CCCD. Không chấp nhận ảnh chọn từ thư
                            viện.
                        </p>
                        <CameraCapture file={selfie} onCapture={setSelfie} />
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2>Bước 3 — Bằng tốt nghiệp</h2>
                        <p>Bằng điều dưỡng / y sĩ / bác sĩ (ảnh hoặc PDF).</p>
                        <FilePicker label="Bằng tốt nghiệp" file={degree} onChange={setDegree} />
                        <div className="field">
                            <label htmlFor="years">Số năm kinh nghiệm</label>
                            <input
                                id="years"
                                type="number"
                                min={0}
                                value={text.yearsOfExp}
                                onChange={(e) => setField('yearsOfExp', e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={text.isRetired}
                                    onChange={(e) => setField('isRetired', e.target.checked)}
                                />{' '}
                                Tôi là nhân viên y tế đã nghỉ hưu
                            </label>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <h2>Bước 4 — Giấy phép hành nghề (GPHN)</h2>
                        <p>
                            Có GPHN còn hạn là điều kiện xét Tier 2 (dịch vụ chuyên sâu/xâm lấn). Chưa có GPHN,
                            bỏ qua bước này — hồ sơ chỉ xét Tier 1 (chăm sóc cơ bản).
                        </p>
                        <FilePicker label="Ảnh GPHN" file={gphnFile} onChange={setGphnFile} />
                        <div className="field">
                            <label htmlFor="gphn-num">Số GPHN</label>
                            <input
                                id="gphn-num"
                                type="text"
                                placeholder="Ví dụ: 01284/GPHN-ĐN"
                                value={text.gphnNumber}
                                onChange={(e) => setField('gphnNumber', e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="gphn-issue">Ngày cấp</label>
                            <input
                                id="gphn-issue"
                                type="date"
                                value={text.gphnIssuedDate}
                                onChange={(e) => setField('gphnIssuedDate', e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="gphn-exp">Ngày hết hạn</label>
                            <input
                                id="gphn-exp"
                                type="date"
                                value={text.gphnExpiryDate}
                                onChange={(e) => setField('gphnExpiryDate', e.target.value)}
                            />
                            {text.gphnExpiryDate && text.gphnExpiryDate <= today && (
                                <div className="alert-error">Ngày hết hạn phải sau hôm nay</div>
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="scope">Phạm vi hành nghề</label>
                            <input
                                id="scope"
                                type="text"
                                placeholder="Ví dụ: Chăm sóc sau phẫu thuật, thay băng, tiêm truyền"
                                value={text.scopeOfPractice}
                                onChange={(e) => setField('scopeOfPractice', e.target.value)}
                            />
                        </div>
                    </>
                )}

                {step === 4 && (
                    <>
                        <h2>Bước 5 — Giấy bổ trợ (không bắt buộc)</h2>
                        <p>Quyết định nghỉ hưu nếu bạn là nhân viên y tế đã nghỉ hưu. Có thể bỏ qua bước này.</p>
                        <FilePicker
                            label="Quyết định nghỉ hưu"
                            file={retirementFile}
                            onChange={setRetirementFile}
                        />
                    </>
                )}

                {step === 5 && (
                    <>
                        <h2>Bước 6 — Xem lại & nộp hồ sơ</h2>
                        <div className="cred-row"><span>CCCD</span><span>{cccdFront && cccdBack ? 'Đủ 2 mặt' : 'Chưa đủ'}</span></div>
                        <div className="cred-row"><span>Ảnh chân dung</span><span>{selfie ? selfie.name : 'Chưa chụp'}</span></div>
                        <div className="cred-row"><span>Bằng tốt nghiệp</span><span>{degree ? degree.name : 'Chưa có'}</span></div>
                        <div className="cred-row">
                            <span>GPHN</span>
                            <span>{gphnFile ? `${text.gphnNumber} — hết hạn ${text.gphnExpiryDate}` : 'Không nộp (xét Tier 1)'}</span>
                        </div>
                        <div className="cred-row"><span>Quyết định nghỉ hưu</span><span>{retirementFile ? retirementFile.name : 'Không nộp'}</span></div>
                        <div className="alert-info">
                            Sau khi nộp, hồ sơ ở trạng thái Chờ duyệt (PENDING_VERIFICATION). Bạn chưa nhận được
                            ca nào cho tới khi Admin duyệt và gán tier.
                        </div>
                    </>
                )}

                {error && <div className="alert-error">{error}</div>}

                <div className="actions-row">
                    {step > 0 && (
                        <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                            Quay lại bước trước
                        </Button>
                    )}
                    {step < STEPS.length - 1 && (
                        <Button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                            Tiếp tục sang bước {step + 2}
                        </Button>
                    )}
                    {step === STEPS.length - 1 && (
                        <Button type="button" disabled={submitting} onClick={handleSubmit}>
                            {submitting ? 'Đang nộp hồ sơ…' : 'Nộp hồ sơ đăng ký'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};  