declare module 'react-native-config' {
  export interface NativeConfig {
    API_BASE_URL?: string;
    USE_MOCK_AUTH?: string;
    USE_MOCK_SHIFTS?: string;
    USE_MOCK_AVAILABILITY?: string;
    USE_MOCK_JOB_BOARD?: string;
    USE_MOCK_WALLET?: string;
    USE_MOCK_TRUST_SCORE?: string;
    USE_MOCK_REVIEWS?: string;
    USE_MOCK_DISPUTES?: string;
    MOCK_DEPOSIT_SCENARIO?: string;
  }
  export const Config: NativeConfig;
  export default Config;
}
