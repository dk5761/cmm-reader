import { memo } from "react";
import { View, Text, Pressable, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

type MangaCardProps = {
  id: string;
  title: string;
  coverUrl: string;
  onPress?: () => void;
  unreadCount?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MangaCardComponent({
  id,
  title,
  coverUrl,
  onPress,
  unreadCount,
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
      className="w-full rounded-lg overflow-hidden"
      style={[{ aspectRatio: 0.7 }, animatedStyle]}
    >
      <Image
        source={{ uri: coverUrl }}
        className="w-full h-full bg-zinc-800"
        resizeMode="cover"
      />

      {/* Gradient overlay - simulated with stacked views */}
      <View className="absolute bottom-0 left-0 right-0 h-3/5">
        <View className="flex-1 bg-black/10" />
        <View className="flex-1 bg-black/30" />
        <View className="flex-1 bg-black/50" />
        <View className="flex-1 bg-black/70" />
      </View>

      {/* Title */}
      <View className="absolute bottom-0 left-0 right-0 p-2">
        <Text
          className="text-white text-[13px] font-semibold leading-4"
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>

      {/* Unread badge */}
      {unreadCount && unreadCount > 0 && (
        <View className="absolute top-1.5 right-1.5 bg-indigo-500 rounded px-1.5 py-0.5">
          <Text className="text-white text-[11px] font-bold">
            {unreadCount}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export const MangaCard = memo(MangaCardComponent);
