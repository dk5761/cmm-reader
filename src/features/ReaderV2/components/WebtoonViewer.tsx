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

const VIEWABILITY_CONFIG = {
  // Low threshold because webtoon pages can be very tall (taller than viewport)
  // so 50% of the item might never be visible at once.
  itemVisiblePercentThreshold: 10,
};

const TRANSITION_SETTLE_DELAY = 300; // ms to wait for FlashList to settle after scroll
const DRAW_DISTANCE_MULTIPLIER = 0.75; // 3/4 screen height for preloading

/**
 * Calculate the index of the next chapter transition item in the adapter
 */
function calculateNextTransitionIndex(
  viewerChapters: ViewerChapters | null
): number {
  if (!viewerChapters) return 0;
  const currPages = viewerChapters.currChapter.pages.length;
  const prevPages =
    viewerChapters.prevChapter?.state === "loaded"
      ? viewerChapters.prevChapter.pages.length + 1
      : 1;
  return currPages + prevPages;
}

/**
 * Calculate the index of the previous chapter transition item in the adapter
 */
function calculatePrevTransitionIndex(
  viewerChapters: ViewerChapters | null
): number {
  return viewerChapters?.prevChapter?.pages.length ?? 0;
}

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
  const transitionToNextChapter = useReaderStoreV2(
    (s) => s.transitionToNextChapter
  );
  const transitionToPrevChapter = useReaderStoreV2(
    (s) => s.transitionToPrevChapter
  );

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

    const builtItems = buildAdapterItems(
      viewerChapters,
      viewerChapters.prevChapter?.state === "loading",
      viewerChapters.nextChapter?.state === "loading"
    );

    if (__DEV__) {
      console.log("[WebtoonViewer] Building adapter items:", {
        currChapterId: viewerChapters.currChapter?.chapter.id,
        prevChapterState: viewerChapters.prevChapter?.state,
        prevChapterPages: viewerChapters.prevChapter?.pages.length ?? 0,
        nextChapterState: viewerChapters.nextChapter?.state,
        nextChapterPages: viewerChapters.nextChapter?.pages.length ?? 0,
        currChapterPages: viewerChapters.currChapter?.pages.length ?? 0,
        totalItems: builtItems.length,
      });
    }

    return builtItems;
  }, [viewerChapters]);

  // Simplified viewability callback using refs for stable function identity
  // while still having access to latest store actions
  const storeActionsRef = useRef({
    setCurrentPage,
    loadNextChapter,
    loadPrevChapter,
    transitionToNextChapter,
    transitionToPrevChapter,
  });

  // Keep ref updated with latest actions
  useEffect(() => {
    storeActionsRef.current = {
      setCurrentPage,
      loadNextChapter,
      loadPrevChapter,
      transitionToNextChapter,
      transitionToPrevChapter,
    };
  }, [setCurrentPage, loadNextChapter, loadPrevChapter, transitionToNextChapter, transitionToPrevChapter]);

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
      if (isTransitioningRef.current) {
        if (__DEV__) {
          console.warn(
            "[WebtoonViewer] ⚠️ Already transitioning, skipping next chapter scroll"
          );
        }
        return;
      }

      if (__DEV__) {
        console.log(
          "[WebtoonViewer] 🎯 Next chapter just loaded, scrolling to transition"
        );
      }

      isTransitioningRef.current = true;

      const transitionIndex = calculateNextTransitionIndex(viewerChapters);

      try {
        flashListRef.current?.scrollToIndex({
          index: transitionIndex,
          animated: false,
          viewPosition: 0,
        });
        if (__DEV__) {
          console.log("[WebtoonViewer] ✅ Scrolled to transition:", {
            transitionIndex,
          });
        }
      } catch (error) {
        console.warn("[WebtoonViewer] Failed to scroll to transition:", error);
      }

      // Allow viewability updates after a short delay to let FlashList settle
      setTimeout(() => {
        isTransitioningRef.current = false;
        if (__DEV__) {
          console.log("[WebtoonViewer] 🔓 Transition guard released");
        }
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
        if (__DEV__) {
          console.warn(
            "[WebtoonViewer] ⚠️ Already transitioning, skipping prev chapter scroll"
          );
        }
        return;
      }

      if (__DEV__) {
        console.log(
          "[WebtoonViewer] 🎯 Previous chapter just loaded, scrolling to transition"
        );
      }

      isTransitioningRef.current = true;

      const transitionIndex = calculatePrevTransitionIndex(viewerChapters);

      try {
        flashListRef.current?.scrollToIndex({
          index: transitionIndex,
          animated: false,
          viewPosition: 1,
        });
        if (__DEV__) {
          console.log(
            "[WebtoonViewer] ✅ Scrolled to prev chapter transition:",
            { transitionIndex }
          );
        }
      } catch (error) {
        console.warn(
          "[WebtoonViewer] Failed to scroll to prev chapter transition:",
          error
        );
      }

      setTimeout(() => {
        isTransitioningRef.current = false;
        if (__DEV__) {
          console.log("[WebtoonViewer] 🔓 Prev transition guard released");
        }
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

      if (isTransitioningRef.current) {
        if (__DEV__) {
          console.log(
            "[WebtoonViewer] ⏸️ Skipping viewability during transition"
          );
        }
        return;
      }

      const {
        setCurrentPage,
        loadNextChapter,
        loadPrevChapter,
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
          if (__DEV__) {
            console.log("[WebtoonViewer] Transition item visible (no pages):", {
              direction: lastItem.direction,
              targetChapterId: lastItem.targetChapter?.chapter.id,
              viewableItemsCount: viewableItems.length,
            });
          }
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

        // DEBUG: Log page tracking info
        if (__DEV__) {
          console.log("[WebtoonViewer] Viewable page changed:", {
            pageIndex,
            chapterId: visibleChapterId,
            currentChapterId,
            nextChapterId,
            prevChapterId,
            visibleItemsCount: viewableItems.length,
            isDifferentChapter: visibleChapterId !== currentChapterId,
          });
        }

        // Check if we've transitioned to a different chapter
        if (visibleChapterId !== currentChapterId) {
          // Check if ALL visible pages are from the new chapter (fully transitioned)
          const allPagesFromSameChapter = visiblePages.every(
            (v) =>
              v.item.type === "page" && v.item.chapterId === visibleChapterId
          );

          if (__DEV__) {
            console.log("[WebtoonViewer] Chapter transition detected:", {
              fromChapter: currentChapterId,
              toChapter: visibleChapterId,
              allPagesFromSameChapter,
              expectedNextChapter: nextChapterId,
              expectedPrevChapter: prevChapterId,
            });
          }

          if (allPagesFromSameChapter) {
            if (visibleChapterId === nextChapterId) {
              if (__DEV__) {
                console.log(
                  "[WebtoonViewer] ✅ Calling transitionToNextChapter()",
                  visibleChapterId
                );
              }
              transitionToNextChapter();
            } else if (visibleChapterId === prevChapterId) {
              if (__DEV__) {
                console.log(
                  "[WebtoonViewer] ✅ Calling transitionToPrevChapter()",
                  visibleChapterId
                );
              }
              transitionToPrevChapter();
            }
          }
        }

        // Update current page (this will now be correct after transition)
        if (__DEV__) {
          console.log("[WebtoonViewer] Calling setCurrentPage():", {
            pageIndex,
            chapterId: visibleChapterId,
          });
        }
        setCurrentPage(pageIndex);
      }

      // Check for transition items (for chapter preloading)
      const lastItem = viewableItems[viewableItems.length - 1]?.item;
      if (lastItem?.type === "transition") {
        if (__DEV__) {
          console.log("[WebtoonViewer] Transition item visible (with pages):", {
            direction: lastItem.direction,
            targetChapterId: lastItem.targetChapter?.chapter.id,
            viewableItemsCount: viewableItems.length,
          });
        }
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
