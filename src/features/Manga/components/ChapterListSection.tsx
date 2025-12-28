/**
 * ChapterListSection - Displays chapter list with read/unread actions
 * Uses useChapterActions hook for optimistic updates
 */

import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { ChapterCard } from "./ChapterCard";
import { useChapterActions } from "../hooks";
import type { DisplayChapter } from "../hooks/useMangaData";

export type ChapterListSectionProps = {
  chapters: DisplayChapter[];
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  sourceId: string;
  mangaUrl: string;
};

export function ChapterListSection({
  chapters,
  mangaId,
  mangaTitle,
  mangaCover,
  sourceId,
  mangaUrl,
}: ChapterListSectionProps) {
  const router = useRouter();
  const {
    readChapterIds,
    markAsRead,
    markAsUnread,
    markPreviousAsRead,
    markPreviousAsUnread,
  } = useChapterActions(mangaId);

  const handleChapterPress = (chapterId: string, chapterUrl: string) => {
    router.push({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId,
        sourceId,
        url: chapterUrl,
        mangaUrl,
        mangaId,
        mangaTitle,
        mangaCover: mangaCover || "",
      },
    });
  };

  return (
    <>
      {/* Chapter List Header */}
      <View className="bg-surface/50 px-4 py-3 border-t border-b border-border/50">
        <Text className="text-foreground font-bold text-sm">
          {chapters.length} Chapters
        </Text>
      </View>

      {/* Chapters */}
      <View className="pb-4">
        {chapters.map((chapter) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            isRead={readChapterIds.has(chapter.id)}
            onPress={() => handleChapterPress(chapter.id, chapter.url)}
            onMarkAsRead={() => markAsRead(chapter.id)}
            onMarkAsUnread={() => markAsUnread(chapter.id)}
            onMarkPreviousAsRead={() =>
              markPreviousAsRead(chapter.number, chapters)
            }
            onMarkPreviousAsUnread={() =>
              markPreviousAsUnread(chapter.number, chapters)
            }
          />
        ))}
      </View>
    </>
  );
}
