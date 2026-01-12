// Fix for Expo SDK 54+ Winter Runtime
// Polyfill structuredClone if not available
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock the __ExpoImportMetaRegistry global required by winter runtime
global.__ExpoImportMetaRegistry = new Map();

// Mock Realm database
jest.mock('realm', () => ({
  __esModule: true,
  default: jest.fn(),
  Object: class MockRealmObject {},
}));

// Mock Expo modules
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-notifications', () => ({}));

// Mock Firebase
jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

// Mock native modules
jest.mock('cookie-sync', () => ({
  getCookieString: jest.fn(),
  syncCookiesToNative: jest.fn(),
  clearCfClearance: jest.fn(),
}));

// Mock common native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.CookieSync = {
    getCookieString: jest.fn(),
    hasCfClearance: jest.fn(),
    syncCookiesToNative: jest.fn(),
    clearCfClearance: jest.fn(),
  };
  return RN;
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 0,
    Medium: 1,
    Heavy: 2,
  },
  NotificationFeedbackType: {
    Success: 0,
    Warning: 1,
    Error: 2,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-cookies/cookies', () => ({
  get: jest.fn(),
  set: jest.fn(),
  clearAll: jest.fn(),
  clearByName: jest.fn(),
}));

jest.mock('expo-image', () => ({
  Image: {
    prefetch: jest.fn(),
    clearMemoryCache: jest.fn(),
    clearDiskCache: jest.fn(),
  },
}));

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  NativeModules: {},
}));

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
