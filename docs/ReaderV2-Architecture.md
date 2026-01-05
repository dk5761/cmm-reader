# ReaderV2 Feature Architecture

This document provides a comprehensive technical guide to the **ReaderV2** feature, a manga/webtoon reader implementation inspired by [Mihon](https://github.com/mihonapp/mihon)'s reader architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Architecture Diagram](#architecture-diagram)
4. [Core Concepts](#core-concepts)
5. [Type System](#type-system)
6. [State Management (Zustand Store)](#state-management-zustand-store)
7. [Hooks](#hooks)
8. [Components](#components)
9. [Data Flow](#data-flow)
10. [Infinite Scroll & Chapter Transitions](#infinite-scroll--chapter-transitions)
11. [Loading Stages (Mihon-Inspired)](#loading-stages-mihon-inspired)
12. [Key Implementation Details](#key-implementation-details)

---

## Overview

ReaderV2 is a high-performance, vertical-scrolling manga/webtoon reader built with React Native. It implements a sophisticated multi-stage loading architecture inspired by Mihon's reader design:

### Key Features

- **Infinite Scroll**: Seamlessly scroll between chapters without navigation
- **Smart Preloading**: Background image prefetching for smooth reading
- **Progress Persistence**: Auto-save reading history with debounce
- **Gesture Controls**: Tap to toggle overlay, slider for page seeking
- **FlashList Integration**: Virtualized list for memory-efficient rendering
- **Chapter Transitions**: Visual separators with loading/error states

### Technology Stack

| Technology | Purpose |
|------------|---------|
| React Native | Mobile framework |
| Expo | Development platform |
| Zustand | State management |
| React Query | Data fetching & caching |
| FlashList | Virtualized list rendering |
| expo-image | Optimized image loading |
| react-native-reanimated | UI animations |

---

## Directory Structure

```
src/features/ReaderV2/
├── index.ts                      # Feature exports
├── types/
│   └── reader.types.ts           # Type definitions & helper functions
├── store/
│   ├── index.ts                  # Store exports
│   └── useReaderStoreV2.ts       # Zustand store (state + actions)
├── hooks/
│   ├── index.ts                  # Hook exports
│   ├── useChapterLoaderV2.ts     # Chapter page loading (react-query)
│   ├── usePreloaderV2.ts         # Image prefetching
│   ├── useSaveProgressV2.ts      # History persistence
│   └── useKeepAwakeV2.ts         # Screen awake utility
├── components/
│   ├── WebtoonViewer.tsx         # Main vertical scroll list
│   ├── ReaderPage.tsx            # Individual page renderer
│   ├── ChapterTransition.tsx     # Transition UI between chapters
│   ├── ChapterNavigator.tsx      # Page slider & chapter buttons
│   └── ReaderOverlay.tsx         # Header/footer controls
├── screens/
│   └── ReaderScreenV2.tsx        # Main entry point
└── api/                          # (Empty - API handled externally)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ReaderScreenV2                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Route Parameters                                 ││
│  │  chapterId, sourceId, url, mangaId, mangaTitle, mangaCover, etc.       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                    ┌─────────────────┼─────────────────┐                     │
│                    ▼                 ▼                 ▼                     │
│  ┌─────────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   useChapterList    │  │ useChapterLoader│  │ useGetOrCreateManga    │  │
│  │   (External Hook)   │  │     V2          │  │ (Auto-track manga)     │  │
│  │   Fetches chapter   │  │ Stage 1: Load   │  └─────────────────────────┘  │
│  │   list from source  │  │ page metadata   │                               │
│  └──────────┬──────────┘  └────────┬────────┘                               │
│             │                      │                                         │
│             ▼                      ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        useReaderStoreV2 (Zustand)                     │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ viewerChapters: { prevChapter, currChapter, nextChapter }       │  │  │
│  │  │ allChapters: Chapter[]                                          │  │  │
│  │  │ currentPage, totalPages, currentChapterIndex                    │  │  │
│  │  │ isOverlayVisible, isSeeking, isLoading                          │  │  │
│  │  │ flashListRef                                                    │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│         ┌────────────────────────────┼────────────────────────────┐          │
│         ▼                            ▼                            ▼          │
│  ┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────┐  │
│  │ usePreloaderV2  │    │   useSaveProgressV2  │    │  useKeepAwakeV2    │  │
│  │ Stage 3: Image  │    │   Stage 4: History   │    │  Screen awake      │  │
│  │ prefetching     │    │   persistence        │    │                    │  │
│  └─────────────────┘    └──────────────────────┘    └────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           UI Layer                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      WebtoonViewer                               │  │  │
│  │  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │  │  │
│  │  │   │  ReaderPage     │  │ ChapterTransition│ │  ReaderPage     │ │  │  │
│  │  │   │  (Page N)       │  │ (Separator)      │ │  (Page N+1)     │ │  │  │
│  │  │   └─────────────────┘  └─────────────────┘  └─────────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                       ReaderOverlay                              │  │  │
│  │  │   ┌─────────────┐          ┌─────────────────────────────────┐  │  │  │
│  │  │   │   Header    │          │      ChapterNavigator           │  │  │  │
│  │  │   │ (Back, Title)│          │ (Slider, Prev/Next buttons)     │  │  │  │
│  │  │   └─────────────┘          └─────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### ViewerChapters Pattern

The reader maintains a sliding window of three chapters at any time:

```typescript
interface ViewerChapters {
  prevChapter: ReaderChapter | null;  // Older chapter (higher index)
  currChapter: ReaderChapter;         // Currently reading
  nextChapter: ReaderChapter | null;  // Newer chapter (lower index)
}
```

**Note**: Chapters are stored in reverse-chronological order (newest first), so:
- `prevChapter` = older chapter = `allChapters[currentIndex + 1]`
- `nextChapter` = newer chapter = `allChapters[currentIndex - 1]`

### Chapter States

Each chapter progresses through loading states:

```typescript
type ChapterState = "wait" | "loading" | "loaded" | "error";
```

| State | Description |
|-------|-------------|
| `wait` | Not yet requested |
| `loading` | Fetching page metadata |
| `loaded` | Pages ready for display |
| `error` | Load failed (with retry option) |

### Page States

Individual pages also have states:

```typescript
type PageState = "queue" | "loading" | "ready" | "error";
```

---

## Type System

Located in `types/reader.types.ts`:

### Core Types

```typescript
// Extended page with loading state
interface ReaderPage {
  index: number;
  imageUrl: string;
  headers?: Record<string, string>;
  state: PageState;
  error?: string;
}

// Extended chapter with loading state and pages
interface ReaderChapter {
  chapter: Chapter;  // Original chapter from source
  state: ChapterState;
  pages: ReaderPage[];
  error?: string;
}
```

### FlashList Adapter Items

The FlashList renders two types of items:

```typescript
// A page item
interface PageItem {
  type: "page";
  page: ReaderPage;
  chapterId: string;
  chapterIndex: number;
}

// A transition separator between chapters
interface TransitionItem {
  type: "transition";
  direction: "prev" | "next";
  targetChapter: ReaderChapter | null;
  isLoading: boolean;
}

type AdapterItem = PageItem | TransitionItem;
```

### Helper Functions

```typescript
// Convert source Page to ReaderPage
toReaderPage(page: Page): ReaderPage

// Create list items
createPageItem(page, chapterId, chapterIndex): PageItem
createTransitionItem(direction, targetChapter, isLoading): TransitionItem

// Build full adapter list from ViewerChapters
buildAdapterItems(viewerChapters, isLoadingPrev, isLoadingNext): AdapterItem[]

// Get unique key for FlashList
getItemKey(item: AdapterItem): string

// Format chapter title for display
formatChapterTitle(chapter: Chapter | null): string
```

---

## State Management (Zustand Store)

Located in `store/useReaderStoreV2.ts`:

### State Shape

```typescript
interface ReaderStoreState {
  // Chapter data
  viewerChapters: ViewerChapters | null;
  allChapters: Chapter[];
  currentChapterIndex: number;

  // Page navigation
  currentPage: number;
  totalPages: number;

  // UI state
  isOverlayVisible: boolean;
  isSeeking: boolean;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Refs
  flashListRef: RefObject<FlashListRef<AdapterItem>> | null;

  // Metadata
  mangaId: string;
  sourceId: string;
}
```

### Key Actions

| Action | Purpose |
|--------|---------|
| `initialize(params)` | Set up reader with chapters and initial position |
| `reset()` | Clear all state on unmount |
| `setCurrentChapterData(chapterData)` | Set loaded chapter pages |
| `setCurrentPage(page)` | Update current page (guarded by `isSeeking`) |
| `seekToPage(page)` | Programmatic scroll to page |
| `loadNextChapter()` | Trigger next chapter load |
| `loadPrevChapter()` | Trigger previous chapter load |
| `setNextChapterLoaded(pages)` | Mark next chapter as loaded |
| `setPrevChapterLoaded(pages)` | Mark previous chapter as loaded |
| `transitionToNextChapter()` | Shift ViewerChapters window forward |
| `transitionToPrevChapter()` | Shift ViewerChapters window backward |
| `toggleOverlay()` | Show/hide header and footer |
| `setIsSeeking(value)` | Lock page updates during slider drag |

### Seeking Guard Pattern

The `isSeeking` flag prevents page flicker during slider interaction:

```typescript
setCurrentPage: (page: number) => {
  const { isSeeking, currentPage } = get();
  // Prevent jitter: don't update if actively seeking
  if (!isSeeking) {
    set({ currentPage: page });
  }
}
```

---

## Hooks

### useChapterLoaderV2

**File**: `hooks/useChapterLoaderV2.ts`

Handles Stage 1 loading: fetching page metadata (URLs) for a chapter.

```typescript
function useChapterLoaderV2(
  sourceId: string,
  chapter: Chapter | null,
  enabled = true
): UseQueryResult<ReaderChapter>
```

**Features**:
- Uses React Query for caching (10-minute stale time)
- Returns `ReaderChapter` with pages in `queue` state
- Images are NOT downloaded yet (lazy loading)

**Related**: `usePrefetchChapter()` for preloading adjacent chapters.

---

### usePreloaderV2

**File**: `hooks/usePreloaderV2.ts`

Handles Stage 3: background image prefetching.

```typescript
function usePreloaderV2(
  pages: ReaderPage[],
  currentPage: number,
  chapterId?: string,
  headers?: Record<string, string>
): { clearPrefetchCache: () => void }
```

**Behavior**:
- When on page N, prefetches pages N+1 to N+4
- Uses `expo-image` prefetch with disk/memory caching
- Clears cache on chapter change to prevent memory leaks
- Skips small backward movements

---

### useSaveProgressV2

**File**: `hooks/useSaveProgressV2.ts`

Handles Stage 4: reading history persistence.

```typescript
function useSaveProgressV2(
  data: ProgressData | null
): { save: (forceUpdate?: boolean) => void }
```

**Features**:
- Debounced saves (10-second minimum interval)
- Force save on chapter change and unmount
- Auto-marks chapter as read at 95% progress threshold
- Uses current chapter from store (updates during infinite scroll)

---

### useKeepAwakeV2

**File**: `hooks/useKeepAwakeV2.ts`

Simple wrapper around `expo-keep-awake` to prevent screen sleep.

---

## Components

### WebtoonViewer

**File**: `components/WebtoonViewer.tsx`

The core vertical scrolling reader using FlashList.

**Key Features**:
- Builds adapter items from `viewerChapters`
- Uses `onViewableItemsChanged` for page tracking
- Triggers chapter loading when transition items become visible
- Handles chapter transitions when scrolling into adjacent chapters
- Guards against viewability updates during transitions

**Viewability Config**:
```typescript
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 10,  // Low threshold for tall webtoon pages
};
```

**Transition Guards**:
```typescript
const isTransitioningRef = useRef(false);
// Prevents race conditions during chapter switches
```

---

### ReaderPage

**File**: `components/ReaderPage.tsx`

Renders a single manga page image.

**Features**:
- Uses `expo-image` with blurhash placeholder
- Dynamic aspect ratio calculation on load
- Loading overlay until image ready
- Error state with retry button (cache-busting)
- Recycling key for FlashList cell reuse

**Image Handling**:
```typescript
// Reset state on URL change (prevents showing old recycled images)
useEffect(() => {
  setIsLoading(true);
  setIsError(false);
  setRetryCount(0);
  setAspectRatio(screenWidth / screenHeight);
}, [page.imageUrl]);
```

---

### ChapterTransition

**File**: `components/ChapterTransition.tsx`

Visual separator between chapters.

**States**:

| State | UI |
|-------|----|
| `loaded` | Minimal separator line with chapter name |
| `loading` | Activity indicator |
| `error` | Error message with retry button |
| `wait` (with target) | Button to load chapter |
| `wait` (no target) | "No more chapters" text |

---

### ChapterNavigator

**File**: `components/ChapterNavigator.tsx`

Page slider with chapter navigation buttons.

**Features**:
- Slider for seeking (1 to totalPages)
- Previous/Next chapter buttons
- Haptic feedback (optional, graceful degradation)
- Local display state for immediate feedback during drag
- Syncs with store when not seeking

---

### ReaderOverlay

**File**: `components/ReaderOverlay.tsx`

Animated header and footer controls.

**Features**:
- Header: Back button, chapter title, settings button
- Footer: Contains ChapterNavigator
- Reanimated slide/fade animations
- Uses current chapter from store (updates during infinite scroll)

---

## Data Flow

### Initialization Sequence

```
1. ReaderScreenV2 mounts
   ├─► useKeepAwakeV2() - Screen stays awake
   ├─► useChapterList() - Fetch chapter list from source
   └─► Wait for chapters...

2. Chapters loaded
   ├─► Find currentChapter from URL/ID
   ├─► useGetOrCreateManga() - Track manga in library
   └─► store.initialize({ chapters, chapterId, mangaId, ... })

3. Store initialized
   └─► Sets allChapters, currentChapterIndex, metadata

4. useChapterLoaderV2 triggers
   ├─► Fetches page URLs for current chapter
   └─► Returns ReaderChapter { chapter, state: "loaded", pages }

5. store.setCurrentChapterData(chapterData)
   ├─► Creates ViewerChapters { prev, curr, next }
   └─► Sets totalPages

6. WebtoonViewer renders
   ├─► buildAdapterItems() creates list
   ├─► FlashList renders pages + transitions
   └─► usePreloaderV2 starts prefetching

7. User scrolls
   ├─► onViewableItemsChanged fires
   ├─► store.setCurrentPage() updates
   └─► useSaveProgressV2 debounced save
```

### Infinite Scroll Flow

```
1. User scrolls to end of chapter
   └─► TransitionItem becomes visible

2. onViewableItemsChanged detects transition
   └─► store.loadNextChapter()

3. Store updates nextChapter.state = "loading"
   └─► ReaderScreenV2 effect triggers

4. usePrefetchChapter fetches pages
   └─► store.setNextChapterLoaded(pages)

5. WebtoonViewer effect detects load complete
   ├─► scrollToIndex(transitionIndex)
   └─► Sets isTransitioningRef = true

6. User continues scrolling into next chapter
   └─► onViewableItemsChanged detects chapter switch

7. All visible pages from next chapter?
   └─► store.transitionToNextChapter()

8. Store shifts ViewerChapters window
   ├─► prev = old current
   ├─► curr = old next
   ├─► next = new chapter (wait state)
   └─► Updates currentChapterIndex, totalPages, currentPage
```

---

## Loading Stages (Mihon-Inspired)

The reader implements Mihon's multi-stage loading approach:

### Stage 1: Chapter Structure (Immediate)

**Hook**: `useChapterLoaderV2`

- Fetches page list (metadata only)
- No image downloads
- Fast initial render with placeholders
- Cached for 10 minutes

### Stage 2: Lazy Image Loading (On-Demand)

**Component**: `ReaderPage` with `expo-image`

- Images load as they enter viewport
- FlashList virtualization
- drawDistance = 0.75 * screenHeight for preloading

### Stage 3: Preload Buffer (Background)

**Hook**: `usePreloaderV2`

- Prefetch pages N+1 to N+4 in background
- Uses expo-image disk/memory cache
- Skips already-prefetched URLs
- Clears on chapter change

### Stage 4: History Persistence (Debounced)

**Hook**: `useSaveProgressV2`

- Saves every 10 seconds (minimum)
- Force saves on chapter change
- Auto-marks read at 95%
- Saves on unmount

---

## Key Implementation Details

### FlashList Configuration

```typescript
<FlashList
  ref={flashListRef}
  data={items}
  renderItem={renderItem}
  keyExtractor={getItemKey}
  getItemType={getItemType}
  viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
  showsVerticalScrollIndicator={false}
  drawDistance={screenHeight * 0.75}  // 3/4 screen for preloading
/>
```

### Stable Viewability Callback

Uses ref pattern to avoid FlashList recreation:

```typescript
const storeActionsRef = useRef({ setCurrentPage, loadNextChapter, ... });

const handleViewableItemsChanged = useCallback(
  ({ viewableItems }) => {
    const { setCurrentPage } = storeActionsRef.current;
    // ... handle viewability
  },
  []  // Empty deps - uses ref for latest values
);
```

### Transition Guards

Prevents race conditions during chapter loads:

```typescript
const isTransitioningRef = useRef(false);

// Set before scroll
isTransitioningRef.current = true;
flashListRef.current?.scrollToIndex({ ... });

// Clear after delay
setTimeout(() => {
  isTransitioningRef.current = false;
}, TRANSITION_SETTLE_DELAY);  // 300ms

// Skip updates during transition
if (isTransitioningRef.current) {
  return;
}
```

### Seeking Without Jitter

```typescript
// 1. Start seeking - lock page updates
handleSliderStart = () => {
  setIsSeeking(true);
};

// 2. During drag - update local display only
handleSliderChange = (value) => {
  setDisplayPage(Math.round(value));
};

// 3. On release - perform seek and update store
handleSliderComplete = (value) => {
  seekToPage(Math.round(value));
  // seekToPage sets isSeeking=false after 100ms
};
```

### Error Recovery

Pages and chapters both support retry:

```typescript
// Page retry with cache-busting
const imageUri = useMemo(() => {
  if (retryCount === 0) return page.imageUrl;
  return `${page.imageUrl}?_retry=${retryCount}`;
}, [page.imageUrl, retryCount]);

// Chapter retry resets to wait state
retryNextChapter: () => {
  set((state) => ({
    viewerChapters: {
      ...state.viewerChapters,
      nextChapter: {
        ...state.viewerChapters.nextChapter,
        state: "wait",
        error: undefined,
      },
    },
  }));
}
```

---

## Performance Considerations

1. **Virtualization**: FlashList only renders visible items
2. **Memoization**: All components use `memo()` with stable props
3. **Prefetching**: Background image loading reduces perceived latency
4. **Debouncing**: History saves throttled to prevent DB thrashing
5. **Ref Pattern**: Stable callbacks avoid FlashList re-renders
6. **Transition Guards**: Prevent unnecessary state updates during scrolls

---

## Future Improvements

- [ ] Horizontal/paged reading mode support
- [ ] Reading settings (zoom, brightness, background color)
- [ ] Page-tap navigation zones (left/right tap to change page)
- [ ] Double-tap zoom
- [ ] Long-press to save image
- [ ] Offline mode with pre-downloaded chapters

---

*Last updated: January 2025*
