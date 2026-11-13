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
  apiBaseUrl: nativeConfig.API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
  useMockAuth: nativeConfig.USE_MOCK_AUTH === 'true',
  useMockShifts: nativeConfig.USE_MOCK_SHIFTS !== 'false',
};

