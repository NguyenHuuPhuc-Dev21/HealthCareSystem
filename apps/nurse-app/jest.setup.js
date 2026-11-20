jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

// Encrypted Storage mock
jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

// Firebase App & Messaging mocks
jest.mock('@react-native-firebase/app', () => ({
  initializeApp: jest.fn(),
}));

const mockMessagingInstance = {
  requestPermission: jest.fn().mockResolvedValue(1),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token-12345'),
  deleteToken: jest.fn().mockResolvedValue(true),
  onTokenRefresh: jest.fn((callback) => {
    return () => {};
  }),
  onMessage: jest.fn((callback) => {
    return () => {};
  }),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  setBackgroundMessageHandler: jest.fn(),
};

const mockMessaging = () => mockMessagingInstance;
mockMessaging.AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

jest.mock('@react-native-firebase/messaging', () => mockMessaging);

// Notifee mock
jest.mock('@notifee/react-native', () => ({
  createChannel: jest.fn().mockResolvedValue('radar'),
  displayNotification: jest.fn().mockResolvedValue('notif-id-1'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  onForegroundEvent: jest.fn(() => () => {}),
  onBackgroundEvent: jest.fn(),
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
  },
  EventType: {
    DISMISSED: 0,
    PRESS: 1,
    ACTION_PRESS: 2,
  },
}));

