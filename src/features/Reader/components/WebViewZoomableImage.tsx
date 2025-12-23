import { memo, useState, useCallback } from "react";
import { Dimensions, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { WebViewImage } from "@/shared/components";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type WebViewZoomableImageProps = {
  uri: string;
  baseUrl?: string;
  width?: number;
  initialHeight?: number;
  onTap?: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function WebViewZoomableImageComponent({
  uri,
  baseUrl,
  width = SCREEN_WIDTH,
  initialHeight = SCREEN_WIDTH * 1.5,
  onTap,
}: WebViewZoomableImageProps) {
  // Use fixed height to prevent content shifting
  const height = initialHeight;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const [isZoomed, setIsZoomed] = useState(false);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        scale.value = withTiming(1, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        runOnJS(setIsZoomed)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(setIsZoomed)(true);
      }
    });

  // Pan gesture for moving when zoomed
  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxTranslateX = ((scale.value - 1) * width) / 2;
      const maxTranslateY = ((scale.value - 1) * height) / 2;

      translateX.value = Math.min(
        maxTranslateX,
        Math.max(-maxTranslateX, savedTranslateX.value + event.translationX)
      );
      translateY.value = Math.min(
        maxTranslateY,
        Math.max(-maxTranslateY, savedTranslateY.value + event.translationY)
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to zoom in/out
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withTiming(1, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        runOnJS(setIsZoomed)(false);
      } else {
        // Zoom in to 2x at tap point
        scale.value = withTiming(2, { duration: 200 });
        runOnJS(setIsZoomed)(true);
      }
    });

  // Single tap for controls toggle
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onTap) {
        runOnJS(onTap)();
      }
    });

  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    singleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <WebViewImage
          uri={uri}
          baseUrl={baseUrl}
          resizeMode="contain"
          style={{ width, height }}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export const WebViewZoomableImage = memo(WebViewZoomableImageComponent);
