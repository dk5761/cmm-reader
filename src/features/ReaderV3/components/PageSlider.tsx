/**
 * PageSlider - Slider for page navigation within current chapter
 * Features:
 * - Shows pages for current chapter only (like header)
 * - Syncs with scroll position when not dragging
 * - During drag: shows preview, doesn't scroll
 * - On release: scrolls to target page within chapter
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { View, Text } from "react-native";
import Slider from "@react-native-community/slider";
import { useReaderStore } from "../stores/useReaderStore";

interface PageSliderProps {
  flashListRef: React.RefObject<any>;
}

export function PageSlider({ flashListRef }: PageSliderProps) {
  const flatPages = useReaderStore((s) => s.flatPages);
  const currentFlatIndex = useReaderStore((s) => s.currentFlatIndex);

  const [isDragging, setIsDragging] = useState(false);
  const [sliderValue, setSliderValue] = useState(0); // Page index within chapter (0-based)
  const targetPageIndexRef = useRef<number | null>(null);

  // Get current page info
  const currentPage = flatPages[currentFlatIndex];
  const totalPagesInChapter = currentPage?.totalPagesInChapter || 0;
  const currentPageIndex = currentPage?.pageIndex || 0;
  const currentChapterId = currentPage?.chapterId;

  // Find the flat index of the first page of current chapter
  const chapterStartFlatIndex = useMemo(() => {
    if (!currentChapterId) return 0;
    return flatPages.findIndex((p) => p.chapterId === currentChapterId);
  }, [flatPages, currentChapterId]);

  // Sync slider with scroll position (only when not dragging and not seeking)
  useEffect(() => {
    if (!isDragging && totalPagesInChapter > 0) {
      // If we're seeking to a target, wait until we reach it
      if (targetPageIndexRef.current !== null) {
        if (currentPageIndex === targetPageIndexRef.current) {
          targetPageIndexRef.current = null;
          setSliderValue(currentPageIndex);
        }
        // Don't sync until we reach target
        return;
      }
      setSliderValue(currentPageIndex);
    }
  }, [currentPageIndex, isDragging, totalPagesInChapter]);

  // Handle slider value change during drag
  const handleValueChange = useCallback((value: number) => {
    setSliderValue(Math.round(value));
  }, []);

  // Handle drag start
  const handleSlidingStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle drag end - scroll to page within chapter
  const handleSlidingComplete = useCallback(
    (value: number) => {
      const targetPageIndex = Math.round(value);
      setIsDragging(false);

      if (flashListRef.current && targetPageIndex !== currentPageIndex) {
        // Set target so we don't reset slider until we reach it
        targetPageIndexRef.current = targetPageIndex;
        setSliderValue(targetPageIndex);

        // Calculate the flat index: chapter start + target page index
        const targetFlatIndex = chapterStartFlatIndex + targetPageIndex;

        flashListRef.current.scrollToIndex({
          index: targetFlatIndex,
          animated: true,
        });
      }
    },
    [flashListRef, currentPageIndex, chapterStartFlatIndex]
  );

  if (totalPagesInChapter === 0) return null;

  const displayPage = Math.round(sliderValue) + 1;

  return (
    <View className="px-4 py-2">
      <View className="flex-row items-center gap-3">
        <Text className="text-white text-sm font-semibold min-w-[32px] text-center">
          {displayPage}
        </Text>
        <Slider
          style={{ flex: 1, height: 40 }}
          minimumValue={0}
          maximumValue={Math.max(0, totalPagesInChapter - 1)}
          value={sliderValue}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor="#fff"
          maximumTrackTintColor="#666"
          thumbTintColor="#fff"
        />
        <Text className="text-white text-sm font-semibold min-w-[32px] text-center">
          {totalPagesInChapter}
        </Text>
      </View>
    </View>
  );
}
