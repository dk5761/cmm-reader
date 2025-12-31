import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

type MangaCardProps = {
  id: string;
  title: string;
  coverUrl: string;
  localCoverUrl?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  onPress?: () => void;
  badge?: string;
  progress?: number;
  subtitle?: string;
};

function MangaCardComponent({
  id,
  title,
  coverUrl,
  localCoverUrl,
  baseUrl = "https://www.mangakakalot.gg",
  headers,
  onPress,
  badge,
  progress,
  subtitle,
}: MangaCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full"
      android_ripple={{
        color: "rgba(255, 255, 255, 0.2)",
        borderless: false,
        foreground: true,
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {/* Cover Image Container */}
      <View className="relative w-full aspect-2/3 rounded-xl overflow-hidden bg-zinc-800">
        {/* Cover Image */}
        {localCoverUrl ? (
          <Image
            key={`${id}-local`}
            source={{ uri: localCoverUrl }}
            style={{ width: "100%", height: "100%", borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          <Image
            key={`${id}-remote`}
            source={{
              uri: coverUrl,
              headers: headers || {},
            }}
            style={{ width: "100%", height: "100%", borderRadius: 8 }}
            contentFit="cover"
          />
        )}

        {/* Badge - Top Left */}
        {badge && (
          <View
            className={`absolute top-2 left-2 px-2 py-1 rounded-md ${
              badge.includes("NEW") ? "bg-primary" : "bg-green-500"
            }`}
          >
            <Text className="text-[10px] font-bold text-white uppercase tracking-wider">
              {badge}
            </Text>
          </View>
        )}

        {/* Title Overlay - Bottom with Gradient */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.95)"]}
          locations={[0, 0.5, 1]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 12,
            paddingTop: 32,
            paddingBottom: 12,
          }}
        >
          <Text
            className="text-white text-sm font-bold leading-tight"
            numberOfLines={2}
          >
            {title}
          </Text>

          {subtitle && (
            <Text className="text-zinc-400 text-xs mt-1" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export const MangaCard = memo(
  MangaCardComponent,
  (prev, next) =>
    prev.id === next.id &&
    prev.coverUrl === next.coverUrl &&
    prev.localCoverUrl === next.localCoverUrl &&
    prev.badge === next.badge &&
    prev.progress === next.progress &&
    prev.subtitle === next.subtitle
);
