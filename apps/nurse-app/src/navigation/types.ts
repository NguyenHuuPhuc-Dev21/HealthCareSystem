import type { DocType, MobileShiftSummary, RadarJob } from '@healthcare-system/shared';

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
  OnboardingWizard: { fixDocType?: DocType } | undefined;
  PendingApproval: undefined;
  AccountLocked: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  JobsTab: undefined;
  ShiftsTab: undefined;
  WalletTab: undefined;
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
    bookingId?: string;
    bookingCode?: string;
    customerName?: string;
  };
  Credentials: undefined;
  RenewGphn: undefined;
  CompletedShiftDetail: { bookingId: string };
  JobDetail: { jobId: string; isDirectInvite?: boolean };
  Radar: { offerId: string; offer?: RadarJob; notificationId?: string };
  Availability: undefined;
  TransactionHistory: undefined;
  Deposit: undefined;
  PenaltyDetail: { transactionId: string };
  AppealPenalty: { transactionId: string };
  AccountClosure: undefined;
  CommissionPayment: { bookingId?: string } | undefined;
  Withdraw: undefined;
  TrustScore: undefined;
  DisputeList: undefined;
  DisputeDetail: { disputeId: string };
  OpenDispute: { bookingId: string };
};
