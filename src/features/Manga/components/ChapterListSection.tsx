/**
 * ChapterListSection - Displays chapter list with read/unread actions
 * Uses deferred rendering and batching for performance with large chapter lists
 */

import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { View, Text, InteractionManager } from "react-native";
import { useRouter } from "expo-router";
import { ChapterCard } from "./ChapterCard";
import { useChapterActions } from "../hooks";
import { useLibraryMangaById } from "@/features/Library/hooks";
import type { DisplayChapter } from "../hooks/useMangaData";

export type ChapterListSectionProps = {
  chapters: DisplayChapter[];
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  sourceId: string;
  mangaUrl: string;
};

// Memoized chapter card to prevent unnecessary re-renders
const MemoizedChapterCard = memo(ChapterCard);

// Number of chapters to render per batch
const BATCH_SIZE = 20;

export function ChapterListSection({
  chapters,
  mangaId,
  mangaTitle,
  mangaCover,
  sourceId,
  mangaUrl,
}: ChapterListSectionProps) {
  const router = useRouter();
  const libraryManga = useLibraryMangaById(mangaId);
  const {
    readChapterIds,
    markAsRead,
    markAsUnread,
    markPreviousAsRead,
    markPreviousAsUnread,
  } = useChapterActions(mangaId);

  // Map of chapterId to lastPageRead
  const chapterProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    libraryManga?.chapters?.forEach((ch) => {
      if (ch.lastPageRead > 0) {
        map.set(ch.id, ch.lastPageRead);
      }
    });
    return map;
  }, [libraryManga?.chapters]);

  // Progressive rendering: start with 0 chapters, then load in batches
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    // Wait for screen transition to complete before rendering chapters
    const handle = InteractionManager.runAfterInteractions(() => {
      // Render first batch immediately after transition
      setVisibleCount(BATCH_SIZE);
    });

    return () => handle.cancel();
  }, []);

  // Progressive loading: render more chapters in batches
  useEffect(() => {
    if (visibleCount > 0 && visibleCount < chapters.length) {
      const timer = setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, chapters.length));
      }, 50); // Small delay between batches to keep UI responsive
      return () => clearTimeout(timer);
    }
  }, [visibleCount, chapters.length]);

  const handleChapterPress = useCallback(
    (
      chapterId: string,
      chapterUrl: string,
      chapterNumber: number,
      chapterTitle?: string
    ) => {
      // [DEBUG] Log navigation params
      console.log("[DEBUG ChapterListSection] Navigating to reader:", {
        chapterId,
        sourceId,
        url: chapterUrl,
        mangaId,
        hasAllParams: !!(chapterId && sourceId && chapterUrl),
      });

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
          chapterNumber: chapterNumber.toString(),
          chapterTitle: chapterTitle || "",
        },
      });
    },
    [router, sourceId, mangaUrl, mangaId, mangaTitle, mangaCover]
  );

  // Slice chapters to only render visible ones
  const visibleChapters = chapters.slice(0, visibleCount);

  return (
    <>
      {/* Chapter List Header */}
      <View className="bg-surface/50 px-4 py-3 border-t border-b border-border/50">
        <Text className="text-foreground font-bold text-sm">
          {chapters.length} Chapters
        </Text>
      </View>

      {/* Chapters - Progressively rendered */}
      <View className="pb-4">
        {visibleChapters.map((chapter) => (
          <MemoizedChapterCard
            key={chapter.id}
            chapter={chapter}
            isRead={readChapterIds.has(chapter.id)}
            lastPage={chapterProgressMap.get(chapter.id)}
            onPress={() =>
              handleChapterPress(
                chapter.id,
                chapter.url,
                chapter.number,
                chapter.title
              )
            }
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

        {/* Loading indicator for remaining chapters */}
        {visibleCount < chapters.length && (
          <View className="py-4 items-center">
            <Text className="text-muted text-xs">
              Loading chapters... ({visibleCount}/{chapters.length})
            </Text>
          </View>
        )}
      </View>
    </>
  );
}
