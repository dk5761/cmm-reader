import { useState, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useRouter } from "expo-router";
import {
  useAddToLibrary,
  useRemoveFromLibrary,
  useUpdateReadingStatus,
  useLibraryMangaById,
} from "@/features/Library/hooks";
import { ReadingStatusSheet } from "./ReadingStatusSheet";
import type { MangaDetails, Chapter } from "@/sources";
import type { ReadingStatus } from "@/core/database";

const STATUS_LABELS: Record<ReadingStatus, string> = {
  reading: "Reading",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  plan_to_read: "Plan to Read",
};

export type MangaActionsProps = {
  mangaId: string;
  sourceId: string;
  manga: MangaDetails | null;
  chapters: Chapter[] | null;
  isInLibrary: boolean;
  readingStatus?: ReadingStatus;
};

export function MangaActions({
  mangaId,
  sourceId,
  manga,
  chapters,
  isInLibrary,
  readingStatus = "reading",
}: MangaActionsProps) {
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const router = useRouter();

  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const libraryManga = useLibraryMangaById(mangaId);
  const addToLibrary = useAddToLibrary();
  const removeFromLibrary = useRemoveFromLibrary();
  const updateReadingStatus = useUpdateReadingStatus();

  // Find the chapter to resume or start reading
  const targetChapter = useMemo(() => {
    if (!chapters || chapters.length === 0) return null;

    // 1. Try to find the last read chapter from progress
    if (libraryManga?.progress?.lastChapterId) {
      const found = chapters.find(
        (c) => c.id === libraryManga.progress?.lastChapterId
      );
      if (found) return found;
    }

    // 2. Fallback: return the first chapter (chronologically)
    // Note: chapters are usually Newest -> Oldest, so return last item
    return chapters[chapters.length - 1];
  }, [chapters, libraryManga?.progress?.lastChapterId]);

  const handleRead = () => {
    if (!targetChapter || !manga) return;

    // Determine start page:
    // If we are resuming the last read chapter, use the saved page.
    // Otherwise start from 0.
    const isResuming = libraryManga?.progress?.lastChapterId === targetChapter.id;
    const initialPage = isResuming ? (libraryManga?.progress?.lastPage ?? 0) : 0;

    router.push({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: targetChapter.id,
        sourceId: sourceId,
        url: targetChapter.url,
        mangaUrl: manga.url,
        mangaId: manga.id,
        mangaTitle: manga.title,
        mangaCover: manga.cover,
        chapterNumber: targetChapter.number.toString(),
        chapterTitle: targetChapter.title ?? "",
        initialPage: initialPage.toString(),
      },
    });
  };

  const handleLibraryToggle = () => {
    if (!manga || !chapters) return;

    if (isInLibrary) {
      removeFromLibrary(mangaId);
    } else {
      addToLibrary(manga, chapters, sourceId);
    }
  };

  const handleStatusChange = (status: ReadingStatus) => {
    updateReadingStatus(mangaId, status);
  };

  return (
    <>
      <View className="w-full flex-row gap-3 mt-6">
        {/* Read / Resume Button */}
        <Pressable
          className="flex-1 rounded-lg py-3 bg-primary items-center justify-center shadow-lg active:opacity-90"
          onPress={handleRead}
          disabled={!targetChapter}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name={
                libraryManga?.progress?.lastChapterId ? "play" : "book-outline"
              }
              size={18}
              color="#000"
            />
            <Text className="font-bold text-xs uppercase tracking-widest text-black">
              {libraryManga?.progress?.lastChapterId ? "Resume" : "Read"}
            </Text>
          </View>
        </Pressable>

        {/* Add to Library Button */}
        <Pressable
          className={`flex-1 rounded-lg py-3 items-center justify-center shadow-lg active:opacity-90 ${
            isInLibrary ? "bg-surface border border-primary" : "bg-surface border border-border"
          }`}
          onPress={handleLibraryToggle}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name={isInLibrary ? "checkmark-circle" : "add-circle-outline"}
              size={18}
              color={isInLibrary ? "#00d9ff" : foreground}
            />
            <Text
              className={`font-bold text-xs uppercase tracking-widest ${
                isInLibrary ? "text-primary" : "text-foreground"
              }`}
            >
              {isInLibrary ? "In Library" : "Add"}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Reading Status Button - Only when in library */}
      {isInLibrary && (
        <Pressable
          className="w-full mt-3 rounded-lg py-3 bg-surface border border-border items-center justify-center active:opacity-90"
          onPress={() => setStatusSheetVisible(true)}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="bookmark-outline" size={18} color={foreground} />
            <Text className="text-foreground font-medium">
              {STATUS_LABELS[readingStatus]}
            </Text>
            <Ionicons name="chevron-down" size={16} color={foreground} />
          </View>
        </Pressable>
      )}

      {/* Reading Status Sheet Modal */}
      <ReadingStatusSheet
        visible={statusSheetVisible}
        currentStatus={readingStatus}
        onSelect={handleStatusChange}
        onClose={() => setStatusSheetVisible(false)}
      />
    </>
  );
}
