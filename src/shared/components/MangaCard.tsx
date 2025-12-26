import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { WebViewImage } from "./WebViewImage";

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
      className="w-full flex-col gap-2"
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
        {localCoverUrl ? (
          <Image
            source={{ uri: localCoverUrl }}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
            cachePolicy="memory-disk"
          />
        ) : (
          <WebViewImage
            uri={coverUrl}
            baseUrl={baseUrl}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
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
    </Pressable>
  );
}

export const MangaCard = memo(MangaCardComponent);
