# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A manga reader app built with React Native, Expo Router, and Realm for local storage. The app scrapes manga from various sources, manages a local library, and supports downloading chapters for offline reading.

**Key Technologies:**
- Expo Router (file-based routing)
- Uniwind (Tailwind CSS for React Native)
- Realm (local database with embedded objects)
- TanStack Query (data fetching)
- React Native WebView (Cloudflare bypass)

## Development Commands

```bash
# Start development server
npm start

# Run on iOS/Android
npm run ios
npm run android

# Prebuild native code (after adding dependencies)
npm run prebuild:ios
npm run prebuild:android

# Run tests
npm test
npm run test:watch
npm run test:coverage
```

## Architecture

### Source Registry Pattern (`src/sources/`)

Each manga website is implemented as a `Source` class extending the base `Source` abstract class. Sources are registered in `src/sources/index.ts` and exported via `SOURCES` registry.

**Base Source methods:**
- `search(query, page)` - Search manga
- `getPopular(page)` - Get trending manga
- `getLatest(page)` - Get latest updates
- `getMangaDetails(url)` - Get full manga info
- `getChapterList(mangaUrl)` - Get chapters for a manga
- `getPageList(chapterUrl)` - Get page images for a chapter

**Adding a new source:**
1. Create class in `src/sources/[sourcename]/` extending `Source`
2. Implement all abstract methods
3. Register in `src/sources/index.ts`

### HTTP Layer with Cloudflare Bypass (`src/core/http/`)

- **HttpClient** - Main axios client with interceptors
- **CloudflareInterceptor** - Detects CF challenges and triggers WebView bypass
- **CookieJar** - Per-domain cookie persistence using AsyncStorage
- **WebViewFetcherService** - Runs invisible WebView to solve CF challenges

All HTTP requests automatically include cookies from CookieJar. When a CF challenge is detected (403 with specific HTML), WebViewFetcher opens a modal WebView to solve it, then cookies are persisted.

### Realm Database (`src/core/database/`)

Uses embedded objects for performance - chapters and reading progress are stored inside Manga documents.

**Schema:**
- `MangaSchema` - Main manga record with embedded `chapters` and `progress`
- `ChapterSchema` - Embedded in Manga, tracks read status + download status
- `ReadingProgressSchema` - Embedded in Manga, tracks last read position
- `ReadingHistorySchema` - Standalone collection for reading session history
- `CategorySchema` - User-defined collections with `mangaIds` list

**Repositories** (`src/core/database/repositories/`):
- `MangaRepository` - CRUD for manga library
- `ChapterRepository` - Update chapter read progress, download status
- `HistoryRepository` - Manage reading history
- `CategoryRepository` - Manage categories

Access via `useRepositories()` hook.

### Feature Structure (`src/features/`)

Each feature has its own folder with:
- `screens/` - Screen components (mapped to routes in `src/app/`)
- `components/` - Feature-specific components
- `hooks/` - Feature-specific hooks
- `api/` - TanStack Query hooks for data fetching
- `stores/` - Zustand stores (if needed)

**Main features:**
- `Library` - User's manga library with filters/sort
- `Browse` - Source discovery and search
- `Manga` - Manga detail + chapter list
- `ReaderV3` - Chapter reader with image preload
- `History` - Reading history
- `Downloads` - Download queue management
- `Settings` - App settings

### Routing (`src/app/`)

Expo Router file-based routing:
- `(main)/(tabs)/` - Bottom tab navigation (library, browse, history, settings)
- `(main)/manga/[id].tsx` - Manga detail page
- `(main)/reader/[chapterId].tsx` - Reader screen
- `(debug)/` - Development tools (Realm debugger, CF logs)

### Download System (`src/shared/contexts/DownloadContext.tsx`)

Queue-based chapter downloader:
1. User queues chapter → `downloadStatus = QUEUED`
2. `DownloadProvider` processes queue in background
3. Downloads pages to `fileSystem.documentDirectory/downloads/`
4. Updates progress in Realm (`downloadedCount`, `downloadTotal`)
5. On complete → `downloadStatus = DOWNLOADED`

Download status is tracked on embedded Chapter objects.

### Styling

Uses Uniwind (Tailwind CSS for React Native). CSS variables defined in `src/global.css`:
- `--color-background`, `--color-foreground`, `--color-muted`, `--color-primary`

Dark mode is handled automatically by `useColorScheme()`.

## Important Notes

- **No auth**: App launches directly to library, no login required
- **NSFW sources**: Controlled by `showNsfwSources` setting in `useAppSettingsStore`
- **Image caching**: Handled by `expo-image` with 500MB prune limit on app launch
- **Realm writes**: Always wrap in `realm.write(() => { ... })`
- **Source headers**: Some sources require Referer headers - override `getImageHeaders()` in Source class

## File Path Conventions

- `@/` alias maps to `src/`
- Screens in `src/features/X/screens/` map to routes in `src/app/`
- Shared components in `src/shared/components/`
- Core utilities in `src/core/`
- Source implementations in `src/sources/`


## Flow to follow :

- Always get the required context regarding and around the user ask.
- Always create a plan, dont directly implement anything
- Ask the user to confirm the plan and then implement.
- Always use skills wherever possible and relevant 
- Use subagents for parallel processing in independent actions / tasks.
- Be descriptive when explaining the plan
- Always try to get the latest information regarding the frameworks and libraries from the internet.