import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Briefcase, Calendar, ClipboardList, Home, User, Wallet } from 'lucide-react-native';
import type {
  CommissionDebtDto,
  DepositRefundRequestDto,
  DepositStatusDto,
  MobileShiftSummary,
} from '@healthcare-system/shared';
import {
  AppBanner,
  getCommissionBannerMeta,
  getDepositBannerMeta,
  StateView,
} from '../components';
import { useAuth } from '../features/auth/AuthContext';
import { PhoneLoginScreen } from '../features/auth/PhoneLoginScreen';
import { OtpScreen } from '../features/auth/OtpScreen';
import { CompleteRegistrationScreen } from '../features/auth/CompleteRegistrationScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { ShiftBriefingScreen } from '../features/shift-briefing/ShiftBriefingScreen';
import { CheckInScreen } from '../features/check-in/CheckInScreen';
import { ActiveShiftScreen } from '../features/active-shift/ActiveShiftScreen';
import { OnboardingWizardScreen } from '../features/onboarding/OnboardingWizardScreen';
import { PendingApprovalScreen } from '../features/onboarding/PendingApprovalScreen';
import { AccountLockedScreen } from '../features/onboarding/AccountLockedScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { CredentialsScreen } from '../features/credentials/CredentialsScreen';
import { RenewGphnScreen } from '../features/credentials/RenewGphnScreen';
import { MyShiftsScreen } from '../features/shifts/MyShiftsScreen';
import { CompletedShiftDetailScreen } from '../features/shifts/CompletedShiftDetailScreen';
import { AvailabilityScreen } from '../features/availability/AvailabilityScreen';
import { JobBoardScreen } from '../features/job-board/JobBoardScreen';
import { JobDetailScreen } from '../features/job-board/JobDetailScreen';
import { RadarScreen } from '../features/radar/RadarScreen';
import { WalletScreen } from '../features/wallet/WalletScreen';
import { TransactionHistoryScreen } from '../features/wallet/TransactionHistoryScreen';
import { DepositScreen } from '../features/wallet/DepositScreen';
import { PenaltyDetailScreen } from '../features/wallet/PenaltyDetailScreen';
import { AppealPenaltyScreen } from '../features/wallet/AppealPenaltyScreen';
import { AccountClosureScreen } from '../features/wallet/AccountClosureScreen';
import { WithdrawScreen } from '../features/wallet/WithdrawScreen';
import { CommissionPaymentScreen } from '../features/commission-payment/CommissionPaymentScreen';
import { TrustScoreScreen } from '../features/trust-score/TrustScoreScreen';
import { DisputeListScreen } from '../features/disputes/DisputeListScreen';
import { DisputeDetailScreen } from '../features/disputes/DisputeDetailScreen';
import { OpenDisputeScreen } from '../features/disputes/OpenDisputeScreen';
import { ChatScreen } from '../features/chat/ChatScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { getDepositStatus, getRefundRequest } from '../features/wallet/deposit.api';
import { getCommissionDebts } from '../features/commission-payment/commission-payment.api';
import { ShiftResultScreen } from '../features/active-shift/ShiftResultScreen';
import {
  createCameraProvider,
  createLocationProvider,
  type DeviceGeoCoords,
} from '../lib/hardware-providers';
import { tokens } from '../styles/tokens';
import type {
  ActiveStackParamList,
  AuthStackParamList,
  MainTabParamList,
  OnboardingStackParamList,
} from './types';

export interface RootNavigatorProps {
  initialShift?: MobileShiftSummary;
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
}

export const navigationRef = createNavigationContainerRef<
  ActiveStackParamList & MainTabParamList & AuthStackParamList
>();

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const ActiveStack = createNativeStackNavigator<ActiveStackParamList>();

