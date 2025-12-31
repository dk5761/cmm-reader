# Mihon Image Loading Implementation

This document details how Mihon handles image loading, caching, and preloading in the reader.

## 1. Overview

Image loading in Mihon is a multi-step process designed to prioritize immediate user interaction ("time to glass") while efficiently managing network and memory resources. It does **not** pre-download all images in a chapter at once when reading online.

## 2. The Loading Pipeline

The pipeline consists of three main stages:

### Stage 1: Chapter Structure (Immediate)

- **Component**: `ChapterLoader`
- **Action**: Fetches the **Page List** from the source (or cache).
- **Result**: A list of `ReaderPage` objects. These contain metadata (page index, image URL) but **no image data**.
- **UI Effect**: The Reader displays placeholders and sets the correct scrollbar size immediately.

### Stage 2: Lazy Loading (On-Demand)

- **Component**: `WebtoonAdapter` / `WebtoonPageHolder`
- **Trigger**: When `onBindViewHolder` is called (i.e., the page comes near the viewport).
- **Action**: `WebtoonPageHolder` launches a coroutine to load the specific page via `PageLoader.loadPage(page)`.

### Stage 3: Image Fetching & Caching

- **Component**: `HttpPageLoader` (for online sources)
- **Mechanism**: Uses a **Priority Blocking Queue**.
  1.  **Priority 1 (High)**: The page currently requested by the user.
  2.  **Priority 0 (Low)**: Preload buffer (next 4 pages).
  3.  **Priority 2 (Retry)**: User manually retrying a failed page.
- **Process**:
  1.  Checks Memory Cache.
  2.  Checks Disk Cache.
  3.  If missing, facilitates a network request via `HttpSource`.
  4.  Saves result to Disk Cache.
  5.  Returns an `InputStream` to the Viewer.

## 3. Preloading Strategy

Mihon does not load the entire chapter. It uses a small "look-ahead" buffer.

- **Buffer Size**: `4` pages.
- **Logic**:
  - When Page `N` is requested (because it's visible), `HttpPageLoader` automatically enqueues pages `N+1` to `N+4` with lower priority.
  - If the user scrolls quickly to `N+10`, that page gets High Priority, and the system attempts to load it immediately, potentially skipping `N+5`...`N+9` temporarily.

## 4. View Components

- **`ReaderPageImageView`**: A wrapper that chooses the best view implementation:
  - **`SubsamplingScaleImageView`**: For most images. Supports deep zooming handling huge bitmaps without OOM.
  - **`AppCompatImageView` (Coil/Glide)**: Used if the image is animated (GIF/WebP) or if specifically configured.
- **`WebtoonPageHolder`**: Manages the loading state (Loading Spinner, Error Button, Image View) and observes the `ReaderPage.status` flow.

## 5. Summary

| Feature          | Implementation Details                       |
| :--------------- | :------------------------------------------- |
| **Initial Load** | Page List only (metadata). Fast.             |
| **Image Load**   | Lazy, triggered by scrolling.                |
| **Preload**      | Next 4 pages.                                |
| **Queue**        | Priority-based (Visible > Preload).          |
| **View**         | `SubsamplingScaleImageView` for performance. |
