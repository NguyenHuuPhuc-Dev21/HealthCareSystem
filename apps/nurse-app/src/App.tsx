import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { MobileShiftSummary } from '@healthcare-system/shared';
import { LiveCameraProvider } from './components';
import { AuthProvider } from './features/auth/AuthContext';
import { NotificationProvider } from './features/notifications/NotificationContext';
import { RadarProvider } from './features/radar/RadarContext';
import type { DeviceGeoCoords } from './lib/hardware-providers';
import { RootNavigator } from './navigation/RootNavigator';

export interface NurseAppProps {
  initialShift?: MobileShiftSummary;
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
  autoStartDevSession?: boolean;
}

export default function App({
  initialShift,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
  autoStartDevSession,
}: NurseAppProps = {}) {
  return (
    <SafeAreaProvider>
      <AuthProvider autoStartDevSession={autoStartDevSession}>
        <NotificationProvider>
          <RadarProvider>
            <LiveCameraProvider>
              <RootNavigator
                initialShift={initialShift}
                onRequestCurrentPosition={onRequestCurrentPosition}
                onCaptureLivePhoto={onCaptureLivePhoto}
              />
            </LiveCameraProvider>
          </RadarProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
