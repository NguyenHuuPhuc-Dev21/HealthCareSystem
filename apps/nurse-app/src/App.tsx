import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { MobileShiftSummary } from '@healthcare-system/shared';
import { LiveCameraProvider } from './components';
import { AuthProvider } from './features/auth/AuthContext';
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
        <LiveCameraProvider>
          <RootNavigator
            initialShift={initialShift}
            onRequestCurrentPosition={onRequestCurrentPosition}
            onCaptureLivePhoto={onCaptureLivePhoto}
          />
        </LiveCameraProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
