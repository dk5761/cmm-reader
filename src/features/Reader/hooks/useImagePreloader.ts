import { useEffect, useRef } from "react";
import { preloadImages } from "@/core/config/ImageCacheConfig";
import type { Page } from "@/sources";

/**
 * Preload upcoming pages for smoother reading experience.
 * Uses react-native-fast-image's preload which handles caching efficiently.
 *
 * @param pages - All pages in the chapter
 * @param currentPage - Current page number (1-indexed)
 * @param preloadCount - Number of pages to preload ahead (default: 3)
 */
export function useImagePreloader(
  pages: Page[],
  currentPage: number,
  preloadCount = 3,
  _baseUrl?: string // Kept for compatibility but unused (headers come from Page objects)
) {
  const lastPreloadedRef = useRef<number>(0);

  useEffect(() => {
    // Skip if no pages or same page as last preload
    if (pages.length === 0 || currentPage === lastPreloadedRef.current) {
      return;
    }

    // Only preload when moving forward (reading direction)
    // or when significantly changing position (slider jump)
    const diff = currentPage - lastPreloadedRef.current;
    if (diff < 0 && Math.abs(diff) < 3) {
      return; // Skip backward movement unless it's a big jump
    }

    lastPreloadedRef.current = currentPage;

    // Get next pages to preload (0-indexed)
    const startIdx = currentPage; // currentPage is 1-indexed, so this gets next page
    const endIdx = Math.min(startIdx + preloadCount, pages.length);
    const pagesToPreload = pages.slice(startIdx, endIdx);

    if (pagesToPreload.length === 0) {
      return;
    }

    // Prefetch images using FastImage
    const sources = pagesToPreload.map((page) => ({
      uri: page.imageUrl,
      headers: page.headers || {},
      priority: "normal" as const,
    }));

    preloadImages(sources);
  }, [pages, currentPage, preloadCount]);
}
