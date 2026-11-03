import { Navigate, Route, Routes } from 'react-router-dom';
import {
  AdminLoginPage,
  AdminTwoFactorPage,
  AdminVerifyOtpPage,
  GuestOnly,
  RequireAuth,
} from '../features/auth';
import { NurseReviewPage } from '../features/nurse-verification/NurseReviewPage';
import { VerificationQueuePage } from '../features/nurse-verification/VerificationQueuePage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Đăng nhập: SĐT → OTP → 2FA (bắt buộc với Admin) */}
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/login/otp" element={<AdminVerifyOtpPage />} />
        <Route path="/login/2fa" element={<AdminTwoFactorPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        {/* A1 Tổng quan chưa làm → tạm vào A2 */}
        <Route path="/" element={<Navigate to="/nurse-verification" replace />} />
        <Route path="/nurse-verification" element={<VerificationQueuePage />} />
        <Route path="/nurse-verification/:nurseId" element={<NurseReviewPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
