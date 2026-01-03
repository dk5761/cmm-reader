/**
 * WebtoonViewer Component
 *
 * Main vertical scrolling reader using FlashList.
 * Uses onViewableItemsChanged for reliable page tracking.
 */

import { memo, useCallback, useRef, useEffect, useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import type ViewToken from "@shopify/flash-list/dist/recyclerview/viewability/ViewToken";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import { ReaderPage } from "./ReaderPage";
import { ChapterTransition } from "./ChapterTransition";
import {
  buildAdapterItems,
  getItemKey,
  type AdapterItem,
} from "../types/reader.types";

const VIEWABILITY_CONFIG = {
  // Low threshold because webtoon pages can be very tall (taller than viewport)
  // so 50% of the item might never be visible at once.
  itemVisiblePercentThreshold: 10,
};

export const WebtoonViewer = memo(function WebtoonViewer() {
  const flashListRef = useRef<FlashListRef<AdapterItem>>(null);
  const { height: screenHeight } = useWindowDimensions();

  const viewerChapters = useReaderStoreV2((s) => s.viewerChapters);
  const setCurrentPage = useReaderStoreV2((s) => s.setCurrentPage);
  const setFlashListRef = useReaderStoreV2((s) => s.setFlashListRef);
  const loadNextChapter = useReaderStoreV2((s) => s.loadNextChapter);
  const loadPrevChapter = useReaderStoreV2((s) => s.loadPrevChapter);
  const retryNextChapter = useReaderStoreV2((s) => s.retryNextChapter);
  const retryPrevChapter = useReaderStoreV2((s) => s.retryPrevChapter);

  // Register ref with store
  useEffect(() => {
    if (flashListRef.current) {
      setFlashListRef(
        flashListRef as React.RefObject<FlashListRef<AdapterItem>>
      );
    }
  }, [setFlashListRef]);

  // Build adapter items from viewer chapters
  const items: AdapterItem[] = useMemo(() => {
    if (!viewerChapters) return [];
    return buildAdapterItems(
      viewerChapters,
      viewerChapters.prevChapter?.state === "loading",
      viewerChapters.nextChapter?.state === "loading"
    );
  }, [viewerChapters]);

  // Simplified viewability callback using refs for stable function identity
  // while still having access to latest store actions
  const storeActionsRef = useRef({
    setCurrentPage,
    loadNextChapter,
    loadPrevChapter,
  });

  // Keep ref updated with latest actions
  useEffect(() => {
    storeActionsRef.current = {
      setCurrentPage,
      loadNextChapter,
      loadPrevChapter,
    };
  }, [setCurrentPage, loadNextChapter, loadPrevChapter]);

  // Stable viewability callback that reads from ref
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<AdapterItem>[] }) => {
      // Skip empty updates (happens during layout shifts)
      if (viewableItems.length === 0) {
        return;
      }

      const { setCurrentPage, loadNextChapter, loadPrevChapter } =
        storeActionsRef.current;

      // Find the first visible PAGE item (skip transitions)
      const firstPage = viewableItems.find((v) => v.item?.type === "page");
      if (firstPage?.item && firstPage.item.type === "page") {
        setCurrentPage(firstPage.item.page.index);
      }

      // Check for transition items (for chapter preloading)
      const lastItem = viewableItems[viewableItems.length - 1]?.item;
      if (lastItem?.type === "transition") {
        if (lastItem.direction === "next" && lastItem.targetChapter) {
          loadNextChapter();
        } else if (lastItem.direction === "prev" && lastItem.targetChapter) {
          loadPrevChapter();
        }
      }
    },
    [] // Empty deps - uses ref for latest values
  );

  // Stable viewability config callback pairs
  const viewabilityConfigCallbackPairs = useMemo(
    () => [
      {
        onViewableItemsChanged: handleViewableItemsChanged,
        viewabilityConfig: VIEWABILITY_CONFIG,
      },
    ],
    [handleViewableItemsChanged]
  );

  // Render item based on type
  const renderItem = useCallback(
    ({ item }: { item: AdapterItem }) => {
      if (item.type === "page") {
        return <ReaderPage page={item.page} />;
      }
      // Pass retry handler for error states
      const onRetry =
        item.direction === "next" ? retryNextChapter : retryPrevChapter;
      const onLoad =
        item.direction === "next" ? loadNextChapter : loadPrevChapter;

      return <ChapterTransition item={item} onLoad={onLoad} onRetry={onRetry} />;
    },
    [loadNextChapter, loadPrevChapter, retryNextChapter, retryPrevChapter]
  );

  // Get item type for recycling optimization
  const getItemType = useCallback((item: AdapterItem) => {
    return item.type;
  }, []);

  if (!viewerChapters) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        {/* Loading state handled by parent */}
      </View>
    );
  }

  return (
    <FlashList
      ref={flashListRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={getItemKey}
      getItemType={getItemType}
      viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
      showsVerticalScrollIndicator={false}
      // Match Mihon's extraLayoutSpace (3/4 screen height) for better preloading
      drawDistance={screenHeight * 0.75}
    />
  );
});
