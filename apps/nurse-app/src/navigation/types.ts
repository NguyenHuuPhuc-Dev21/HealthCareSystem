import type { MobileShiftSummary } from '@healthcare-system/shared';

export type AuthStackParamList = {
  PhoneLogin: undefined;
  Otp: {
    phone: string;
    requestId: string;
    resendAfterSeconds: number;
    devOtp?: string;
  };
  CompleteRegistration: {
    registrationToken: string;
    phone: string;
  };
};

export type OnboardingStackParamList = {
  OnboardingWizard: undefined;
  PendingApproval: undefined;
  AccountLocked: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  JobsTab: undefined;
  ShiftsTab: undefined;
  ScheduleTab: undefined;
  ProfileTab: undefined;
};

export type ActiveStackParamList = {
  MainTabs: undefined;
  ShiftBriefing: { shift: MobileShiftSummary };
  CheckIn: { shift: MobileShiftSummary };
  ActiveShift: { shift: MobileShiftSummary };
  ShiftResult: {
    outcomeType: 'COMPLETED' | 'CANCELLED_SAFE';
    note?: string;
  };
};

