/**
 * PageSlider - Slider for page navigation
 * Features:
 * - Syncs with scroll position when not dragging
 * - During drag: shows preview, doesn't scroll
 * - On release: scrolls to target page
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Slider from "@react-native-community/slider";
import { useReaderStore } from "../stores/useReaderStore";
import type { FlashList } from "@shopify/flash-list";
import type { FlatPage } from "../stores/useReaderStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PageSliderProps {
  flashListRef: React.RefObject<FlashList<FlatPage>>;
}

export function PageSlider({ flashListRef }: PageSliderProps) {
  const { flatPages, currentFlatIndex } = useReaderStore();
  const [isDragging, setIsDragging] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);

  const totalPages = flatPages.length;

  // Sync slider with scroll position (only when not dragging)
  useEffect(() => {
    if (!isDragging && totalPages > 0) {
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
      setIsDragging(false);
      const targetIndex = Math.round(value);

      if (flashListRef.current && targetIndex !== currentFlatIndex) {
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
    <View style={styles.container}>
      <View style={styles.sliderRow}>
        <Text style={styles.pageText}>{displayPage}</Text>
        <Slider
          style={styles.slider}
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
        <Text style={styles.pageText}>{totalPages}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  pageText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    minWidth: 32,
    textAlign: "center",
  },
});
