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
  type ViewerChapters,
} from "../types/reader.types";
import { useReaderScrollController } from "../hooks/useReaderScrollController";

const VIEWABILITY_CONFIG = {
  // Low threshold because webtoon pages can be very tall (taller than viewport)
  // so 50% of the item might never be visible at once.
  itemVisiblePercentThreshold: 10,
};

const TRANSITION_SETTLE_DELAY = 300; // ms to wait for FlashList to settle after scroll
const DRAW_DISTANCE_MULTIPLIER = 0.75; // 3/4 screen height for preloading

// Page threshold to update active chapter metadata (for overlay/slider)
// Called immediately when user scrolls to page 1 of a different chapter
const MIN_PAGES_FOR_ACTIVE_CHAPTER = 0;

// Minimum pages to scroll into new chapter before triggering adapter cleanup
// This prevents scroll jumps when items are removed from the beginning of the list
const MIN_PAGES_BEFORE_ADAPTER_CLEANUP = 3;

export const WebtoonViewer = memo(function WebtoonViewer() {
  const flashListRef = useRef<FlashListRef<AdapterItem>>(null);
  const { height: screenHeight } = useWindowDimensions();

  // Attach the scroll controller hook
  useReaderScrollController(flashListRef);

  const viewerChapters = useReaderStoreV2((s) => s.viewerChapters);
  const setCurrentPage = useReaderStoreV2((s) => s.setCurrentPage);
  const loadNextChapter = useReaderStoreV2((s) => s.loadNextChapter);
  const loadPrevChapter = useReaderStoreV2((s) => s.loadPrevChapter);
  const retryNextChapter = useReaderStoreV2((s) => s.retryNextChapter);
  const retryPrevChapter = useReaderStoreV2((s) => s.retryPrevChapter);
  const updateActiveChapter = useReaderStoreV2((s) => s.updateActiveChapter);
  const transitionToNextChapter = useReaderStoreV2(
    (s) => s.transitionToNextChapter
  );
  const transitionToPrevChapter = useReaderStoreV2(
    (s) => s.transitionToPrevChapter
  );

  // Build adapter items from viewer chapters
  const items: AdapterItem[] = useMemo(() => {
    if (!viewerChapters) return [];

    const builtItems = buildAdapterItems(
      viewerChapters,
      viewerChapters.prevChapter?.state === "loading",
      viewerChapters.nextChapter?.state === "loading"
    );

    // Always log adapter items for debugging the jump issue
    console.log("[WebtoonViewer] 🔨 Building adapter items:", {
      currChapterId: viewerChapters.currChapter?.chapter.id,
      currChapterNumber: viewerChapters.currChapter?.chapter.number,
      prevChapterState: viewerChapters.prevChapter?.state,
      prevChapterPages: viewerChapters.prevChapter?.pages.length ?? 0,
      nextChapterState: viewerChapters.nextChapter?.state,
      nextChapterPages: viewerChapters.nextChapter?.pages.length ?? 0,
      currChapterPages: viewerChapters.currChapter?.pages.length ?? 0,
      totalItems: builtItems.length,
      itemBreakdown: {
        prevItems: viewerChapters.prevChapter
          ? viewerChapters.prevChapter.state === "loaded"
            ? viewerChapters.prevChapter.pages.length + 1
            : 1
          : 0,
        currItems: viewerChapters.currChapter.pages.length,
        nextItems: viewerChapters.nextChapter
          ? viewerChapters.nextChapter.state === "loaded"
            ? viewerChapters.nextChapter.pages.length + 1
            : 1
          : 0,
      },
    });

    return builtItems;
  }, [viewerChapters]);

  // Simplified viewability callback using refs for stable function identity
  // while still having access to latest store actions
  const storeActionsRef = useRef({
    setCurrentPage,
    loadNextChapter,
    loadPrevChapter,
    updateActiveChapter,
    transitionToNextChapter,
    transitionToPrevChapter,
  });

  // Keep ref updated with latest actions
  useEffect(() => {
    storeActionsRef.current = {
      setCurrentPage,
      loadNextChapter,
      loadPrevChapter,
      updateActiveChapter,
      transitionToNextChapter,
      transitionToPrevChapter,
    };
  }, [setCurrentPage, loadNextChapter, loadPrevChapter, updateActiveChapter, transitionToNextChapter, transitionToPrevChapter]);

  const currentChapterId = viewerChapters?.currChapter?.chapter.id;
  const nextChapterId = viewerChapters?.nextChapter?.chapter.id;
  const prevChapterId = viewerChapters?.prevChapter?.chapter.id;
  const nextChapterState = viewerChapters?.nextChapter?.state;

  const chapterIdsRef = useRef({
    currentChapterId,
    nextChapterId,
    prevChapterId,
  });

  const nextChapterLoadingRef = useRef(false);
  const prevChapterLoadingRef = useRef(false);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    chapterIdsRef.current = {
      currentChapterId,
      nextChapterId,
      prevChapterId,
    };
  }, [currentChapterId, nextChapterId, prevChapterId]);

  useEffect(() => {
    const wasLoading = nextChapterLoadingRef.current;
    const isNowLoaded = nextChapterState === "loaded";

    console.log("[WebtoonViewer] 🔄 Next chapter state effect:", {
      wasLoading,
      isNowLoaded,
      nextChapterState,
      nextChapterId: viewerChapters?.nextChapter?.chapter.id,
      nextChapterPages: viewerChapters?.nextChapter?.pages.length,
      isTransitioning: isTransitioningRef.current,
    });

    if (wasLoading && isNowLoaded && viewerChapters?.nextChapter) {
      // Guard against multiple simultaneous transitions
      if (isTransitioningRef.current) {
        console.warn(
          "[WebtoonViewer] ⚠️ Already transitioning, skipping next chapter scroll"
        );
        return;
      }

      console.log(
        "[WebtoonViewer] 🎯 Next chapter just loaded - NOT scrolling (let user scroll naturally)"
      );

      // REMOVED: scrollToIndex call
      // The scrollToIndex was causing jumps because:
      // 1. FlashList's size estimation may be inaccurate for variable-height webtoon pages
      // 2. The user is already near/at the transition naturally
      // 3. Forcing a scroll can conflict with the user's current scroll position
      //
      // Instead, we just set the transition guard briefly to prevent
      // viewability callback from firing during the adapter rebuild

      isTransitioningRef.current = true;

      // Allow viewability updates after a short delay to let FlashList settle
      setTimeout(() => {
        isTransitioningRef.current = false;
        console.log("[WebtoonViewer] 🔓 Transition guard released after delay");
      }, TRANSITION_SETTLE_DELAY);
    }

    nextChapterLoadingRef.current = nextChapterState === "loading";
  }, [nextChapterState, viewerChapters?.currChapter.pages.length, viewerChapters?.prevChapter?.pages.length, viewerChapters?.prevChapter?.state]);

  const prevChapterState = viewerChapters?.prevChapter?.state;

  useEffect(() => {
    const wasLoading = prevChapterLoadingRef.current;
    const isNowLoaded = prevChapterState === "loaded";

    if (wasLoading && isNowLoaded && viewerChapters?.prevChapter) {
      // Guard against multiple simultaneous transitions
      if (isTransitioningRef.current) {
        console.warn(
          "[WebtoonViewer] ⚠️ Already transitioning, skipping prev chapter scroll"
        );
        return;
      }

      console.log(
        "[WebtoonViewer] 🎯 Previous chapter just loaded - NOT scrolling (let user scroll naturally)"
      );

      // REMOVED: scrollToIndex call
      // Same reasoning as next chapter - let user scroll naturally
      // The transition guard prevents viewability jitter during rebuild

      isTransitioningRef.current = true;

      setTimeout(() => {
        isTransitioningRef.current = false;
        console.log("[WebtoonViewer] 🔓 Prev transition guard released");
      }, TRANSITION_SETTLE_DELAY);
    }

    prevChapterLoadingRef.current = prevChapterState === "loading";
  }, [prevChapterState, viewerChapters?.prevChapter?.pages.length]);

  // Stable viewability callback that reads from ref
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<AdapterItem>[] }) => {
      // Skip empty updates (happens during layout shifts)
      if (viewableItems.length === 0) {
        return;
      }

      // Log every viewability change for debugging
      console.log("[WebtoonViewer] 👁️ onViewableItemsChanged:", {
        viewableCount: viewableItems.length,
        isTransitioning: isTransitioningRef.current,
        firstItemType: viewableItems[0]?.item?.type,
        firstItemIndex: viewableItems[0]?.index,
        lastItemType: viewableItems[viewableItems.length - 1]?.item?.type,
        lastItemIndex: viewableItems[viewableItems.length - 1]?.index,
      });

      if (isTransitioningRef.current) {
        console.log(
          "[WebtoonViewer] ⏸️ Skipping viewability update during transition"
        );
        return;
      }

      const {
        setCurrentPage,
        loadNextChapter,
        loadPrevChapter,
        updateActiveChapter,
        transitionToNextChapter,
        transitionToPrevChapter,
      } = storeActionsRef.current;

      const { currentChapterId, nextChapterId, prevChapterId } =
        chapterIdsRef.current;

      // Get all visible page items
      const visiblePages = viewableItems.filter(
        (v) => v.item?.type === "page"
      ) as ViewToken<AdapterItem & { type: "page" }>[];

      if (visiblePages.length === 0) {
        // Check for transition items (for chapter preloading)
        const lastItem = viewableItems[viewableItems.length - 1]?.item;
        if (lastItem?.type === "transition") {
          console.log(
            "[WebtoonViewer] 🔀 Transition item visible (no pages):",
            {
              direction: lastItem.direction,
              targetChapterId: lastItem.targetChapter?.chapter.id,
              targetChapterState: lastItem.targetChapter?.state,
              viewableItemsCount: viewableItems.length,
            }
          );
          if (lastItem.direction === "next" && lastItem.targetChapter) {
            loadNextChapter();
          } else if (lastItem.direction === "prev" && lastItem.targetChapter) {
            loadPrevChapter();
          }
        }
        return;
      }

      // Find the first visible page
      const firstPage = visiblePages[0];
      if (firstPage?.item && firstPage.item.type === "page") {
        const visibleChapterId = firstPage.item.chapterId;
        const pageIndex = firstPage.item.page.index;

        // Log detailed page tracking info
        console.log("[WebtoonViewer] 📖 Viewable page detected:", {
          pageIndex,
          chapterId: visibleChapterId,
          currentChapterId,
          nextChapterId,
          prevChapterId,
          visiblePagesCount: visiblePages.length,
          isDifferentChapter: visibleChapterId !== currentChapterId,
          allVisibleChapterIds: visiblePages.map((v) => v.item.chapterId),
        });

        // Check if we've scrolled into a different chapter
        if (visibleChapterId !== currentChapterId) {
          // Check if ALL visible pages are from the new chapter (fully transitioned)
          const allPagesFromSameChapter = visiblePages.every(
            (v) =>
              v.item.type === "page" && v.item.chapterId === visibleChapterId
          );

          console.log("[WebtoonViewer] 🔄 Chapter change check:", {
            fromChapter: currentChapterId,
            toChapter: visibleChapterId,
            allPagesFromSameChapter,
            pageIndex,
            minPagesForActiveChapter: MIN_PAGES_FOR_ACTIVE_CHAPTER,
            minPagesForAdapterCleanup: MIN_PAGES_BEFORE_ADAPTER_CLEANUP,
            isNextChapter: visibleChapterId === nextChapterId,
            isPrevChapter: visibleChapterId === prevChapterId,
          });

          // PHASE 1: Update active chapter metadata immediately (at page 1)
          // This updates overlay/slider to show new chapter info
          if (
            allPagesFromSameChapter &&
            pageIndex >= MIN_PAGES_FOR_ACTIVE_CHAPTER
          ) {
            console.log("[WebtoonViewer] 🎯 Calling updateActiveChapter()", {
              chapterId: visibleChapterId,
              pageIndex,
            });
            updateActiveChapter(visibleChapterId, pageIndex);
          }

          // PHASE 2: Adapter cleanup (at page 3) - remove old chapter from list
          // This is delayed to prevent scroll jumps when removing items
          if (
            allPagesFromSameChapter &&
            pageIndex >= MIN_PAGES_BEFORE_ADAPTER_CLEANUP
          ) {
            if (visibleChapterId === nextChapterId) {
              console.log(
                "[WebtoonViewer] ✅ Calling transitionToNextChapter() (adapter cleanup)",
                { targetChapterId: visibleChapterId, pageIndex }
              );

              // Set transitioning flag to prevent scroll position issues
              isTransitioningRef.current = true;

              transitionToNextChapter();

              // The transition will rebuild adapter items, removing old prevChapter
              // FlashList should maintain scroll position based on keys
              // Release the guard after FlashList settles
              setTimeout(() => {
                isTransitioningRef.current = false;
                console.log(
                  "[WebtoonViewer] 🔓 Adapter cleanup guard released"
                );
              }, TRANSITION_SETTLE_DELAY);

              return; // Don't update currentPage during transition
            } else if (visibleChapterId === prevChapterId) {
              console.log(
                "[WebtoonViewer] ✅ Calling transitionToPrevChapter() (adapter cleanup)",
                { targetChapterId: visibleChapterId, pageIndex }
              );

              isTransitioningRef.current = true;

              transitionToPrevChapter();

              setTimeout(() => {
                isTransitioningRef.current = false;
                console.log(
                  "[WebtoonViewer] 🔓 Prev adapter cleanup guard released"
                );
              }, TRANSITION_SETTLE_DELAY);

              return;
            }
          } else if (allPagesFromSameChapter) {
            console.log("[WebtoonViewer] ⏳ Waiting for adapter cleanup:", {
              currentPage: pageIndex,
              needsPage: MIN_PAGES_BEFORE_ADAPTER_CLEANUP,
            });
          }
        }

        // Update current page
        console.log("[WebtoonViewer] 📄 Calling setCurrentPage:", {
          pageIndex,
          chapterId: visibleChapterId,
        });
        setCurrentPage(pageIndex);
      }

      // Check for transition items (for chapter preloading)
      const lastItem = viewableItems[viewableItems.length - 1]?.item;
      if (lastItem?.type === "transition") {
        console.log(
          "[WebtoonViewer] 🔀 Transition item visible (with pages):",
          {
            direction: lastItem.direction,
            targetChapterId: lastItem.targetChapter?.chapter.id,
            targetChapterState: lastItem.targetChapter?.state,
            viewableItemsCount: viewableItems.length,
          }
        );
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

      return (
        <ChapterTransition item={item} onLoad={onLoad} onRetry={onRetry} />
      );
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
      drawDistance={screenHeight * DRAW_DISTANCE_MULTIPLIER}
    />
  );
});