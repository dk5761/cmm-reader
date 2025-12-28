# Tachiyomi-Style Image Loading Implementation

Migrate from WebView/base64 approach to an efficient image loading system using `react-native-fast-image` (wraps SDWebImage/Glide like Tachiyomi) with header support and explicit cache control.

## User Review Required

> [!IMPORTANT]
> **Breaking Changes**
>
> - Removes `ProxiedImage` and `WebViewImage` components
> - Replaces with new `MangaImage` using `react-native-fast-image`
> - Headers now passed via `source` prop
> - Requires new package installation + rebuild

> [!NOTE]
> **Why react-native-fast-image?**
>
> - Same native libs as Tachiyomi (SDWebImage/Glide)
> - Explicit cache control APIs (`clearMemoryCache`, `clearDiskCache`)
> - Priority-based loading
> - Progressive JPEG support
> - `preload` API with headers

## Proposed Changes

### Installation

```bash
npm install react-native-fast-image
npx expo prebuild --clean
```

Requires rebuild since it's a native module.

---

### Core Components

#### [NEW] [MangaImage.tsx](file:///Users/drshnk/Developer/personal/manga-reader/src/shared/components/MangaImage.tsx)

Unified image component using `FastImage`:

**Props:**

```typescript
{
  uri: string;
  headers?: Record<string, string>;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  priority?: 'low' | 'normal' | 'high';
  onLoad?: (event) => void;
  onError?: () => void;
  onProgress?: (event) => void;
}
```

**Features:**

- Automatic CDN fallback for 2xstorage
- Loading/error states
- Priority control (use `high` for current page, `normal` for prefetch)
- Cache control: `FastImage.cacheControl.immutable` (default)

**Advantages:**

- No WebView overhead
- No base64 conversion
- Native performance (SDWebImage/Glide)
- Efficient subsampling
- Progressive JPEG

#### [DELETE] [ProxiedImage.tsx](file:///Users/drshnk/Developer/personal/manga-reader/src/shared/components/ProxiedImage.tsx)

#### [DELETE] [WebViewImage.tsx](file:///Users/drshnk/Developer/personal/manga-reader/src/shared/components/WebViewImage.tsx)

---

### Reader Updates

#### [MODIFY] [WebtoonReader.tsx](file:///Users/drshnk/Developer/personal/manga-reader/src/features/Reader/components/WebtoonReader.tsx)

Replace `WebViewZoomableImage` with `MangaImage`:

```typescript
<MangaImage
  uri={item.page.imageUrl}
  headers={item.page.headers}
  style={{ width: SCREEN_WIDTH }}
  resizeMode="contain"
  priority="high"
/>
```

#### [MODIFY] [ReaderView.tsx](file:///Users/drshnk/Developer/personal/manga-reader/src/features/Reader/components/ReaderView.tsx)

Same changes as WebtoonReader.

---

### Source Layer

#### [MODIFY] [types.ts](file:///Users/drshnk/Developer/personal/manga-reader/src/sources/base/types.ts)

`Page` interface already has `headers` field - ensure sources populate it.

#### [MODIFY] Source Implementations

Update `getPageList()` to include headers:

**MangaKakalotSource, AsuraScansSource, KissMangaSource:**

```typescript
async getPageList(chapterUrl: string): Promise<Page[]> {
  // ... existing logic ...

  return pages.map((imageUrl, index) => ({
    index,
    imageUrl,
    headers: {
      'Referer': this.config.baseUrl,
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) ...'
    }
  }));
}
```

---

### Caching

#### [NEW] [ImageCacheConfig.ts](file:///Users/drshnk/Developer/personal/manga-reader/src/core/config/ImageCacheConfig.ts)

Cache management utilities:

```typescript
import FastImage from "react-native-fast-image";

export async function clearMemoryCache() {
  await FastImage.clearMemoryCache();
}

export async function clearDiskCache() {
  await FastImage.clearDiskCache();
}

export async function clearAllCache() {
  await Promise.all([FastImage.clearMemoryCache(), FastImage.clearDiskCache()]);
}
```

Expose in Settings screen for user control.

**Note:** Cache size limits handled by native libs, not configurable from RN.

#### [MODIFY] [useImagePreloader.ts](file:///Users/drshnk/Developer/personal/manga-reader/src/features/Reader/hooks/useImagePreloader.ts)

Update to use `FastImage.preload`:

```typescript
const sources = pagesToPreload.map((page) => ({
  uri: page.imageUrl,
  headers: page.headers || {},
  priority: FastImage.priority.normal,
}));

FastImage.preload(sources);
```

---

## Verification Plan

### Manual Verification

#### 1. Installation & Build

```bash
npm install react-native-fast-image
npx expo prebuild --clean
npm run android  # or npm run ios
```

**Expected:** Successful build with no errors.

#### 2. Basic Image Loading

1. Open reader (webtoon & paged modes)
2. Verify images load without delay
3. Check for smooth scrolling

**Expected:** No WebView flicker, instant display.

#### 3. Header Propagation

Use network monitor to verify headers on image requests.

**Expected:** `Referer` and `User-Agent` present.

#### 4. Caching

1. Read a chapter
2. Close & reopen same chapter
3. Observe instant load from cache

**Expected:** Cached images load immediately.

#### 5. Prefetching

Scroll through chapter, observe next pages loading ahead.

**Expected:** Smooth reading experience.

#### 6. Memory Usage

Monitor with React Native Perf Monitor during long reading session.

**Expected:** Stable memory, no leaks.

#### 7. CDN Fallback

Test with 2xstorage sources.

**Expected:** Fallback works if needed.

---

## Migration Notes

**Benefits:**

- ✅ Native performance (same libs as Tachiyomi)
- ✅ Explicit cache APIs
- ✅ No base64/WebView overhead
- ✅ Priority-based loading
- ✅ Progressive JPEG
- ✅ Simpler codebase

**Considerations:**

- Requires native rebuild
- Headers must be set per source
- Cache not configurable from RN (native defaults)
