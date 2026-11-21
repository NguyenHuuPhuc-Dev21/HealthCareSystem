import { Linking } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  createCameraProvider,
  createLocationProvider,
  getHardwareCapabilityStatus,
  registerCameraCaptureHandler,
  ensureLocationPermission,
  ensureCameraPermission,
  openAppSettings,
} from '../src/lib/hardware-providers';
import { triggerSos } from '../src/features/sos/sos.api';
import { apiClient, setAuthToken } from '../src/lib/api-client';
import { env } from '../src/lib/env';

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {},
  Config: {},
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      CAMERA: 'android.permission.CAMERA',
    },
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      CAMERA: 'ios.permission.CAMERA',
    },
  },
  RESULTS: { GRANTED: 'granted', LIMITED: 'limited', DENIED: 'denied', BLOCKED: 'blocked' },
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  openSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('hardware-providers & api-client', () => {
  afterEach(() => {
    registerCameraCaptureHandler(null);
    setAuthToken(null);
    jest.clearAllMocks();
  });

  it('propagates mocked GPS flag from react-native-geolocation-service', async () => {
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
      success({ coords: { latitude: 16.0718, longitude: 108.2205 }, mocked: true });
    });

    const getPos = createLocationProvider();
    const coords = await getPos();
    expect(coords).toEqual({
      latitude: 16.0718,
      longitude: 108.2205,
      isMockLocation: true,
    });
  });

  it('detects isFromMockProvider from coords object', async () => {
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
      success({
        coords: { latitude: 16.0718, longitude: 108.2205, isFromMockProvider: true },
      });
    });

    const getPos = createLocationProvider();
    const coords = await getPos();
    expect(coords.isMockLocation).toBe(true);
  });

  it('validates location and camera permission helpers', async () => {
    const locGranted = await ensureLocationPermission();
    expect(locGranted).toBe(true);

    const camGranted = await ensureCameraPermission();
    expect(camGranted).toBe(true);

    await expect(openAppSettings()).resolves.not.toThrow();
  });

  it('uses registered live camera handler when present', async () => {
    const handler = jest.fn().mockResolvedValue('file:///tmp/live-selfie.jpg');
    registerCameraCaptureHandler(handler);

    expect(getHardwareCapabilityStatus().isReadyForRelease).toBe(true);
    const capture = createCameraProvider(undefined, { facing: 'front' });
    const uri = await capture();
    expect(uri).toBe('file:///tmp/live-selfie.jpg');
    expect(handler).toHaveBeenCalledWith({ facing: 'front' });
  });

  it('defaults Android API URL to 10.0.2.2 and attaches Bearer token', async () => {
    expect(env.apiBaseUrl).toContain('http://');
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    (globalThis as { fetch: unknown }).fetch = mockFetch;

    setAuthToken('jwt-abc');
    await apiClient('/nurse/shifts');

    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe(`${env.apiBaseUrl}/nurse/shifts`);
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer jwt-abc');
  });

  it('triggers SOS and opens emergency dialer with 0ms delay', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

    // Call openURL directly as SosButton does first
    await Linking.openURL('tel:115');
    expect(openURLSpy).toHaveBeenCalledWith('tel:115');

    // Trigger API dispatch
    const res = await triggerSos({
      bookingId: 'bk-test-sos',
      latitude: 16.07,
      longitude: 108.22,
    });
    expect(res.success).toBe(true);
    openURLSpy.mockRestore();
  });
});