function MainTabsWithBannerTabBar(props: BottomTabBarProps) {
  const [depositStatus, setDepositStatus] = React.useState<DepositStatusDto | null>(null);
  const [refundRequest, setRefundRequest] = React.useState<DepositRefundRequestDto | null>(null);
  const [commissionDebts, setCommissionDebts] = React.useState<CommissionDebtDto[]>([]);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const [stRes, refRes, commRes] = await Promise.all([
          getDepositStatus(),
          getRefundRequest(),
          getCommissionDebts(),
        ]);
        if (active && stRes.success) setDepositStatus(stRes.data);
        if (active && refRes.success) setRefundRequest(refRes.data);
        if (active && commRes.success) setCommissionDebts(commRes.data);
      } catch {
        // ignore
      }
    };
    void fetchStatus();
    const timer = setInterval(() => {
      void fetchStatus();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const commissionBanner = getCommissionBannerMeta(commissionDebts);
  const depositBanner = getDepositBannerMeta(depositStatus, refundRequest);
  // Overdue commission takes highest precedence as it locks new shift assignments
  const bannerMeta = commissionBanner || depositBanner;

  return (
    <View style={styles.tabBarWrap}>
      {bannerMeta && !dismissed ? (
        <View style={styles.tabBannerContainer}>
          <AppBanner
            kind={bannerMeta.kind}
            title={bannerMeta.title}
            message={bannerMeta.message}
            actionLabel={bannerMeta.actionLabel}
            onAction={() => {
              if (bannerMeta.actionRoute) {
                navigationRef.navigate(bannerMeta.actionRoute as any);
              }
            }}
            onClose={() => setDismissed(true)}
          />
        </View>
      ) : null}
      <BottomTabBar {...props} />
    </View>
  );
}

function MainTabsNavigator({
  initialShift,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
}: RootNavigatorProps) {
  return (
    <MainTab.Navigator
      tabBar={(props) => <MainTabsWithBannerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.brandJadeDark,
        tabBarInactiveTintColor: tokens.colors.inkSecondary,
        tabBarActiveBackgroundColor: tokens.colors.brandJadeSoft,
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 3,
          marginVertical: 4,
          paddingVertical: 4,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarStyle: {
          height: 68,
          paddingTop: 4,
          paddingBottom: 6,
          paddingHorizontal: 6,
          backgroundColor: tokens.colors.paper,
          borderTopColor: tokens.colors.borderHairline,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <MainTab.Screen
        name="HomeTab"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      >
        {(props) => (
          <HomeScreen
            {...props}
            initialShift={initialShift}
            onRequestCurrentPosition={onRequestCurrentPosition}
            onCaptureLivePhoto={onCaptureLivePhoto}
          />
        )}
      </MainTab.Screen>
      <MainTab.Screen
        name="JobsTab"
        component={JobBoardScreen}
        options={{
          title: 'Việc làm',
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
        }}
      />
      <MainTab.Screen
        name="ShiftsTab"
        component={MyShiftsScreen}
        options={{
          title: 'Ca trực',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <MainTab.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{
          title: 'Ví',
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <MainTab.Screen
        name="ProfileTab"
        component={AccountScreen}
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </MainTab.Navigator>
  );
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  initialShift,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
}) => {
  const { hydrated, zone } = useAuth();

  if (!hydrated) {
    return (
      <View style={styles.bootWrap}>
        <StateView kind="loading" title="Đang khởi tạo CareNest" message="Đang kiểm tra phiên đăng nhập..." />
      </View>
    );
  }

  const locationProvider = createLocationProvider(onRequestCurrentPosition);
  const frontCameraProvider = createCameraProvider(onCaptureLivePhoto, {
    facing: 'front',
    instruction: 'Chụp ảnh chân dung trực tiếp tại nhà người bệnh để điểm danh.',
  });
  const backCameraProvider = createCameraProvider(onCaptureLivePhoto, {
    facing: 'back',
    instruction: 'Chụp rõ toa thuốc / chỉ định gốc làm bằng chứng từ chối ca.',
  });

  return (
    <NavigationContainer ref={navigationRef}>
      {zone === 'auth' ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
          <AuthStack.Screen name="Otp" component={OtpScreen} />
          <AuthStack.Screen
            name="CompleteRegistration"
            component={CompleteRegistrationScreen}
          />
        </AuthStack.Navigator>
      ) : zone === 'onboarding' || zone === 'pending' || zone === 'locked' ? (
        <OnboardingStack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={
            zone === 'locked'
              ? 'AccountLocked'
              : zone === 'pending'
              ? 'PendingApproval'
              : 'OnboardingWizard'
          }
        >
          <OnboardingStack.Screen name="OnboardingWizard" component={OnboardingWizardScreen} />
          <OnboardingStack.Screen name="PendingApproval" component={PendingApprovalScreen} />
          <OnboardingStack.Screen name="AccountLocked" component={AccountLockedScreen} />
        </OnboardingStack.Navigator>
      ) : (
        <ActiveStack.Navigator screenOptions={{ headerShown: false }}>
          <ActiveStack.Screen name="MainTabs">
            {() => (
              <MainTabsNavigator
                initialShift={initialShift}
                onRequestCurrentPosition={onRequestCurrentPosition}
                onCaptureLivePhoto={onCaptureLivePhoto}
              />
            )}
          </ActiveStack.Screen>
          <ActiveStack.Screen name="ShiftBriefing">
            {({ navigation, route }) => {
              const { shift } = route.params;
              return (
                <ShiftBriefingScreen
                  bookingId={shift.bookingId}
                  bookingCode={shift.bookingCode}
                  serviceName={shift.serviceName}
                  timeRange={shift.timeRange}
                  patientName={shift.patientName}
                  patientAge={shift.patientAge}
                  patientAddress={shift.patientAddress}
                  mobilityNote={shift.mobilityNote || 'Chưa có ghi chú vận động'}
                  allergies={shift.allergies || 'Chưa ghi nhận dị ứng'}
                  isInvasive={shift.isInvasive}
                  prescriptionSummary={shift.prescriptionSummary}
                  onOpenChat={() =>
                    navigation.navigate('Chat', {
                      bookingId: shift.bookingId,
                      bookingCode: shift.bookingCode,
                    })
                  }
                  onProceedToCheckIn={() => navigation.navigate('CheckIn', { shift })}
                  onBack={() => navigation.goBack()}
                />
              );
            }}
          </ActiveStack.Screen>
          <ActiveStack.Screen name="CheckIn">
            {({ navigation, route }) => {
              const { shift } = route.params;
              return (
                <CheckInScreen
                  bookingId={shift.bookingId}
                  bookingCode={shift.bookingCode}
                  patientAddress={shift.patientAddress}
                  patientLatitude={shift.patientLatitude}
                  patientLongitude={shift.patientLongitude}
                  onRequestCurrentPosition={locationProvider}
                  onCaptureLivePhoto={frontCameraProvider}
                  onCheckInSuccess={() => navigation.replace('ActiveShift', { shift })}
                  onCancel={() => navigation.goBack()}
                />
              );
            }}
          </ActiveStack.Screen>
          <ActiveStack.Screen name="ActiveShift">
            {({ navigation, route }) => {
              const { shift } = route.params;
              return (
                <ActiveShiftScreen
                  bookingId={shift.bookingId}
                  bookingCode={shift.bookingCode}
                  patientName={shift.patientName}
                  patientAge={shift.patientAge}
                  patientAddress={shift.patientAddress}
                  patientLatitude={shift.patientLatitude}
                  patientLongitude={shift.patientLongitude}
                  serviceName={shift.serviceName}
                  isInvasive={shift.isInvasive}
                  paymentMethod={shift.paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH'}
                  bookingAmount={shift.totalAmount}
                  onPayCommissionNow={(bookingId) =>
                    navigation.replace('CommissionPayment', { bookingId })
                  }
                  onOpenDispute={(bookingId) =>
                    navigation.navigate('OpenDispute', { bookingId })
                  }
                  onOpenChat={(bookingId) =>
                    navigation.navigate('Chat', {
                      bookingId,
                      bookingCode: shift.bookingCode,
                    })
                  }
                  onRequestCurrentPosition={locationProvider}
                  onCaptureLivePhoto={backCameraProvider}
                  onShiftCompleted={(outcome) =>
                    navigation.replace('ShiftResult', {
                      outcomeType: outcome?.type === 'CANCELLED_SAFE' ? 'CANCELLED_SAFE' : 'COMPLETED',
                      note: outcome?.note,
                      bookingId: shift.bookingId,
                      bookingCode: shift.bookingCode,
                      customerName: shift.patientName,
                    })
                  }
                />
              );
            }}
          </ActiveStack.Screen>
          <ActiveStack.Screen name="ShiftResult" component={ShiftResultScreen} />
          <ActiveStack.Screen name="Credentials" component={CredentialsScreen} />
          <ActiveStack.Screen name="RenewGphn" component={RenewGphnScreen} />
          <ActiveStack.Screen
            name="CompletedShiftDetail"
            component={CompletedShiftDetailScreen}
          />
          <ActiveStack.Screen
            name="JobDetail"
            component={JobDetailScreen}
          />
          <ActiveStack.Screen
            name="Radar"
            component={RadarScreen}
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              animation: 'fade',
            }}
          />
          <ActiveStack.Screen
            name="Availability"
            component={AvailabilityScreen}
          />
          <ActiveStack.Screen
            name="TransactionHistory"
            component={TransactionHistoryScreen}
          />
          <ActiveStack.Screen
            name="Deposit"
            component={DepositScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="PenaltyDetail"
            component={PenaltyDetailScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="AppealPenalty"
            component={AppealPenaltyScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="AccountClosure"
            component={AccountClosureScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="CommissionPayment"
            component={CommissionPaymentScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="Withdraw"
            component={WithdrawScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="TrustScore"
            component={TrustScoreScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="DisputeList"
            component={DisputeListScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="DisputeDetail"
            component={DisputeDetailScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="OpenDispute"
            component={OpenDisputeScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
          <ActiveStack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: false }}
          />
        </ActiveStack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  bootWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: tokens.colors.canvas,
  },
  tabBarWrap: {
    backgroundColor: tokens.colors.paper,
  },
  tabBannerContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: tokens.colors.canvas,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
  },
});

