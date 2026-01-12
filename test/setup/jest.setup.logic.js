
// Define globals
global.__DEV__ = true;

// Minimal mocks for pure logic tests
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('realm', () => {
  class MockRealm {
    static Object = class {};
    static UpdateMode = {
      Never: 'never',
      Modified: 'modified',
      All: 'all',
    };
  }
  return {
    default: MockRealm,
    __esModule: true,
  };
});

jest.mock('expo-haptics', () => ({}));
jest.mock('expo-image', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@react-native-cookies/cookies', () => ({}));
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));
