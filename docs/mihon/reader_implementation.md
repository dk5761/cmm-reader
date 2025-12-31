# Mihon Reader Implementation

This document details the architecture of the vertical (Webtoon) reader in Mihon.

## 1. High-Level Architecture

The reader is built around a standard Android `Activity` (`ReaderActivity`) that hosts different implementations of a `Viewer` interface. The vertical reader is implemented specifically in `WebtoonViewer`.

### Core Components

- **`ReaderActivity`**: The main entry point. Handles window management, brightness, intent handling, and coordinates between the ViewModel and the Viewer.
- **`ReaderViewModel`**: Manages the business logic and state. It holds the current chapter, previous/next chapters (`ViewerChapters`), and handles database updates (history, read progress).
- **`WebtoonViewer`**: The implementation of the vertical scrolling reader.
- **`RecyclerView`**: The underlying UI component used by `WebtoonViewer` to recycle views and handle large lists of pages efficiently.

## 2. WebtoonViewer Logic

Located in `WebtoonViewer.kt`.

- **Layout Manager**: `WebtoonLayoutManager`. Custom logic for vertical scrolling.
- **Adapter**: `WebtoonAdapter`. Binds `ReaderPage` objects to `RecyclerView.ViewHolder`s.
- **Input Handling**:
  - Tap zones are defined to trigger Next/Prev page or toggle the menu.
  - Double-tap to zoom.
  - Long-press for page actions (share, save).

## 3. State Management

Mihon uses a reactive unidirectional data flow for the reader state.

1.  **Source of Truth**: `ReaderViewModel` holds `MutableStateFlow<State>`.
2.  **State Objects**:
    - **`ViewerChapters`**: Contains `currChapter`, `prevChapter`, `nextChapter`.
    - **`ReaderChapter`**: Wraps the database `Chapter` model. Has a `State` (Wait, Loading, Loaded, Error).
    - **`ReaderPage`**: Wraps a single page. Contains `index`, `url`, `status`, and `stream`.
3.  **Flow**:
    - **User Action**: User scrolls to a new page.
    - **Event**: `RecyclerView.OnScrollListener` triggers `onScrolled()`.
    - **Update**: `WebtoonViewer` calls `onPageSelected(page)` on the `ReaderViewModel`.
    - **Persistence**: `ReaderViewModel.onPageSelected` updates the `last_page_read` in the database and manages download queues for upcoming chapters.

## 4. Transitions

Chapter transitions are handled seamlessly within the `RecyclerView`.

- **`ChapterTransition` Items**: The `WebtoonAdapter` inserts special items (`ChapterTransition.Prev`, `ChapterTransition.Next`) at the start and end of the chapter list.
- **Preloading**: When the user scrolls near the bottom (detecting `ChapterTransition.Next`):
  1.  `WebtoonViewer` requests preloading via `ReaderActivity`.
  2.  `ReaderViewModel` triggers `ChapterLoader` for the next chapter.
  3.  Once loaded, the `WebtoonAdapter` is updated with the new chapter's pages, allowing for an "infinite scroll" experience.

## 5. Diagrams

For visual reference of the flow, see the [Reader Flow Diagrams](../../mihon_vertical_reader_flow.md).
