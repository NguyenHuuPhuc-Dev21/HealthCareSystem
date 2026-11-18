import { NativeModules, Platform } from 'react-native';

const DEFAULT_API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/v1'
    : 'http://localhost:3000/api/v1';

let nativeConfig: Record<string, string | undefined> = {};
try {
  const RNCConfig = NativeModules.RNCConfig;
  if (RNCConfig) {
    nativeConfig = RNCConfig;
  }
} catch {
  // fallback if native module is not yet compiled
}

export const env = {
  get apiBaseUrl(): string {
    return nativeConfig.API_BASE_URL?.trim() || process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
  },
  get useMockAuth(): boolean {
    return nativeConfig.USE_MOCK_AUTH === 'true' || process.env.USE_MOCK_AUTH === 'true';
  },
  get useMockOnboarding(): boolean {
    return (
      nativeConfig.USE_MOCK_ONBOARDING === 'true' ||
      process.env.USE_MOCK_ONBOARDING === 'true' ||
      this.useMockAuth
    );
  },
  get useMockShifts(): boolean {
    return nativeConfig.USE_MOCK_SHIFTS !== 'false' && process.env.USE_MOCK_SHIFTS !== 'false';
  },
  get supportHotline(): string {
    return nativeConfig.SUPPORT_HOTLINE?.trim() || process.env.SUPPORT_HOTLINE || '1900 6868';
  },
};

