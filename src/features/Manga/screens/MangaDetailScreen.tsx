import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";
import { ChapterCard, GenreChip } from "../components";
import { MOCK_MANGA_DETAIL } from "../data/mockData";

export function MangaDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const manga = MOCK_MANGA_DETAIL;

  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const newChaptersCount = manga.chapters.filter((ch) => ch.isNew).length;

  const handleChapterPress = (chapterId: string) => {
    console.log("Chapter pressed:", chapterId);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4"
        style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      >
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={foreground} />
        </Pressable>
        <Pressable className="p-2 -mr-2">
          <Ionicons name="ellipsis-vertical" size={24} color={foreground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Info Section - Centered Layout */}
        <View className="items-start px-4 mb-6">
          <View className="flex-row w-full gap-5">
            {/* Cover Image - Left Side */}
            <Image
              source={{ uri: manga.cover }}
              className="w-[120px] aspect-[2/3] rounded-lg bg-surface shadow-md"
              resizeMode="cover"
            />

            {/* Right Side Info */}
            <View className="flex-1 pt-1">
              <Text className="text-foreground text-2xl font-bold leading-tight">
                {manga.title}
              </Text>
              <Text className="text-primary text-sm font-medium mt-1">
                by {manga.author}
              </Text>

              {/* Genre Chips - Stacked */}
              <View className="flex-row flex-wrap gap-2 mt-3">
                {manga.genres.map((genre) => (
                  <GenreChip key={genre} genre={genre} />
                ))}
              </View>
            </View>
          </View>

          {/* Description */}
          <Text className="text-muted text-xs mt-5 leading-5">
            {manga.description}
          </Text>

          {/* Add to Library Button - Full Width */}
          <Pressable
            className="w-full mt-6 bg-primary rounded-lg py-3 items-center justify-center shadow-lg active:opacity-90"
            onPress={() => console.log("Add to Library")}
          >
            <Text className="text-black font-bold text-xs uppercase tracking-widest">
              Add to Library
            </Text>
          </Pressable>
        </View>

        {/* Chapter List Header */}
        <View className="bg-surface/50 px-4 py-3 border-t border-b border-border/50">
          <Text className="text-foreground font-bold text-sm">
            {newChaptersCount} New Chapter
          </Text>
        </View>

        {/* Chapters */}
        <View className="pb-4">
          {manga.chapters.map((chapter) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              onPress={() => handleChapterPress(chapter.id)}
              onOptions={() => console.log("Options:", chapter.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
