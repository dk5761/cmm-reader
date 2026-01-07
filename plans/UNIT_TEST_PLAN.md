# Unit Test Plan: Manga Reader

This plan outlines the unit testing strategy for the `manga-reader` project, focusing on core logic, networking, persistence, and source parsing.

## 1. Reader Core (ReaderV2)

**Criticality:** 🔴 High
**Scope:** State management, Infinite Scrolling, Preloading.

### 1.1 Window Shifting Logic (`src/features/ReaderV2/utils/readerWindowUtils.ts`)
*   **Test Case 1:** `shiftWindowNext` correctly moves `next -> curr` and `curr -> prev`.
    *   *Input:* `[Ch1, Ch2, Ch3]`, Current: `Ch2`, Next: `Ch3` (Loaded).
    *   *Expect:* New Viewer has `Prev: Ch2`, `Curr: Ch3`, `Next: (Wait/Empty)`.
*   **Test Case 2:** `shiftWindowNext` returns `null` if next chapter is not loaded.
*   **Test Case 3:** `shiftWindowPrev` correctly moves `prev -> curr` and `curr -> next`.
*   **Test Case 4:** Boundary checks (First chapter, Last chapter).

### 1.2 Store State (`src/features/ReaderV2/store/useReaderStoreV2.ts`)
*   **Test Case 1:** `updateActiveChapter` updates metadata (`currentChapterIndex`, `currentPage`) but NOT the viewer adapter.
*   **Test Case 2:** `seekToPage` emits a `scrollSignal` with correct timestamp.
*   **Test Case 3:** `setCurrentChapterData` correctly initializes `prev` and `next` placeholders based on the full chapter list.

### 1.3 Preloader Hook (`src/features/ReaderV2/hooks/usePreloaderV2.ts`)
*   **Test Case 1:** Sliding window logic limits the `prefetchedSet` size to 15.
*   **Test Case 2:** Prefetch is triggered only for pages `N+1` to `N+4`.
*   **Test Case 3:** Cache is cleared when `chapterId` changes.

## 2. Networking & Cloudflare

**Criticality:** 🔴 High
**Scope:** Cookies, Headers, Interceptors.

### 2.1 CookieJar (`src/core/http/CookieJar.ts`)
*   **Test Case 1:** `getCookieString` returns correctly formatted string from mock native module.
*   **Test Case 2:** `invalidateDomain` calls the correct platform-specific clearing method.
*   **Test Case 3:** `hasCfClearance` correctly identifies the cookie in the string.

### 2.2 Cloudflare Solver (`src/core/http/CloudflareSolver.ts`)
*   **Test Case 1:** `solve` retries with increasing timeouts.
*   **Test Case 2:** Throws error if `cf_clearance` is missing after fetch.
*   **Test Case 3:** Calls `cookieJar.syncFromWebView` on iOS.

### 2.3 HttpClient (`src/core/http/HttpClient.ts`)
*   **Test Case 1:** Interceptor injects `User-Agent` and `Cookie` headers.
*   **Test Case 2:** 403/503 responses trigger the `CloudflareInterceptor` (mocked).

## 3. Persistence & Repositories

**Criticality:** 🟠 Medium
**Scope:** Realm abstractions, Sync Bridge.

### 3.1 Chapter Repository (`src/core/database/repositories/ChapterRepository.ts`)
*   **Test Case 1:** `saveChapters` only writes if data has changed (diff check).
    *   *Input:* Identical chapter list.
    *   *Expect:* No `realm.write` called.
*   **Test Case 2:** `getNextChapter` respects reverse-chronological order (Index 0 is newest).

### 3.2 Manga Repository (`src/core/database/repositories/MangaRepository.ts`)
*   **Test Case 1:** `addManga` initializes `chapters` and `categories` as empty lists.
*   **Test Case 2:** `removeFromLibrary` sets `inLibrary = false` but keeps the record.

### 3.3 Realm Sync Bridge (`src/core/sync/RealmSyncBridge.ts`)
*   **Test Case 1:** `toCloudManga` correctly maps `Realm.List` to arrays.
*   **Test Case 2:** `importFromCloud` merges remote progress with local progress using `Math.max`.
*   **Test Case 3:** `importFromCloud` prevents infinite loop by checking `isSyncingFromCloud` flag (mock listener).

## 4. Source Parsing

**Criticality:** 🟡 Medium
**Scope:** HTML Parsing, Selectors.

### 4.1 Configurable Source (`src/sources/configurable/ConfigurableSource.ts`)
*   **Test Case 1:** Extracts Manga List correctly using provided CSS selectors.
*   **Test Case 2:** Extracts Chapter List and normalizes date formats.
*   **Test Case 3:** Replaces `${query}` and `${page}` in URL paths correctly.

### 4.2 Asura Scans (`src/sources/asurascans/AsuraScansSource.ts`)
*   **Test Case 1:** `getPageList` correctly parses JSON from `self.__next_f.push` script tag.
*   **Test Case 2:** `absoluteUrl` handles `/series/` prefix logic correctly.

## 5. Test Infrastructure Setup

To implement these tests, we need:
1.  **Jest**: Test runner.
2.  **Realm Mock**: `jest-realm` or a manual mock for `realm` and `@realm/react`.
3.  **Axios Mock**: `axios-mock-adapter` for networking tests.
4.  **HTML Fixtures**: Sample HTML files for Source testing.

## 6. Execution Priority

1.  **Repository Tests**: Ensure data integrity first.
2.  **Reader Window Tests**: Ensure core UX is stable.
3.  **Networking Tests**: Ensure connectivity logic is sound.
