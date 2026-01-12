/**
 * Jest Configuration for Logic Tests
 * For testing pure business logic without React Native/Expo dependencies
 */
module.exports = {
  preset: "react-native",
  
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-image)",
  ],
  
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/test/mocks/fileMock.js",
  },
  
  testMatch: ["**/__tests__/**/*.logic.test.{ts,tsx}"],
  
  setupFiles: ["<rootDir>/test/setup/jest.setup.logic.js"],
};
