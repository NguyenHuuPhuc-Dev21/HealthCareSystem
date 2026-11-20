declare module 'react-native-config' {
  export interface NativeConfig {
    API_BASE_URL?: string;
    USE_MOCK_AUTH?: string;
    USE_MOCK_SHIFTS?: string;
    USE_MOCK_AVAILABILITY?: string;
    USE_MOCK_WALLET?: string;
  }
  export const Config: NativeConfig;
  export default Config;
}
