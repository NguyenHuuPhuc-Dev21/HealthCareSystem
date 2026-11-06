import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Info,
    Lock,
    Plus,
    X,
} from 'lucide-react';
import { Button } from '../../components';
import { getAvailabilities, updateAvailabilities } from './availabilities.api';
import { lockedWindows } from './availabilities.mock';
import type {
    ConfirmedBooking,
    DateAvailability,
    RecurringWindow,
    TimeOffException,
} from './availability.types';
import {
    WEEKDAY_ORDER,
    findOverlap,
    formatWindow,
    isOvernight,
    minutesOf,
    newId,
    toISODate,
} from './availability.types';

/**
 * N13 · Lịch rảnh & ngày nghỉ (FR-SCHED-01).
 * - Khung giờ rảnh lặp lại theo tuần (kèm khung qua đêm).
 * - Lịch tháng: đánh dấu ngày nghỉ (đỏ) / mở rảnh riêng (xanh) / theo lịch tuần (trắng).
 * - Ca CONFIRMED/IN_PROGRESS hiển thị kèm, và khóa khung tuần mà ca bao trọn.
 * Mọi thay đổi chỉ áp dụng khi bấm "Lưu lịch rảnh" (một lần PUT duy nhất).
 */

const ALL_DAY = { startTime: '00:00', endTime: '23:59' };

