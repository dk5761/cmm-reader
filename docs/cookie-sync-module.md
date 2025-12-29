# CookieSync Native Module

A native iOS Expo module that extracts cookies from WKWebView's isolated cookie store for Cloudflare bypass.

## The Problem

iOS isolates WKWebView cookies from the app's HTTP client:

```
┌─────────────────────────────────────────────────────────────┐
│                    iOS App Memory Space                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │     WKWebView       │    │    Axios / fetch    │         │
│  │  (React Native)     │    │   (HTTP requests)   │         │
│  └──────────┬──────────┘    └──────────┬──────────┘         │
│             │                          │                     │
│             ▼                          ▼                     │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │  WKHTTPCookieStore  │    │ NSHTTPCookieStorage │         │
│  │  (separate process) │    │   (app process)     │         │
│  └─────────────────────┘    └─────────────────────┘         │
│             ❌ ISOLATED - Cookies don't share!              │
└─────────────────────────────────────────────────────────────┘
```

When a user completes a Cloudflare challenge in WKWebView, the `cf_clearance` cookie is stored in `WKHTTPCookieStore`. This cookie is **not accessible** to Axios or `@react-native-cookies/cookies` on physical iOS devices.

## The Solution

This module uses native Swift code to access `WKWebsiteDataStore.default().httpCookieStore` directly.

## File Structure

```
modules/cookie-sync/
├── expo-module.config.json    # Expo autolinking config
├── package.json               # npm package definition
├── CookieSync.podspec         # CocoaPods specification
├── index.ts                   # TypeScript API wrapper
└── ios/
    └── CookieSyncModule.swift # Native Swift implementation
```

## API

```typescript
import CookieSync from "cookie-sync";

// Get cookie string for HTTP headers
const cookies = await CookieSync.getCookieString(url);
// Returns: "cf_clearance=abc123; __cfduid=xyz789"

// Check if cf_clearance cookie exists
const hasCf = await CookieSync.hasCfClearance(url);
// Returns: true | false

// Get all cookies as array
const cookieList = await CookieSync.getCookiesFromWebView(url);
// Returns: [{ name, value, domain, path, isHTTPOnly, isSecure, expiresDate }]

// Sync WKWebView cookies to NSHTTPCookieStorage
await CookieSync.syncCookiesToNative(url);
// Useful if you want native URLSession to use these cookies
```

## Swift Implementation Details

### Key APIs Used

1. **`WKWebsiteDataStore.default()`** - Shared data store for all WKWebViews
2. **`.httpCookieStore`** - The cookie store within that data store
3. **`.getAllCookies()`** - Async method that returns all stored cookies

### Threading

All WebKit APIs must run on the main thread:

```swift
DispatchQueue.main.async {
    cookieStore.getAllCookies { cookies in
        // Process cookies here
    }
}
```

### Domain Matching

Cookies have domains like `.kissmanga.in` (note the leading dot). The module normalizes these for comparison:

```swift
private func cookieMatchesDomain(cookie: HTTPCookie, targetDomain: String) -> Bool {
    let cookieDomain = cookie.domain.hasPrefix(".")
        ? String(cookie.domain.dropFirst())
        : cookie.domain
    return targetDomain.hasSuffix(cookieDomain) ||
           cookieDomain.hasSuffix(targetDomain)
}
```

## Platform Support

- **iOS**: Full support via native module
- **Android**: Not needed - `@react-native-cookies/cookies` works fine on Android

The TypeScript wrapper returns empty/false values on non-iOS platforms:

```typescript
const CookieSyncModule =
  Platform.OS === "ios" ? requireNativeModule("CookieSync") : null;
```

## Building

After making changes to the Swift code:

```bash
pnpm prebuild:ios --clean
npx expo run:ios --device
```

The `--clean` flag is required to regenerate `ExpoModulesProvider.swift`.
