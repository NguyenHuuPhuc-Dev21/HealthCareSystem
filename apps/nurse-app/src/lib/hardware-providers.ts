import { NativeModules } from 'react-native';

export interface DeviceGeoCoords {
  latitude: number;
  longitude: number;
  isMockLocation?: boolean;
}

export interface HardwareProviderOverrides {
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
}

interface GeolocationLike {
  getCurrentPosition?: (
    success: (pos: { coords: { latitude: number; longitude: number; mocked?: boolean } }) => void,
    error?: (err: { message?: string }) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number }
  ) => void;
}

interface NativeLocationBridge {
  getCurrentPosition?: () => Promise<DeviceGeoCoords>;
}

interface NativeCameraBridge {
  captureLiveSelfie?: () => Promise<string | null>;
  launchCamera?: (options?: Record<string, unknown>) => Promise<{ uri?: string; assets?: Array<{ uri?: string }> }>;
}

export const IS_DEV = (globalThis as { __DEV__?: boolean }).__DEV__ === true;

const DEV_SAMPLE_PHOTO_URL =
  'https://images.unsplash.com/photo-1594824813583-1180b271d440?auto=format&fit=crop&w=400&q=80';

function getNativeLocationBridge(): NativeLocationBridge | undefined {
  const mods = NativeModules as Record<string, NativeLocationBridge | undefined>;
  return mods.CareNestLocation || mods.LocationModule;
}

function getNativeCameraBridge(): NativeCameraBridge | undefined {
  const mods = NativeModules as Record<string, NativeCameraBridge | undefined>;
  return mods.CareNestCamera || mods.CameraModule || mods.ImagePickerManager;
}

function getGlobalGeolocation(): GeolocationLike | undefined {
  return (globalThis as { navigator?: { geolocation?: GeolocationLike } }).navigator?.geolocation;
}

export function getHardwareCapabilityStatus(overrides?: HardwareProviderOverrides) {
  const hasLocationProvider = Boolean(
    overrides?.onRequestCurrentPosition ||
      getNativeLocationBridge()?.getCurrentPosition ||
      getGlobalGeolocation()?.getCurrentPosition
  );

  const cameraBridge = getNativeCameraBridge();
  const hasCameraProvider = Boolean(
    overrides?.onCaptureLivePhoto ||
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

    const geolocation = getGlobalGeolocation();
    if (geolocation?.getCurrentPosition) {
      return new Promise<DeviceGeoCoords>((resolve, reject) => {
        geolocation.getCurrentPosition?.(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              isMockLocation: Boolean(pos.coords.mocked),
            }),
          (err) => reject(new Error(err?.message || 'Không thể đọc vị trí GPS thiết bị.')),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    throw new Error('Thiết bị chưa có mô-đun định vị GPS khả dụng.');
  };
}

export function createCameraProvider(
  override?: () => Promise<string | null>
): () => Promise<string | null> {
  if (override) {
    return override;
  }

  return async () => {
    const nativeCam = getNativeCameraBridge();
    if (nativeCam?.captureLiveSelfie) {
      return nativeCam.captureLiveSelfie();
    }
    if (nativeCam?.launchCamera) {
      const res = await nativeCam.launchCamera({ mediaType: 'photo', cameraType: 'front' });
      return res?.uri || res?.assets?.[0]?.uri || null;
    }

    if (IS_DEV) {
      return DEV_SAMPLE_PHOTO_URL;
    }

    throw new Error('Chưa kết nối mô-đun camera phần cứng để chụp ảnh xác thực trực tiếp.');
  };
}

