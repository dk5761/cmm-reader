/**
 * ReaderV3 - Infinite scroll manga reader
 *
 * Features:
 * - FlashList virtualization with cell recycling
 * - Dynamic image height (measured before render)
 * - Tap-to-toggle overlay with chapter info + page slider
 * - 60% visibility threshold for page tracking
 * - Preloading of next 4 pages
 * - Infinite scroll for chapter loading
 * - Progress saved on exit
 */

export { ReaderScreen } from "./screens/ReaderScreen";
export { useReaderStore } from "./stores/useReaderStore";
export type { FlatPage, ChapterWithPages } from "./stores/useReaderStore";
