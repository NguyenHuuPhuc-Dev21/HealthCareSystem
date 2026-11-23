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
  createTriggerNotification: jest.fn().mockResolvedValue('trigger-notif-1'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
  getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  onForegroundEvent: jest.fn(() => () => {}),
  onBackgroundEvent: jest.fn(),
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
  },
  TriggerType: {
    TIMESTAMP: 0,
    INTERVAL: 1,
  },
  EventType: {
    DISMISSED: 0,
    PRESS: 1,
    ACTION_PRESS: 2,
  },
}));

// react-native-svg mock for lucide-react-native & SVG charts
jest.mock('react-native-svg', () => {
  const React = require('react');
  const createComponent = (name) => (props) => React.createElement(name, props, props.children);
  return {
    __esModule: true,
    default: createComponent('Svg'),
    Svg: createComponent('Svg'),
    Circle: createComponent('Circle'),
    Ellipse: createComponent('Ellipse'),
    G: createComponent('G'),
    Text: createComponent('Text'),
    TSpan: createComponent('TSpan'),
    TextPath: createComponent('TextPath'),
    Path: createComponent('Path'),
    Polygon: createComponent('Polygon'),
    Polyline: createComponent('Polyline'),
    Line: createComponent('Line'),
    Rect: createComponent('Rect'),
    Use: createComponent('Use'),
    Image: createComponent('Image'),
    Symbol: createComponent('Symbol'),
    Defs: createComponent('Defs'),
    LinearGradient: createComponent('LinearGradient'),
    RadialGradient: createComponent('RadialGradient'),
    Stop: createComponent('Stop'),
    ClipPath: createComponent('ClipPath'),
    Pattern: createComponent('Pattern'),
    Mask: createComponent('Mask'),
  };
});

