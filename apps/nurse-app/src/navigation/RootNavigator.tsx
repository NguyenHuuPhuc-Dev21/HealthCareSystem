import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Briefcase, Calendar, ClipboardList, Home, User, Wallet } from 'lucide-react-native';
import type { MobileShiftSummary } from '@healthcare-system/shared';
import { StateView } from '../components';
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
import {
  ShiftResultScreen,
} from '../features/placeholders/ZoneScreens';
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

function MainTabsNavigator({
  initialShift,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
}: RootNavigatorProps) {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.brandJade,
        tabBarInactiveTintColor: tokens.colors.inkSecondary,
        tabBarStyle: {
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
          backgroundColor: tokens.colors.paper,
          borderTopColor: tokens.colors.borderHairline,
        },
        tabBarLabelStyle: {
          fontSize: 12.5,
          fontWeight: '700',
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
                  onRequestCurrentPosition={locationProvider}
                  onCaptureLivePhoto={backCameraProvider}
                  onShiftCompleted={(outcome) =>
                    navigation.replace('ShiftResult', {
                      outcomeType: outcome?.type === 'CANCELLED_SAFE' ? 'CANCELLED_SAFE' : 'COMPLETED',
                      note: outcome?.note,
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
});

