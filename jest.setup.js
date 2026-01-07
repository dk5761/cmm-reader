
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
}));

jest.mock('expo-image', () => ({
  Image: {
    prefetch: jest.fn(),
    clearMemoryCache: jest.fn(),
    clearDiskCache: jest.fn(),
  },
}));
