import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { GuestOnly, LoginPhonePage, RequireAuth, VerifyOtpPage } from '../features/auth';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { PatientProfilesPage } from '../features/patient-profiles/PatientProfilesPage';
import { BookingNewPage } from '../features/booking/BookingNewPage';
import { BookingPaymentPage } from '../features/booking/BookingPaymentPage';
import { ShiftTrackingPage } from '../features/booking-tracking/ShiftTrackingPage';
import { RefundsPage } from '../features/refunds/RefundsPage';
import { MyBookingsPage } from '../features/booking/MyBookingsPage';
import { NurseSearchPage } from '../features/nurse-search/NurseSearchPage';
import { DisputesPage } from '../features/disputes/DisputesPage';
import { NotificationProvider } from '../features/notifications/NotificationProvider';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { HomePage } from './HomePage';

/** Các trang đã đăng nhập dùng chung một nguồn thông báo (huy hiệu chuông, WebSocket) thay vì mỗi trang tự dựng lại. */
function AuthedShell() {
  return (
    <NotificationProvider>
      <Outlet />
    </NotificationProvider>
  );
}

export const AppRoutes = () => {
  return (
    <Routes>
      {/* SH1, SH2 — chỉ khi chưa đăng nhập */}
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPhonePage />} />
        <Route path="/login/otp" element={<VerifyOtpPage />} />
      </Route>

      {/* Các trang cần đăng nhập */}
      <Route element={<RequireAuth />}>
       <Route element={<AuthedShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/patient-profiles" element={<PatientProfilesPage />} />
        <Route path="/nurses" element={<NurseSearchPage />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/bookings/new" element={<BookingNewPage />} />
        <Route path="/bookings/:id/pay" element={<BookingPaymentPage />} />
        <Route path="/bookings/:id" element={<ShiftTrackingPage />} />
        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
       </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
