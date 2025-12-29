# Cloudflare Challenge Integration

How CookieSync module integrates with the app's Cloudflare bypass system.

## Flow Overview

```
1. User navigates to CF-protected source (e.g., kissmanga)
                    ↓
2. Axios request triggers CF challenge (403 response)
                    ↓
3. CloudflareInterceptor catches error, attempts auto-solve via hidden WebView
                    ↓
4. Auto-solve fails → triggers manual challenge modal
                    ↓
5. Modal WebView opens with challenge page
                    ↓
6. User completes Turnstile/CAPTCHA challenge
                    ↓
7. User presses "Done" button
                    ↓
8. CookieSync extracts cf_clearance from WKWebView
                    ↓
9. CloudflareInterceptor retries request with cookies
                    ↓
10. Request succeeds ✅
```

## Components Involved

### 1. CloudflareInterceptor.ts

Location: `src/core/http/CloudflareInterceptor.ts`

Axios response interceptor that:

- Detects CF challenge responses (403 + specific HTML markers)
- Attempts auto-solve via WebViewFetcherService
- Falls back to manual challenge modal
- Retries request with extracted cookies

```typescript
if (manualResult.success && manualResult.cookies) {
  const retryConfig = {
    ...config,
    headers: { ...config.headers, Cookie: manualResult.cookies },
  };
  return axiosInstance.request(retryConfig);
}
```

### 2. WebViewFetcherContext.tsx

Location: `src/shared/contexts/WebViewFetcherContext.tsx`

React context that:

- Provides a hidden WebView for auto-solving CF challenges
- Manages the manual challenge modal UI
- Extracts cookies after user completes challenge

```typescript
// After user presses Done
if (Platform.OS === "ios") {
  cookieString = await CookieSync.getCookieString(manualChallengeUrl);
  hasCfClearance = await CookieSync.hasCfClearance(manualChallengeUrl);
} else {
  // Android: use @react-native-cookies/cookies
  const cookiesArray = await CookieManagerInstance.extractFromWebView(url);
}
```

### 3. CookieSync Module

Location: `modules/cookie-sync/`

Native iOS module that reads cookies directly from WKWebView's cookie store:

```typescript
import CookieSync from "cookie-sync";

const cookies = await CookieSync.getCookieString(url);
// Returns: "cf_clearance=abc123; session=xyz"
```

## Manual Challenge Modal

The modal appears when auto-bypass fails:

```tsx
<Modal visible={!!manualChallengeUrl} animationType="slide">
    <SafeAreaView>
        {/* Header with Cancel/Done buttons */}
        <View style={styles.modalHeader}>
            <Pressable onPress={handleManualChallengeCancel}>
                <Text>Cancel</Text>
            </Pressable>
            <Text>Complete Verification</Text>
            <Pressable onPress={handleManualChallengeDone}>
                <Text>Done</Text>
            </Pressable>
        </View>

        {/* WebView showing CF challenge */}
        <WebView
            source={{ uri: manualChallengeUrl }}
            sharedCookiesEnabled
            javaScriptEnabled
            userAgent={...} // Platform-specific
        />
    </SafeAreaView>
</Modal>
```

## Cookie Extraction Flow (iOS)

```
handleManualChallengeDone()
        ↓
CookieSync.getCookieString(url)
        ↓
[Swift] WKWebsiteDataStore.default().httpCookieStore.getAllCookies()
        ↓
[Swift] Filter cookies for domain
        ↓
[Swift] Build "name=value; name2=value2" string
        ↓
Return to JavaScript
        ↓
manualChallengeResolveRef.current({ success: true, cookies: cookieString })
        ↓
CloudflareInterceptor receives result
        ↓
Axios retries request with Cookie header
```

## Platform Differences

| Feature           | iOS                                | Android                       |
| ----------------- | ---------------------------------- | ----------------------------- |
| Cookie Extraction | CookieSync native module           | @react-native-cookies/cookies |
| WebView Cookies   | WKHTTPCookieStore (isolated)       | Shared with native            |
| Why Different     | WKWebView runs in separate process | WebView shares process        |

## Error Handling

If cookie extraction fails:

1. `hasCfClearance` returns `false`
2. `CloudflareBypassException` is thrown
3. React Query catches error and displays it
4. User can retry navigation

## Debugging

Check Metro logs for:

```
[WebViewFetcher] User pressed Done
[CookieSync] Cookie string for kissmanga.in: 3 cookies
[WebViewFetcher] Manual challenge cookies: cf_clearance found
[CF Interceptor] Manual solve success, retrying request...
```