export const AvailabilityPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [initial, setInitial] = useState<string>('');
    const [recurring, setRecurring] = useState<RecurringWindow[]>([]);
    const [timeOff, setTimeOff] = useState<TimeOffException[]>([]);
    const [dateAvailability, setDateAvailability] = useState<DateAvailability[]>([]);
    const [bookings, setBookings] = useState<ConfirmedBooking[]>([]);

    const [openAddDay, setOpenAddDay] = useState<number | null>(null);
    const [addStart, setAddStart] = useState('08:00');
    const [addEnd, setAddEnd] = useState('17:00');
    const [dayError, setDayError] = useState<Record<number, string>>({});

    const now = new Date();
    const [monthCursor, setMonthCursor] = useState(
        () => new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [openStart, setOpenStart] = useState('08:00');
    const [openEnd, setOpenEnd] = useState('17:00');
    const [panelError, setPanelError] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveOk, setSaveOk] = useState(false);

    const applyData = (d: {
        recurring: RecurringWindow[];
        timeOff: TimeOffException[];
        dateAvailability: DateAvailability[];
        bookings: ConfirmedBooking[];
    }) => {
        setRecurring(d.recurring);
        setTimeOff(d.timeOff);
        setDateAvailability(d.dateAvailability);
        setBookings(d.bookings);
        setInitial(
            JSON.stringify({
                recurring: d.recurring,
                timeOff: d.timeOff,
                dateAvailability: d.dateAvailability,
            }),
        );
    };

    useEffect(() => {
        (async () => {
            const res = await getAvailabilities();
            if (res.success) applyData(res.data);
            else setLoadError(res.error?.message ?? 'Không tải được lịch rảnh.');
            setLoading(false);
        })();
    }, []);

    const dirty =
        initial !== '' &&
        JSON.stringify({ recurring, timeOff, dateAvailability }) !== initial;

    const locked = useMemo(() => lockedWindows(recurring, bookings), [recurring, bookings]);
    const bookingByDate = useMemo(() => {
        const m = new Map<string, ConfirmedBooking[]>();
        for (const b of bookings) {
            const arr = m.get(b.date) ?? [];
            arr.push(b);
            m.set(b.date, arr);
        }
        return m;
    }, [bookings]);

    const clearSaveState = () => {
        setSaveOk(false);
        setSaveError(null);
    };

    // ---------- Khung tuần ----------
    const handleAddWindow = (dayOfWeek: number) => {
        clearSaveState();
        if (!addStart || !addEnd) {
            setDayError({ [dayOfWeek]: 'Hãy chọn giờ bắt đầu và giờ kết thúc.' });
            return;
        }
        if (addStart === addEnd) {
            setDayError({ [dayOfWeek]: 'Giờ bắt đầu và kết thúc không được trùng nhau.' });
            return;
        }
        const overlap = findOverlap(recurring, dayOfWeek, { startTime: addStart, endTime: addEnd });
        if (overlap) {
            setDayError({
                [dayOfWeek]: `Khung giờ trùng với khung đã có (${formatWindow(overlap)}). Hệ thống tự chặn ca trùng giờ — hãy chọn khung khác.`,
            });
            return;
        }
        setRecurring((prev) => [
            ...prev,
            { id: newId('w'), dayOfWeek, startTime: addStart, endTime: addEnd },
        ]);
        setDayError({});
        setOpenAddDay(null);
    };

    const handleRemoveWindow = (w: RecurringWindow) => {
        clearSaveState();
        if (locked.has(w.id)) return;
        setRecurring((prev) => prev.filter((x) => x.id !== w.id));
    };

    // ---------- Lịch tháng / ngày cụ thể ----------
    const monthDays = useMemo(() => {
        const y = monthCursor.getFullYear();
        const m = monthCursor.getMonth();
        const first = new Date(y, m, 1);
        // Ô trống đầu hàng: Thứ 2 là cột đầu tiên.
        const lead = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const cells: (string | null)[] = [];
        for (let i = 0; i < lead; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(y, m, d)));
        return cells;
    }, [monthCursor]);

    const offOn = (iso: string) => timeOff.find((t) => t.specificDate === iso);
    const openOn = (iso: string) => dateAvailability.find((t) => t.specificDate === iso);

    const markTimeOff = (iso: string) => {
        clearSaveState();
        if ((bookingByDate.get(iso) ?? []).length > 0) {
            setPanelError('Ngày này đã có ca đã chốt — không thể đánh dấu nghỉ chồng lên ca.');
            return;
        }
        setPanelError(null);
        setDateAvailability((prev) => prev.filter((t) => t.specificDate !== iso));
        setTimeOff((prev) => [
            ...prev.filter((t) => t.specificDate !== iso),
            { id: newId('off'), specificDate: iso, ...ALL_DAY },
        ]);
    };

    const markDateOpen = (iso: string) => {
        clearSaveState();
        if (minutesOf(openEnd) <= minutesOf(openStart)) {
            setPanelError('Khung mở rảnh riêng phải có giờ kết thúc sau giờ bắt đầu (không qua đêm).');
            return;
        }
        setPanelError(null);
        setTimeOff((prev) => prev.filter((t) => t.specificDate !== iso));
        setDateAvailability((prev) => [
            ...prev.filter((t) => t.specificDate !== iso),
            { id: newId('open'), specificDate: iso, startTime: openStart, endTime: openEnd },
        ]);
    };

    const clearOverride = (iso: string) => {
        clearSaveState();
        setPanelError(null);
        setTimeOff((prev) => prev.filter((t) => t.specificDate !== iso));
        setDateAvailability((prev) => prev.filter((t) => t.specificDate !== iso));
    };

    // ---------- Lưu ----------
    const handleSave = async () => {
        setSaving(true);
        setSaveError(null);
        setSaveOk(false);
        const res = await updateAvailabilities({ recurring, timeOff, dateAvailability });
        setSaving(false);
        if (res.success) {
            applyData(res.data);
            setSaveOk(true);
        } else {
            setSaveError(res.error?.message ?? 'Lưu lịch rảnh thất bại, hãy thử lại.');
        }
    };

    if (loading) {
        return (
            <div className="page-shell">
                <div className="card">Đang tải lịch rảnh…</div>
            </div>
        );
    }

    const selectedBookings = selectedDate ? bookingByDate.get(selectedDate) ?? [] : [];
    const selectedWeekday = selectedDate
        ? WEEKDAY_ORDER.find(
            (d) => d.dayOfWeek === new Date(`${selectedDate}T00:00:00`).getDay(),
        )?.label
        : null;

    return (
        <div className="page-shell">
            <Link to="/" className="back-link">
                <ArrowLeft size={18} aria-hidden="true" /> Trang chủ
            </Link>
            <h1>Lịch rảnh &amp; ngày nghỉ</h1>
            <p className="page-subtitle">Radar &amp; Job Board chỉ gợi ý việc trong khung giờ bạn đã mở</p>

            {loadError && <div className="alert-error">{loadError}</div>}

            {/* ----- Khung giờ rảnh hằng tuần ----- */}
            <div className="card">
                <h2>Khung giờ rảnh hằng tuần</h2>
                {WEEKDAY_ORDER.map(({ dayOfWeek, label }) => {
                    const windows = recurring
                        .filter((w) => w.dayOfWeek === dayOfWeek)
                        .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));
                    return (
                        <div className="avail-day" key={dayOfWeek}>
                            <div className="avail-day__label">{label}</div>
                            <div className="avail-day__body">
                                {windows.length === 0 && (
                                    <span className="avail-empty">Nghỉ — chưa mở khung giờ nào</span>
                                )}
                                {windows.map((w) => {
                                    const lockCode = locked.get(w.id);
                                    const allDay =
                                        w.startTime === ALL_DAY.startTime && w.endTime === ALL_DAY.endTime;
                                    return (
                                        <div className="avail-chip-wrap" key={w.id}>
                                            <span className={`avail-chip${lockCode ? ' avail-chip--locked' : ''}`}>
                                                {lockCode && <Lock size={14} aria-hidden="true" />}{' '}
                                                {allDay
                                                    ? 'Cả ngày'
                                                    : `${formatWindow(w)}${isOvernight(w) ? ' · ca đêm' : ''}`}
                                                {!lockCode && (
                                                    <button
                                                        type="button"
                                                        className="avail-chip__x"
                                                        aria-label={`Xóa khung ${formatWindow(w)} ${label}`}
                                                        onClick={() => handleRemoveWindow(w)}
                                                    >
                                                        <X size={14} aria-hidden="true" />
                                                    </button>
                                                )}
                                            </span>
                                            {lockCode && (
                                                <span className="avail-chip__note">
                                                    Đã có ca — không sửa được · Đơn {lockCode}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                                {openAddDay === dayOfWeek ? (
                                    <div className="avail-add">
                                        <div className="field avail-add__field">
                                            <label>Từ giờ</label>
                                            <input
                                                type="time"
                                                value={addStart}
                                                onChange={(e) => setAddStart(e.target.value)}
                                            />
                                        </div>
                                        <div className="field avail-add__field">
                                            <label>Đến giờ</label>
                                            <input
                                                type="time"
                                                value={addEnd}
                                                onChange={(e) => setAddEnd(e.target.value)}
                                            />
                                        </div>
                                        <div className="avail-add__actions">
                                            <Button type="button" onClick={() => handleAddWindow(dayOfWeek)}>
                                                Thêm khung
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setOpenAddDay(null);
                                                    setDayError({});
                                                }}
                                            >
                                                Hủy
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setAddStart(ALL_DAY.startTime);
                                                    setAddEnd(ALL_DAY.endTime);
                                                }}
                                            >
                                                Cả ngày
                                            </Button>
                                        </div>
                                        <div className="hint">
                                            Giờ kết thúc nhỏ hơn giờ bắt đầu = khung qua đêm (vd 19:00 – 06:00).
                                        </div>
                                        {dayError[dayOfWeek] && (
                                            <div className="alert-error">{dayError[dayOfWeek]}</div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="avail-add-btn"
                                        onClick={() => {
                                            setOpenAddDay(dayOfWeek);
                                            setDayError({});
                                        }}
                                    >
                                        <Plus size={16} aria-hidden="true" /> Thêm khung
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div className="alert-info">
                    <Info size={16} aria-hidden="true" /> Hệ thống tự cộng thêm 60 phút đệm di chuyển
                    giữa hai ca và tự chặn ca trùng giờ — bạn không thể bị xếp hai ca chồng nhau.
                </div>
            </div>

            {/* ----- Ngày nghỉ cụ thể ----- */}
            <div className="card">
                <h2>
                    Ngày nghỉ cụ thể · Tháng {monthCursor.getMonth() + 1}/{monthCursor.getFullYear()}
                </h2>
                <p>Chạm vào một ngày để đánh dấu Nghỉ hoặc mở rảnh riêng ngày đó.</p>
                <div className="avail-cal__nav">
                    <button
                        type="button"
                        className="avail-icon-btn"
                        aria-label="Tháng trước"
                        onClick={() =>
                            setMonthCursor(
                                new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1),
                            )
                        }
                    >
                        <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="avail-icon-btn"
                        aria-label="Tháng sau"
                        onClick={() =>
                            setMonthCursor(
                                new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1),
                            )
                        }
                    >
                        <ChevronRight size={20} aria-hidden="true" />
                    </button>
                </div>
                <div className="avail-cal">
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                        <div className="avail-cal__head" key={d}>
                            {d}
                        </div>
                    ))}
                    {monthDays.map((iso, idx) => {
                        if (!iso) return <div key={`blank-${idx}`} />;
                        const dayNum = Number(iso.slice(8, 10));
                        const cls = [
                            'avail-cal__day',
                            offOn(iso) ? 'is-off' : '',
                            openOn(iso) ? 'is-open' : '',
                            iso === toISODate(new Date()) ? 'is-today' : '',
                            iso === selectedDate ? 'is-selected' : '',
                        ]
                            .filter(Boolean)
                            .join(' ');
                        return (
                            <button
                                type="button"
                                key={iso}
                                className={cls}
                                onClick={() => {
                                    setSelectedDate(iso);
                                    setPanelError(null);
                                }}
                            >
                                {dayNum}
                                {(bookingByDate.get(iso) ?? []).length > 0 && (
                                    <span className="avail-cal__dot" aria-label="Có ca đã chốt" />
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="avail-legend">
                    <span>
                        <span className="avail-legend__sw avail-legend__sw--off" /> Đỏ = Nghỉ
                    </span>
                    <span>
                        <span className="avail-legend__sw avail-legend__sw--open" /> Xanh = Mở rảnh riêng
                    </span>
                    <span>
                        <span className="avail-legend__sw" /> Trắng = Theo lịch tuần
                    </span>
                    <span>
                        <span className="avail-cal__dot avail-cal__dot--inline" /> = Có ca đã chốt
                    </span>
                </div>

                {selectedDate && (
                    <div className="avail-panel">
                        <h3>
                            {selectedWeekday}, ngày {selectedDate.slice(8, 10)}/{selectedDate.slice(5, 7)}/
                            {selectedDate.slice(0, 4)}
                        </h3>
                        {selectedBookings.length > 0 && (
                            <div className="alert-error">
                                <AlertTriangle size={16} aria-hidden="true" /> Ngày này đã có ca đã chốt:{' '}
                                {selectedBookings
                                    .map((b) => `${b.code} (${formatWindow(b)}${isOvernight(b) ? ', qua đêm' : ''})`)
                                    .join('; ')}
                                . Ngày nghỉ không áp dụng cho ca đã chốt.
                            </div>
                        )}
                        <p>
                            Trạng thái hiện tại:{' '}
                            <strong>
                                {offOn(selectedDate)
                                    ? 'Nghỉ cả ngày'
                                    : openOn(selectedDate)
                                        ? `Mở rảnh riêng ${formatWindow(openOn(selectedDate)!)}`
                                        : 'Theo lịch tuần'}
                            </strong>
                        </p>
                        <div className="actions-row">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={selectedBookings.length > 0}
                                onClick={() => markTimeOff(selectedDate)}
                            >
                                Đánh dấu nghỉ cả ngày
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => clearOverride(selectedDate)}>
                                Xóa đánh dấu (theo lịch tuần)
                            </Button>
                        </div>
                        <div className="avail-add">
                            <div className="field avail-add__field">
                                <label>Mở rảnh riêng từ</label>
                                <input
                                    type="time"
                                    value={openStart}
                                    onChange={(e) => setOpenStart(e.target.value)}
                                />
                            </div>
                            <div className="field avail-add__field">
                                <label>Đến</label>
                                <input type="time" value={openEnd} onChange={(e) => setOpenEnd(e.target.value)} />
                            </div>
                            <div className="avail-add__actions">
                                <Button type="button" onClick={() => markDateOpen(selectedDate)}>
                                    Áp dụng mở rảnh riêng
                                </Button>
                            </div>
                        </div>
                        {panelError && <div className="alert-error">{panelError}</div>}
                    </div>
                )}

                {bookings.length > 0 && (
                    <>
                        <h3>Ca đã chốt sắp tới</h3>
                        <ul className="avail-bookings">
                            {[...bookings]
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((b) => (
                                    <li key={b.id}>
                                        <strong>{b.code}</strong> · {b.date.slice(8, 10)}/{b.date.slice(5, 7)}/
                                        {b.date.slice(0, 4)} · {formatWindow(b)}
                                        {isOvernight(b) ? ' (qua đêm)' : ''} · {b.serviceName} ·{' '}
                                        {b.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đang thực hiện'}
                                    </li>
                                ))}
                        </ul>
                    </>
                )}
            </div>

            {/* ----- Lưu ----- */}
            <div className="card avail-savebar">
                {saveOk && (
                    <div className="alert-info">
                        <CheckCircle2 size={16} aria-hidden="true" /> Đã lưu lịch rảnh.
                    </div>
                )}
                {saveError && <div className="alert-error">{saveError}</div>}
                <Button type="button" disabled={!dirty || saving} onClick={handleSave}>
                    {saving ? 'Đang lưu…' : 'Lưu lịch rảnh'}
                </Button>
                <p className="hint">
                    Lịch rảnh dùng để Radar &amp; Job Board gợi ý việc phù hợp; hệ thống tự chặn ca
                    trùng giờ.
                </p>
            </div>
        </div>
    );
};