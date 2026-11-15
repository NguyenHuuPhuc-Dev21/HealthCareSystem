import { NativeModules, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';

export interface DeviceGeoCoords {
  latitude: number;
  longitude: number;
  isMockLocation?: boolean;
}

export interface HardwareProviderOverrides {
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
}

export type CameraFacing = 'front' | 'back';

export interface LiveCameraCaptureOptions {
  facing?: CameraFacing;
  instruction?: string;
}

type CameraCaptureHandler = (options?: LiveCameraCaptureOptions) => Promise<string | null>;

interface NativeLocationBridge {
  getCurrentPosition?: () => Promise<DeviceGeoCoords>;
}

interface NativeCameraBridge {
  captureLiveSelfie?: () => Promise<string | null>;
  launchCamera?: (
    options?: Record<string, unknown>
  ) => Promise<{ uri?: string; assets?: Array<{ uri?: string }> }>;
}

export const IS_DEV = (globalThis as { __DEV__?: boolean }).__DEV__ === true;

const DEV_SAMPLE_PHOTO_URL =
  'https://images.unsplash.com/photo-1594824813583-1180b271d440?auto=format&fit=crop&w=400&q=80';

let activeCameraHandler: CameraCaptureHandler | null = null;

/**
 * Registers the in-app VisionCamera modal handler so any screen calling
 * createCameraProvider() triggers real direct camera capture without gallery access.
 */
export function registerCameraCaptureHandler(handler: CameraCaptureHandler | null): void {
  activeCameraHandler = handler;
}

function getNativeLocationBridge(): NativeLocationBridge | undefined {
  const mods = NativeModules as Record<string, NativeLocationBridge | undefined>;
  return mods.CareNestLocation || mods.LocationModule;
}

function getNativeCameraBridge(): NativeCameraBridge | undefined {
  const mods = NativeModules as Record<string, NativeCameraBridge | undefined>;
  return mods.CareNestCamera || mods.CameraModule || mods.ImagePickerManager;
}

export async function ensureLocationPermission(): Promise<boolean> {
  const permission =
    Platform.OS === 'android'
      ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
      : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;

  const current = await check(permission);
  if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) {
    return true;
  }
  const requested = await request(permission);
  return requested === RESULTS.GRANTED || requested === RESULTS.LIMITED;
}

export function getHardwareCapabilityStatus(overrides?: HardwareProviderOverrides) {
  const hasLocationProvider = Boolean(
    overrides?.onRequestCurrentPosition ||
      typeof Geolocation?.getCurrentPosition === 'function' ||
      getNativeLocationBridge()?.getCurrentPosition
  );

  const cameraBridge = getNativeCameraBridge();
  const hasCameraProvider = Boolean(
    overrides?.onCaptureLivePhoto ||
      activeCameraHandler ||
      cameraBridge?.captureLiveSelfie ||
      cameraBridge?.launchCamera
  );

  return {
    hasLocationProvider,
    hasCameraProvider,
    isReadyForRelease: hasLocationProvider && hasCameraProvider,
  };
}

export function createLocationProvider(
  override?: () => Promise<DeviceGeoCoords>
): () => Promise<DeviceGeoCoords> {
  if (override) {
    return override;
  }

  return async () => {
    const nativeLoc = getNativeLocationBridge();
    if (nativeLoc?.getCurrentPosition) {
      return nativeLoc.getCurrentPosition();
    }

    const granted = await ensureLocationPermission();
    if (!granted) {
      throw new Error('Ứng dụng chưa được cấp quyền vị trí GPS. Vui lòng cấp quyền trong Cài đặt.');
    }

    if (typeof Geolocation?.getCurrentPosition === 'function') {
      return new Promise<DeviceGeoCoords>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              isMockLocation: Boolean(
                pos.mocked || (pos.coords as { mocked?: boolean }).mocked
              ),
            }),
          (err) => reject(new Error(err?.message || 'Không thể đọc vị trí GPS thiết bị.')),
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
            forceRequestLocation: true,
          }
        );
      });
    }

    throw new Error('Thiết bị chưa có mô-đun định vị GPS khả dụng.');
  };
}

export function createCameraProvider(
  override?: () => Promise<string | null>,
  options: LiveCameraCaptureOptions = { facing: 'front' }
): () => Promise<string | null> {
  if (override) {
    return override;
  }

  return async () => {
    if (activeCameraHandler) {
      return activeCameraHandler(options);
    }

    const nativeCam = getNativeCameraBridge();
    if (nativeCam?.captureLiveSelfie) {
      return nativeCam.captureLiveSelfie();
    }
    if (nativeCam?.launchCamera) {
      const res = await nativeCam.launchCamera({ mediaType: 'photo', cameraType: options.facing ?? 'front' });
      return res?.uri || res?.assets?.[0]?.uri || null;
    }

    if (IS_DEV) {
      return DEV_SAMPLE_PHOTO_URL;
    }

    throw new Error('Chưa kết nối mô-đun camera phần cứng để chụp ảnh xác thực trực tiếp.');
  };
}
