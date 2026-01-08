/**
 * MangaHeader - Displays manga cover, title, author, source, and genres
 * Pure presentational component with no hooks
 */

import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { Source } from "@/sources";

type GenreChipProps = {
  genre: string;
};

function GenreChip({ genre }: GenreChipProps) {
  return (
    <View className="bg-surface px-2.5 py-1 rounded-full border border-border/50">
      <Text className="text-muted text-xs">{genre}</Text>
    </View>
  );
}

export type MangaHeaderProps = {
  title: string;
  author: string;
  cover: string;
  localCover?: string;
  genres: string[];
  sourceName?: string;
  sourceBaseUrl?: string;
  headers?: Record<string, string>;
  isRefreshing?: boolean;
  onDownload?: () => void;
};

export function MangaHeader({
  title,
  author,
  cover,
  localCover,
  genres,
  sourceName,
  sourceBaseUrl,
  headers,
  isRefreshing,
  onDownload,
}: MangaHeaderProps) {
  return (
    <View className="flex-row w-full gap-5">
      {/* Cover Image */}
      <View className="w-[120px] aspect-2/3 rounded-lg bg-surface shadow-md overflow-hidden">
        {localCover ? (
          <Image
            source={{ uri: localCover }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Image
            source={{
              uri: cover,
              headers: headers || {},
            }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            priority="high"
          />
        )}
      </View>

      {/* Right Side Info */}
      <View className="flex-1 pt-1">
        {/* Actions / Status */}
        <View className="absolute top-0 right-0 flex-row gap-2">
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#00d9ff" />
          ) : (
            onDownload && (
              <Pressable
                onPress={onDownload}
                className="bg-surface p-2 rounded-full border border-border/50 active:opacity-70"
              >
                <Ionicons name="download-outline" size={20} color="#00d9ff" />
              </Pressable>
            )
          )}
        </View>

        <Text className="text-foreground text-2xl font-bold leading-tight pr-10">
          {title}
        </Text>

        <Text className="text-primary text-sm font-medium mt-1">
          by {author}
        </Text>

        <Text className="text-muted text-xs mt-0.5">
          {sourceName || "Unknown Source"}
        </Text>

        {/* Genre Chips */}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {genres.map((genre) => (
            <GenreChip key={genre} genre={genre} />
          ))}
        </View>
      </View>
    </View>
  );
}
