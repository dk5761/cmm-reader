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

  

      if (wasLoading && isNowLoaded && viewerChapters?.nextChapter) {

        // Guard against multiple simultaneous transitions

        if (isTransitioningRef.current) return;

  

        isTransitioningRef.current = true;

  

        // Allow viewability updates after a short delay to let FlashList settle

        setTimeout(() => {

          isTransitioningRef.current = false;

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

        if (isTransitioningRef.current) return;

  

        isTransitioningRef.current = true;

  

        setTimeout(() => {

          isTransitioningRef.current = false;

        }, TRANSITION_SETTLE_DELAY);

      }

  

      prevChapterLoadingRef.current = prevChapterState === "loading";

    }, [prevChapterState, viewerChapters?.prevChapter?.pages.length]);

  

    // Stable viewability callback that reads from ref

    const handleViewableItemsChanged = useCallback(

      ({ viewableItems }: { viewableItems: ViewToken<AdapterItem>[] }) => {

        // Skip empty updates (happens during layout shifts)

        if (viewableItems.length === 0) return;

  

        if (isTransitioningRef.current) return;

  

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

            if (lastItem.direction === "next" && lastItem.targetChapter) {

              loadNextChapter();

            } else if (lastItem.direction === "prev" && lastItem.targetChapter) {

              loadPrevChapter();

            }

          }

          return;

        }

  

                // Find the first visible page (default behavior)

  

                let primaryPageItem = visiblePages[0];

  

        

  

                // HEURISTIC: If the last visible page is the ACTUAL last page of the chapter,

  

                // use it as the primary page. This ensures we hit the end of the chapter

  

                // for progress tracking, especially if the last page is short and shares

  

                // the screen with the previous page.

  

                const lastVisiblePage = visiblePages[visiblePages.length - 1];

  

                if (

  

                  lastVisiblePage?.item?.type === "page" &&

  

                  lastVisiblePage.item.chapterId === currentChapterId

  

                ) {

  

                  // We need to know the total pages to verify if this is the last index.

  

                  // Since we don't have totalPages directly in the item, we can infer it

  

                  // or check against the store logic.

  

                  // Ideally, the item should carry 'isLastPage' flag, but we can check

  

                  // against viewerChapters if available in ref.

  

                  

  

                  // Simplified check: If we are at the bottom of the list and no next chapter is loaded/loading?

  

                  // Actually, we can check if the page index is high enough.

  

                  

  

                  // Better: just check if it's the last page index of the current chapter from store data

  

                  // But we don't have easy access to the full chapter object here without prop drilling.

  

                  

  

                  // Alternate: If the user is scrolling DOWN (we can infer or just bias bottom),

  

                  // and multiple pages are visible, taking the bottom-most one is safer for "completion".

  

                  // Taking the middle one is a good compromise.

  

                  

  

                  // Let's use the MIDDLE visible page strategy as discussed.

  

                  const middleIndex = Math.floor(visiblePages.length / 2);

  

                  const middlePage = visiblePages[middleIndex];

  

                  if (middlePage?.item?.type === "page") {

  

                     primaryPageItem = middlePage;

  

                  }

  

                  

  

                  // And if the VERY last page is visible, definitely pick it to ensure 100% progress.

  

                  // We can check if `lastVisiblePage` index > `primaryPageItem` index.

  

                  if (lastVisiblePage.item.page.index > primaryPageItem.item.page.index) {

  

                     // Bias towards the end to ensure we hit the threshold

  

                     primaryPageItem = lastVisiblePage;

  

                  }

  

                }

  

        

  

                if (primaryPageItem?.item && primaryPageItem.item.type === "page") {

  

                  const visibleChapterId = primaryPageItem.item.chapterId;

  

                  const pageIndex = primaryPageItem.item.page.index;

  

        

  

                  // Check if we've scrolled into a different chapter

          if (visibleChapterId !== currentChapterId) {

            // Check if ALL visible pages are from the new chapter (fully transitioned)

            const allPagesFromSameChapter = visiblePages.every(

              (v) =>

                v.item.type === "page" && v.item.chapterId === visibleChapterId

            );

  

            // PHASE 1: Update active chapter metadata immediately (at page 1)

            if (

              allPagesFromSameChapter &&

              pageIndex >= MIN_PAGES_FOR_ACTIVE_CHAPTER

            ) {

              updateActiveChapter(visibleChapterId, pageIndex);

            }

  

            // PHASE 2: Adapter cleanup (at page 3) - remove old chapter from list

            if (

              allPagesFromSameChapter &&

              pageIndex >= MIN_PAGES_BEFORE_ADAPTER_CLEANUP

            ) {

              if (visibleChapterId === nextChapterId) {

                // Set transitioning flag to prevent scroll position issues

                isTransitioningRef.current = true;

                transitionToNextChapter();

  

                // The transition will rebuild adapter items, removing old prevChapter

                setTimeout(() => {

                  isTransitioningRef.current = false;

                }, TRANSITION_SETTLE_DELAY);

  

                return; // Don't update currentPage during transition

              } else if (visibleChapterId === prevChapterId) {

                isTransitioningRef.current = true;

                transitionToPrevChapter();

  

                setTimeout(() => {

                  isTransitioningRef.current = false;

                }, TRANSITION_SETTLE_DELAY);

  

                return;

              }

            }

          }

  

          // Update current page

          setCurrentPage(pageIndex);

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
      estimatedItemSize={screenHeight}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
    />
  );
});