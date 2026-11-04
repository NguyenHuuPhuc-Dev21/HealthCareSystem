import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { OtpPage } from '../features/auth/OtpPage';
import { LockedPage } from '../features/auth/LockedPage';
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard';
import { PendingPage } from '../features/onboarding/PendingPage';
import { CredentialsPage } from '../features/credentials/CredentialsPage';
import { NurseHomePage } from '../features/home/NurseHomePage';
import { ProtectedRoute } from './ProtectedRoute';

/** Thanh SETUP của NAV-0: chỉ logo + chip trạng thái, dùng cho SH3/SH4. */
const SetupShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>
    <div className="setup-bar">
      <span>CareNest</span>
      <span className="badge badge-pending">Đang thiết lập hồ sơ</span>
    </div>
    <div className="page-shell">{children}</div>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/otp" element={<OtpPage />} />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute zone="onboarding">
                <SetupShell>
                  <OnboardingWizard />
                </SetupShell>
              </ProtectedRoute>
            }
          />
          {/* Nộp lại một giấy tờ bị từ chối: vẫn là wizard, nhưng mở từ khu vực chờ duyệt. */}
          <Route
            path="/onboarding-fix"
            element={
              <ProtectedRoute zone="pending">
                <SetupShell>
                  <OnboardingWizard />
                </SetupShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending"
            element={
              <ProtectedRoute zone="pending">
                <PendingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/locked"
            element={
              <ProtectedRoute zone="locked">
                <LockedPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute zone="active">
                <NurseHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/credentials"
            element={
              <ProtectedRoute zone="active">
                <CredentialsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};