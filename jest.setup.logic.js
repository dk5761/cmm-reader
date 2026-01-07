
// Minimal mocks for pure logic tests
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-haptics', () => ({}));
jest.mock('expo-image', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('@react-native-cookies/cookies', () => ({}));
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));
