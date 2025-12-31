/**
 * WebtoonViewer Component
 *
 * Main vertical scrolling reader using FlashList.
 * Uses onScroll with firstVisibleIndex for reliable page tracking.
 */

import { memo, useCallback, useRef, useEffect } from "react";
import {
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
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

  const viewerChapters = useReaderStoreV2((s) => s.viewerChapters);
  const setCurrentPage = useReaderStoreV2((s) => s.setCurrentPage);
  const setFlashListRef = useReaderStoreV2((s) => s.setFlashListRef);
  const loadNextChapter = useReaderStoreV2((s) => s.loadNextChapter);
  const loadPrevChapter = useReaderStoreV2((s) => s.loadPrevChapter);

  // Register ref with store
  useEffect(() => {
    if (flashListRef.current) {
      setFlashListRef(
        flashListRef as React.RefObject<FlashListRef<AdapterItem>>
      );
    }
  }, [setFlashListRef]);

  // Build adapter items from viewer chapters
  const items: AdapterItem[] = viewerChapters
    ? buildAdapterItems(
        viewerChapters,
        viewerChapters.prevChapter?.state === "loading",
        viewerChapters.nextChapter?.state === "loading"
      )
    : [];

  // Stable viewability callback (prevent FlashList from ignoring updates)
  const viewabilityRef = useRef({
    onViewableItemsChanged: ({
      viewableItems,
    }: {
      viewableItems: ViewToken<AdapterItem>[];
    }) => {
      // Skip empty updates (happens during layout shifts)
      if (viewableItems.length === 0) {
        return;
      }

      /*
      const visibleIndices = viewableItems
        .map((v) =>
          v.item?.type === "page" ? `P${v.item.page.index}` : v.item?.type
        )
        .join(", ");
      console.log(
        "[WebtoonViewer] Visible:",
        visibleIndices
      );
      */

      // Find the first visible PAGE item (skip transitions)
      const firstPage = viewableItems.find((v) => v.item?.type === "page");
      if (firstPage?.item && firstPage.item.type === "page") {
        const newPage = firstPage.item.page.index;
        // console.log("[WebtoonViewer] Setting page to:", newPage);
        setCurrentPage(newPage);
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
    viewabilityConfig: VIEWABILITY_CONFIG,
  });

  // Update ref when dependencies change
  useEffect(() => {
    viewabilityRef.current.onViewableItemsChanged = ({
      viewableItems,
    }: {
      viewableItems: ViewToken<AdapterItem>[];
    }) => {
      // Find first visible page
      const firstPage = viewableItems.find((v) => v.item?.type === "page");
      if (firstPage?.item && firstPage.item.type === "page") {
        setCurrentPage(firstPage.item.page.index);
      }

      // Check transitions
      const lastItem = viewableItems[viewableItems.length - 1]?.item;
      if (lastItem?.type === "transition") {
        if (lastItem.direction === "next" && lastItem.targetChapter) {
          loadNextChapter();
        } else if (lastItem.direction === "prev" && lastItem.targetChapter) {
          loadPrevChapter();
        }
      }
    };
  }, [setCurrentPage, loadNextChapter, loadPrevChapter]);

  // Viewability config pairs (React Native pattern for stable callbacks)
  const viewabilityConfigCallbackPairs = useRef([viewabilityRef.current]);

  // Render item based on type
  const renderItem = useCallback(
    ({ item }: { item: AdapterItem }) => {
      if (item.type === "page") {
        return <ReaderPage page={item.page} />;
      }
      return (
        <ChapterTransition
          item={item}
          onLoad={item.direction === "next" ? loadNextChapter : loadPrevChapter}
        />
      );
    },
    [loadNextChapter, loadPrevChapter]
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
      viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
      showsVerticalScrollIndicator={false}
    />
  );
});
