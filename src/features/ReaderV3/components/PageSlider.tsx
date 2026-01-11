/**
 * PageSlider - Slider for page navigation
 * Features:
 * - Syncs with scroll position when not dragging
 * - During drag: shows preview, doesn't scroll
 * - On release: scrolls to target page
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  const [sliderValue, setSliderValue] = useState(0);
  const targetIndexRef = useRef<number | null>(null);

  const totalPages = flatPages.length;

  // Sync slider with scroll position (only when not dragging and not seeking)
  useEffect(() => {
    if (!isDragging && totalPages > 0) {
      // If we're seeking to a target, wait until we reach it
      if (targetIndexRef.current !== null) {
        if (currentFlatIndex === targetIndexRef.current) {
          targetIndexRef.current = null;
          setSliderValue(currentFlatIndex);
        }
        // Don't sync until we reach target
        return;
      }
      setSliderValue(currentFlatIndex);
    }
  }, [currentFlatIndex, isDragging, totalPages]);

  // Handle slider value change during drag
  const handleValueChange = useCallback((value: number) => {
    setSliderValue(Math.round(value));
  }, []);

  // Handle drag start
  const handleSlidingStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle drag end - scroll to page
  const handleSlidingComplete = useCallback(
    (value: number) => {
      const targetIndex = Math.round(value);
      setIsDragging(false);

      if (flashListRef.current && targetIndex !== currentFlatIndex) {
        // Set target so we don't reset slider until we reach it
        targetIndexRef.current = targetIndex;
        setSliderValue(targetIndex); // Keep slider at target position

        flashListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
        });
      }
    },
    [flashListRef, currentFlatIndex]
  );

  if (totalPages === 0) return null;

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
          maximumValue={Math.max(0, totalPages - 1)}
          value={sliderValue}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor="#fff"
          maximumTrackTintColor="#666"
          thumbTintColor="#fff"
        />
        <Text className="text-white text-sm font-semibold min-w-[32px] text-center">
          {totalPages}
        </Text>
      </View>
    </View>
  );
}
