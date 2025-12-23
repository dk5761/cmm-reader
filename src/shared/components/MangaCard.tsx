import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { WebViewImage } from "./WebViewImage";

type MangaCardProps = {
  id: string;
  title: string;
  coverUrl: string;
  baseUrl?: string; // Source base URL for setting origin
  headers?: Record<string, string>;
  onPress?: () => void;
  badge?: string;
  progress?: number;
  subtitle?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MangaCardComponent({
  id,
  title,
  coverUrl,
  baseUrl = "https://www.mangakakalot.gg",
  headers,
  onPress,
  badge,
  progress,
  subtitle,
}: MangaCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className="w-full flex-col gap-2"
      style={[animatedStyle]}
    >
      {/* Cover Image Container */}
      <View className="relative w-full aspect-2/3 rounded-xl overflow-hidden bg-zinc-800">
        <WebViewImage
          uri={coverUrl}
          baseUrl={baseUrl}
          style={{ width: "100%", height: "100%" }}
        />

        {/* Badge - Top Left */}
        {badge && (
          <View className="absolute top-2 left-2 px-2 py-1 bg-green-500 rounded-md">
            <Text className="text-[10px] font-bold text-white uppercase tracking-wider">
              {badge}
            </Text>
          </View>
        )}
      </View>

      {/* Info Section */}
      <View className="flex-col gap-1">
        <Text
          className="text-white text-sm font-bold leading-tight"
          numberOfLines={1}
        >
          {title}
        </Text>

        {subtitle && (
          <Text className="text-muted text-xs" numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {progress !== undefined && progress >= 0 && (
          <View className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden mt-1">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

export const MangaCard = memo(MangaCardComponent);
