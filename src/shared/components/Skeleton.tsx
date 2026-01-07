
import React, { useEffect, useRef } from "react";
import { Animated, View, StyleProp, ViewStyle } from "react-native";
import { useCSSVariable } from "uniwind";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * A basic skeleton loader with a pulse animation.
 * Uses standard Animated API for simplicity and compatibility.
 */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
  className,
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const surfaceColor = useCSSVariable("--color-surface");
  const highlightColor = useCSSVariable("--color-border");

  // Fallback colors if variables aren't resolved
  const bg = typeof surfaceColor === "string" ? surfaceColor : "#27272a"; // zinc-800
  const hl = typeof highlightColor === "string" ? highlightColor : "#3f3f46"; // zinc-700

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false, // Color interpolation requires false
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [bg, hl],
  });

  const animatedStyle = {
    width,
    height,
    borderRadius,
    backgroundColor,
  };

  return (
    <Animated.View
      style={[
        animatedStyle as any,
        style,
      ]}
      className={className}
    />
  );
}
