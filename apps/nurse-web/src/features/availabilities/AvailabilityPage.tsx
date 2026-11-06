import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    Calendar as CalendarIcon,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Lock,
    Tag,
    X,
} from 'lucide-react';
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
 * Giao diện hoàn thiện theo chuẩn CareNest & N-screens.html (Elder-friendly).
 * - Lưới 2 cột (1.35fr 1fr): Tuần bên trái, Lịch tháng & Lưu bên phải.
 * - Khung tuần: Range-chip phong cách M0, ca đêm tím nhạt, khóa ca có mã đơn.
 * - Thêm khung: Form rút gọn kèm gợi ý ca nhanh (Sáng / Chiều / Đêm / Cả ngày).
 * - Lịch tháng: Ô ngày bo tròn, đánh dấu Nghỉ (đỏ) / Mở riêng (xanh) / Theo tuần (trắng).
 * - Ca đã chốt: Thẻ riêng hiển thị thông tin ca trực.
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
    const [addStart, setAddStart] = useState('07:00');
    const [addEnd, setAddEnd] = useState('12:00');
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
                [dayOfWeek]: `Khung giờ bị trùng với khung đã có (${formatWindow(overlap)}). Hệ thống tự chặn ca trùng giờ — hãy chọn khung khác.`,
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
        // Thứ 2 là cột đầu tiên (index 0)
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
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <CalendarIcon size={36} style={{ color: 'var(--blue)', marginBottom: '12px' }} />
                <h3 style={{ color: 'var(--navy)' }}>Đang tải lịch rảnh…</h3>
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
        <div>
            {/* Header trang (chuẩn NAV-0 / N-screens.html) */}
            <div className="page-head">
                <div>
                    <h1>Lịch rảnh &amp; ngày nghỉ</h1>
                    <p>Radar &amp; Job Board chỉ gợi ý việc trong khung giờ bạn đã mở</p>
                </div>
                <Link to="/" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                    <ArrowLeft size={16} /> Về trang chủ
                </Link>
            </div>

            {loadError && (
                <div className="alert-error" style={{ marginBottom: 20 }}>
                    {loadError}
                </div>
            )}

            {/* Layout 2 cột (1.35fr 1fr) */}
            <div className="cols-2">
                {/* CỘT TRÁI: Khung giờ rảnh hằng tuần */}
                <div className="card" style={{ padding: '24px 26px' }}>
                    <h3 style={{ color: 'var(--navy)', fontSize: '18px', marginBottom: '8px' }}>
                        Khung giờ rảnh hằng tuần
                    </h3>

                    {WEEKDAY_ORDER.map(({ dayOfWeek, label }) => {
                        const windows = recurring
                            .filter((w) => w.dayOfWeek === dayOfWeek)
                            .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));

                        // Tìm mã ca khóa nếu có
                        const dayLockedCode = windows.find((w) => locked.has(w.id))
                            ? locked.get(windows.find((w) => locked.has(w.id))!.id)
                            : null;

                        return (
                            <React.Fragment key={dayOfWeek}>
                                <div className="week-row">
                                    <span className="dow">{label}</span>
                                    <div className="week-row__slots">
                                        {windows.length === 0 && (
                                            <span style={{ color: 'var(--muted)', fontSize: '15px' }}>
                                                Nghỉ — chưa mở khung giờ nào
                                            </span>
                                        )}
                                        {windows.map((w) => {
                                            const lockCode = locked.get(w.id);
                                            const allDay =
                                                w.startTime === ALL_DAY.startTime && w.endTime === ALL_DAY.endTime;
                                            const night = isOvernight(w);

                                            return (
                                                <span
                                                    key={w.id}
                                                    className={`range-chip${night ? ' night' : ''}${
                                                        lockCode ? ' locked' : ''
                                                    }`}
                                                >
                                                    {lockCode && <Lock size={14} aria-hidden="true" />}
                                                    <span>
                                                        {allDay
                                                            ? 'Cả ngày'
                                                            : `${formatWindow(w)}${night ? ' · ca đêm' : ''}`}
                                                    </span>
                                                    {!lockCode ? (
                                                        <button
                                                            type="button"
                                                            className="chip-remove"
                                                            aria-label={`Xóa khung ${formatWindow(w)} ${label}`}
                                                            onClick={() => handleRemoveWindow(w)}
                                                        >
                                                            <X size={12} aria-hidden="true" />
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '13px', opacity: 0.85 }}>
                                                            · Đã có ca
                                                        </span>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {dayLockedCode ? (
                                        <span className="chip grey week-row__right">
                                            Đơn {dayLockedCode}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm week-row__right"
                                            onClick={() => {
                                                setOpenAddDay(openAddDay === dayOfWeek ? null : dayOfWeek);
                                                setDayError({});
                                            }}
                                        >
                                            ＋ Thêm khung
                                        </button>
                                    )}
                                </div>

                                {/* Form thêm khung giờ dạng inline thu gọn */}
                                {openAddDay === dayOfWeek && (
                                    <div className="avail-add-inline">
                                        <div className="avail-add-inline__header">
                                            <strong>Thêm khung giờ cho {label}</strong>
                                            <button
                                                type="button"
                                                className="btn-close-sm"
                                                onClick={() => {
                                                    setOpenAddDay(null);
                                                    setDayError({});
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Gợi ý khung giờ nhanh */}
                                        <div className="avail-presets">
                                            <span className="avail-presets__label">Gợi ý nhanh:</span>
                                            <button
                                                type="button"
                                                className="chip-preset"
                                                onClick={() => {
                                                    setAddStart('07:00');
                                                    setAddEnd('12:00');
                                                }}
                                            >
                                                Sáng (07:00 – 12:00)
                                            </button>
                                            <button
                                                type="button"
                                                className="chip-preset"
                                                onClick={() => {
                                                    setAddStart('13:00');
                                                    setAddEnd('18:00');
                                                }}
                                            >
                                                Chiều (13:00 – 18:00)
                                            </button>
                                            <button
                                                type="button"
                                                className="chip-preset night"
                                                onClick={() => {
                                                    setAddStart('19:00');
                                                    setAddEnd('06:00');
                                                }}
                                            >
                                                Đêm (19:00 – 06:00)
                                            </button>
                                            <button
                                                type="button"
                                                className="chip-preset"
                                                onClick={() => {
                                                    setAddStart(ALL_DAY.startTime);
                                                    setAddEnd(ALL_DAY.endTime);
                                                }}
                                            >
                                                Cả ngày
                                            </button>
                                        </div>

                                        <div className="avail-add-inline__inputs">
                                            <div className="field-group">
                                                <label>Từ giờ</label>
                                                <input
                                                    type="time"
                                                    value={addStart}
                                                    onChange={(e) => setAddStart(e.target.value)}
                                                />
                                            </div>
                                            <div className="field-group">
                                                <label>Đến giờ</label>
                                                <input
                                                    type="time"
                                                    value={addEnd}
                                                    onChange={(e) => setAddEnd(e.target.value)}
                                                />
                                            </div>
                                            <div className="avail-add-inline__actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleAddWindow(dayOfWeek)}
                                                >
                                                    Thêm khung
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setOpenAddDay(null);
                                                        setDayError({});
                                                    }}
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>

                                        <div className="avail-add-inline__hint">
                                            * Giờ kết thúc nhỏ hơn giờ bắt đầu = khung qua đêm (ví dụ: 19:00 – 06:00 sáng hôm sau).
                                        </div>

                                        {dayError[dayOfWeek] && (
                                            <div className="alert-error" style={{ margin: '10px 0 0' }}>
                                                {dayError[dayOfWeek]}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}

                    <p className="avail-notice">
                        Hệ thống tự cộng thêm 60 phút đệm di chuyển giữa hai ca và tự chặn ca trùng giờ — bạn không thể bị xếp hai ca chồng nhau.
                    </p>
                </div>

                {/* CỘT PHẢI: Lịch tháng & Nút Lưu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Thẻ Lịch Tháng */}
                    <div className="card" style={{ padding: '22px 24px' }}>
                        <div className="cal-head-row">
                            <h3 className="cal-title">
                                Ngày nghỉ cụ thể · Tháng {monthCursor.getMonth() + 1}/{monthCursor.getFullYear()}
                            </h3>
                            <div className="cal-nav-buttons">
                                <button
                                    type="button"
                                    className="cal-nav-btn"
                                    aria-label="Tháng trước"
                                    onClick={() =>
                                        setMonthCursor(
                                            new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1),
                                        )
                                    }
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    type="button"
                                    className="cal-nav-btn"
                                    aria-label="Tháng sau"
                                    onClick={() =>
                                        setMonthCursor(
                                            new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1),
                                        )
                                    }
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>

                        <p style={{ color: 'var(--slate)', fontSize: '15px', marginBottom: '14px' }}>
                            Chạm vào một ngày để đánh dấu <b style={{ color: 'var(--red)' }}>Nghỉ</b> hoặc mở rảnh riêng ngày đó.
                        </p>

                        <div className="cal-weekdays">
                            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                                <span key={d}>{d}</span>
                            ))}
                        </div>

                        <div className="cal">
                            {monthDays.map((iso, idx) => {
                                if (!iso) {
                                    return <span className="cd dim" key={`blank-${idx}`}>·</span>;
                                }
                                const dayNum = Number(iso.slice(8, 10));
                                const hasBooking = (bookingByDate.get(iso) ?? []).length > 0;
                                const isToday = iso === toISODate(new Date());
                                const isSelected = iso === selectedDate;
                                const isOff = !!offOn(iso);
                                const isOpen = !!openOn(iso);

                                const classNames = [
                                    'cd',
                                    isOff ? 'off' : '',
                                    isOpen ? 'avail' : '',
                                    isToday ? 'is-today' : '',
                                    isSelected ? 'is-selected' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                return (
                                    <button
                                        type="button"
                                        key={iso}
                                        className={classNames}
                                        onClick={() => {
                                            setSelectedDate(selectedDate === iso ? null : iso);
                                            setPanelError(null);
                                        }}
                                        title={`${iso}${hasBooking ? ' (Có ca đã chốt)' : ''}`}
                                    >
                                        {dayNum}
                                        {hasBooking && <span className="cd-dot" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Chú thích màu sắc */}
                        <div className="cal-legend">
                            <span className="chip red">Đỏ = Nghỉ</span>
                            <span className="chip teal">Xanh = Mở rảnh riêng</span>
                            <span className="chip grey">Trắng = Theo lịch tuần</span>
                        </div>

                        {/* Bảng thao tác ngày đã chọn */}
                        {selectedDate && (
                            <div className="avail-date-card">
                                <div className="avail-date-card__head">
                                    <div>
                                        <div className="avail-date-card__date">
                                            {selectedWeekday}, ngày {selectedDate.slice(8, 10)}/
                                            {selectedDate.slice(5, 7)}/{selectedDate.slice(0, 4)}
                                        </div>
                                        <div className="avail-date-card__status">
                                            Trạng thái:{' '}
                                            <strong>
                                                {offOn(selectedDate)
                                                    ? 'Nghỉ cả ngày'
                                                    : openOn(selectedDate)
                                                    ? `Mở rảnh riêng ${formatWindow(openOn(selectedDate)!)}`
                                                    : 'Theo lịch tuần'}
                                            </strong>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close-sm"
                                        aria-label="Đóng"
                                        onClick={() => setSelectedDate(null)}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {selectedBookings.length > 0 && (
                                    <div className="alert-error" style={{ margin: '8px 0 12px' }}>
                                        <AlertTriangle size={16} style={{ verticalAlign: -2 }} /> Ngày này đã có ca đã chốt:{' '}
                                        {selectedBookings
                                            .map((b) => `${b.code} (${formatWindow(b)}${isOvernight(b) ? ', ca đêm' : ''})`)
                                            .join('; ')}
                                        . Bạn không thể đánh dấu nghỉ chồng lên ca đã chốt.
                                    </div>
                                )}

                                <div className="avail-date-card__actions">
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        disabled={selectedBookings.length > 0}
                                        onClick={() => markTimeOff(selectedDate)}
                                    >
                                        Đánh dấu nghỉ cả ngày
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => clearOverride(selectedDate)}
                                    >
                                        Theo lịch tuần (bỏ chọn)
                                    </button>
                                </div>

                                <div className="avail-custom-hours">
                                    <div className="avail-custom-hours__label">Mở rảnh riêng ngày này:</div>
                                    <div className="avail-custom-hours__row">
                                        <input
                                            type="time"
                                            value={openStart}
                                            onChange={(e) => setOpenStart(e.target.value)}
                                        />
                                        <span style={{ fontSize: '14px', color: 'var(--slate)' }}>đến</span>
                                        <input
                                            type="time"
                                            value={openEnd}
                                            onChange={(e) => setOpenEnd(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => markDateOpen(selectedDate)}
                                        >
                                            Áp dụng
                                        </button>
                                    </div>
                                    {panelError && (
                                        <div className="alert-error" style={{ margin: '10px 0 0' }}>
                                            {panelError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Thẻ Lưu Lịch Rảnh (Save Action Card) */}
                    <div className="card avail-save-card">
                        {saveOk && (
                            <div className="alert-success" style={{ margin: '0 0 14px' }}>
                                <CheckCircle2 size={18} /> Đã lưu lịch rảnh thành công.
                            </div>
                        )}
                        {saveError && (
                            <div className="alert-error" style={{ margin: '0 0 14px' }}>
                                {saveError}
                            </div>
                        )}

                        <button
                            type="button"
                            className="btn btn-primary btn-block btn-lg"
                            disabled={!dirty || saving}
                            onClick={handleSave}
                        >
                            {saving ? 'Đang lưu lịch rảnh…' : dirty ? 'Lưu thay đổi lịch rảnh' : 'Lưu lịch rảnh'}
                        </button>
                        <p className="avail-save-card__hint">
                            Lịch rảnh dùng để Radar &amp; Job Board gợi ý việc phù hợp; hệ thống tự chặn ca trùng giờ.
                        </p>
                    </div>

                    {/* Thẻ Ca đã chốt sắp tới (Booked Shifts Overlay) */}
                    {bookings.length > 0 && (
                        <div className="card avail-shifts-card">
                            <div className="avail-shifts-card__head">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ fontSize: '17px', color: 'var(--navy)', margin: 0, fontWeight: 700 }}>
                                        Ca đã chốt sắp tới
                                    </h3>
                                    <span className="chip grey" style={{ fontSize: '12px', padding: '1px 8px' }}>
                                        {bookings.length}
                                    </span>
                                </div>
                                <span className="chip grey" style={{ fontSize: '12px', padding: '2px 8px' }}>Chỉ đọc</span>
                            </div>
                            <div className="avail-shifts-list">
                                {[...bookings]
                                    .sort((a, b) => a.date.localeCompare(b.date))
                                    .map((b) => (
                                        <div className="avail-shift-item" key={b.id}>
                                            <div className="avail-shift-item__top">
                                                <div className="avail-shift-item__title">
                                                    <span className="avail-shift-item__badge-icon">
                                                        <Activity size={18} />
                                                    </span>
                                                    <span className="avail-shift-item__service">
                                                        {b.serviceName}
                                                    </span>
                                                </div>
                                                <span className="chip teal" style={{ fontSize: '12px', padding: '2px 8px', flexShrink: 0 }}>
                                                    {b.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đang trực'}
                                                </span>
                                            </div>

                                            <div className="avail-shift-item__grid">
                                                <div className="avail-shift-item__meta-col">
                                                    <CalendarIcon size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                                                    <span>{b.date.slice(8, 10)}/{b.date.slice(5, 7)}/{b.date.slice(0, 4)}</span>
                                                </div>
                                                <div className="avail-shift-item__meta-col">
                                                    <Clock size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                                                    <span>{formatWindow(b)}{isOvernight(b) ? ' (ca đêm)' : ''}</span>
                                                </div>
                                            </div>

                                            <div className="avail-shift-item__footer">
                                                <span className="avail-shift-item__order-tag">
                                                    <Tag size={13} style={{ color: 'var(--blue)' }} />
                                                    <span>Đơn <strong>{b.code}</strong></span>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
