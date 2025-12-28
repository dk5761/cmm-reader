/**
 * MangaHeader - Displays manga cover, title, author, source, and genres
 * Pure presentational component with no hooks
 */

import { View, Text, ActivityIndicator } from "react-native";
import FastImage from "react-native-fast-image";
import { WebViewImage } from "@/shared/components";
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
  isRefreshing?: boolean;
};

export function MangaHeader({
  title,
  author,
  cover,
  localCover,
  genres,
  sourceName,
  sourceBaseUrl,
  isRefreshing,
}: MangaHeaderProps) {
  return (
    <View className="flex-row w-full gap-5">
      {/* Cover Image */}
      <View className="w-[120px] aspect-2/3 rounded-lg bg-surface shadow-md overflow-hidden">
        {localCover ? (
          <FastImage
            source={{ uri: localCover }}
            style={{ width: "100%", height: "100%" }}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <WebViewImage
            uri={cover}
            baseUrl={sourceBaseUrl}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </View>

      {/* Right Side Info */}
      <View className="flex-1 pt-1">
        {/* Refreshing indicator */}
        {isRefreshing && (
          <View className="absolute top-0 right-0">
            <ActivityIndicator size="small" color="#00d9ff" />
          </View>
        )}

        <Text className="text-foreground text-2xl font-bold leading-tight">
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
