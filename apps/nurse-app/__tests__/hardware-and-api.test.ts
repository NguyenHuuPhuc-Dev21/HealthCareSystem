import Geolocation from 'react-native-geolocation-service';
import {
  createCameraProvider,
  createLocationProvider,
  getHardwareCapabilityStatus,
  registerCameraCaptureHandler,
} from '../src/lib/hardware-providers';
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
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' },
  },
  RESULTS: { GRANTED: 'granted', LIMITED: 'limited' },
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
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
});
