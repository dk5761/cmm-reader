# Test Directory Structure

This directory contains all test-related configuration and utilities.

## Structure

```
test/
├── config/               # Jest configuration files
│   ├── jest.config.js           # Main config for component/integration tests
│   └── jest.logic.config.js     # Config for pure logic tests
├── setup/                # Jest setup files
│   ├── jest.setup.js            # Setup for main tests (Expo SDK 54 fixes)
│   └── jest.setup.logic.js      # Setup for logic tests
├── mocks/                # Mock files
│   └── fileMock.js              # Asset mocks (images, fonts, etc.)
└── utils/                # Shared test utilities (in src/__tests__/utils/)

```

## Configuration Files

### `config/jest.config.js`

Main Jest configuration for testing:

- React Native components
- Expo modules
- Integration tests
- Uses `jest-expo` preset

### `config/jest.logic.config.js`

Specialized configuration for:

- Pure business logic
- Utilities without React Native dependencies
- Faster test execution
- Uses `react-native` preset

## Setup Files

### `setup/jest.setup.js`

Main setup file with:

- Expo SDK 54 Winter Runtime fix
- `structuredClone` polyfill
- `__ExpoImportMetaRegistry` mock
- Realm, Firebase, and native module mocks

### `setup/jest.setup.logic.js`

Minimal setup for logic tests:

- Basic React Native mocks
- Minimal Realm mocks
- No heavy dependencies

## Mocks

### `mocks/fileMock.js`

Handles imports of:

- Images (jpg, png, webp, svg)
- Fonts (ttf, woff, woff2)
- Media files (mp4, mp3, etc.)

## Usage

### Run all tests

\`\`\`bash
npm test
\`\`\`

### Run with coverage

\`\`\`bash
npm run test:coverage
\`\`\`

### Run in watch mode

\`\`\`bash
npm run test:watch
\`\`\`

### Run logic tests only

\`\`\`bash
jest --config jest.config.logic.js
\`\`\`

## Adding New Tests

1. Create test file next to source: `MyComponent.test.tsx`
2. Or create in `__tests__` directory: `__tests__/MyComponent.test.tsx`
3. Use fixtures from `src/__tests__/fixtures/`
4. Use utilities from `src/__tests__/utils/`

## Coverage Thresholds

Current thresholds (defined in `config/jest.config.js`):

- Branches: 40%
- Functions: 40%
- Lines: 40%
- Statements: 40%

These can be increased as test coverage improves.
