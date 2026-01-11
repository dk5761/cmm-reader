/**
 * usePagePreloader - Preloads next N pages for smooth scrolling
 * Uses expo-image's prefetch capability
 */

import { useEffect, useRef } from "react";
import { Image } from "expo-image";
import type { FlatPage } from "../stores/useReaderStore";

const PRELOAD_AHEAD = 4; // Preload n+1 to n+4

export function usePagePreloader(flatPages: FlatPage[], currentIndex: number) {
  const lastPreloadedRef = useRef<number>(-1);

  useEffect(() => {
    // Avoid preloading the same pages repeatedly
    if (currentIndex === lastPreloadedRef.current) return;
    lastPreloadedRef.current = currentIndex;

    // Get pages to preload (n+1 to n+PRELOAD_AHEAD)
    const startIdx = currentIndex + 1;
    const endIdx = Math.min(startIdx + PRELOAD_AHEAD, flatPages.length);

    if (startIdx >= flatPages.length) return;

    const pagesToPreload = flatPages.slice(startIdx, endIdx);

    // Prefetch images
    for (const page of pagesToPreload) {
      Image.prefetch(page.imageUrl, {
        headers: page.headers,
      }).catch(() => {
        // Silently ignore prefetch failures
      });
    }

    console.log(
      `[Preloader] Prefetching pages ${startIdx + 1} to ${endIdx} of ${
        flatPages.length
      }`
    );
  }, [currentIndex, flatPages]);
}
