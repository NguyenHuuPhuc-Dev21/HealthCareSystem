import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, LoginPhonePage, RequireAuth, VerifyOtpPage } from '../features/auth';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { PatientProfilesPage } from '../features/patient-profiles/PatientProfilesPage';
import { BookingNewPage } from '../features/booking/BookingNewPage';
import { BookingPaymentPage } from '../features/booking/BookingPaymentPage';
import { ShiftTrackingPage } from '../features/booking-tracking/ShiftTrackingPage';
import { MyBookingsPage } from '../features/booking/MyBookingsPage';
import { NurseSearchPage } from '../features/nurse-search/NurseSearchPage';
import { HomePage } from './HomePage';

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
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/patient-profiles" element={<PatientProfilesPage />} />
        <Route path="/nurses" element={<NurseSearchPage />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/bookings/new" element={<BookingNewPage />} />
        <Route path="/bookings/:id/pay" element={<BookingPaymentPage />} />
        <Route path="/bookings/:id" element={<ShiftTrackingPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
