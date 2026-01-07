
import { useEffect, useRef } from "react";
import type { FlashListRef } from "@shopify/flash-list";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import type { AdapterItem } from "../types/reader.types";
import { logger } from "@/utils/logger";

/**
 * Hook to control the FlashList scroll position based on store signals.
 * Decouples the UI scrolling logic from the state management.
 */
export function useReaderScrollController(
  flashListRef: React.RefObject<FlashListRef<AdapterItem> | null>
) {
  const scrollSignal = useReaderStoreV2((state) => state.scrollSignal);
  const viewerChapters = useReaderStoreV2((state) => state.viewerChapters);

  // Keep track of the last processed signal to avoid double-scrolling
  const lastSignalTimestamp = useRef<number>(0);

  useEffect(() => {
    if (!scrollSignal || !flashListRef.current || !viewerChapters) return;
    
    // Ignore old signals
    if (scrollSignal.timestamp <= lastSignalTimestamp.current) return;
    
    lastSignalTimestamp.current = scrollSignal.timestamp;

    const { pageIndex, animated } = scrollSignal;

    // Calculate offset dynamically based on actual list structure
    // This logic mirrors how the adapter items are built
    let offset = 0;
    if (viewerChapters.prevChapter) {
      if (viewerChapters.prevChapter.state === "loaded") {
        // Previous chapter pages + transition item between prev and curr
        offset = viewerChapters.prevChapter.pages.length + 1;
      } else {
        // Just the transition item (loading or wait state)
        offset = 1;
      }
    }

    const listIndex = pageIndex + offset;

    logger.reader.log("Processing Scroll Signal", {
      pageIndex,
      calculatedListIndex: listIndex,
      offset,
      animated,
    });

    try {
      flashListRef.current.scrollToIndex({
        index: listIndex,
        animated: animated,
      });
    } catch (error) {
      logger.reader.warn("scrollToIndex failed in Controller", { error });
    }
  }, [scrollSignal, viewerChapters, flashListRef]);
}
