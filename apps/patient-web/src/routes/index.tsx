import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, LoginPhonePage, RequireAuth, VerifyOtpPage } from '../features/auth';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { PatientProfilesPage } from '../features/patient-profiles/PatientProfilesPage';
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
