/**
 * useChapterActions - Handles chapter read/unread operations with optimistic UI
 */

import { useState, useMemo, useCallback } from "react";
import { useLibraryMangaById } from "@/features/Library/hooks";
import {
  useMarkChapterRead,
  useMarkChapterUnread,
  useMarkPreviousAsRead,
} from "@/features/Library/hooks";

export function useChapterActions(mangaId: string) {
  const libraryManga = useLibraryMangaById(mangaId);

  // Mutation hooks
  const markChapterRead = useMarkChapterRead();
  const markChapterUnread = useMarkChapterUnread();
  const markPreviousAsReadMutation = useMarkPreviousAsRead();

  // Optimistic state for immediate UI updates
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(
    new Set()
  );
  const [optimisticUnreadIds, setOptimisticUnreadIds] = useState<Set<string>>(
    new Set()
  );

  // Combine Realm data with optimistic updates
  const readChapterIds = useMemo(() => {
    const realmReadIds = new Set(
      libraryManga?.chapters?.filter((ch) => ch.isRead)?.map((ch) => ch.id) ||
        []
    );
    // Add optimistic reads, remove optimistic unreads
    optimisticReadIds.forEach((id) => realmReadIds.add(id));
    optimisticUnreadIds.forEach((id) => realmReadIds.delete(id));
    return realmReadIds;
  }, [libraryManga?.chapters, optimisticReadIds, optimisticUnreadIds]);

  // Mark single chapter as read
  const markAsRead = useCallback(
    (chapterId: string) => {
      // Optimistic update
      setOptimisticReadIds((prev) => new Set(prev).add(chapterId));
      setOptimisticUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
      // Background DB update
      setTimeout(() => markChapterRead(mangaId, chapterId), 0);
    },
    [mangaId, markChapterRead]
  );

  // Mark single chapter as unread
  const markAsUnread = useCallback(
    (chapterId: string) => {
      // Optimistic update
      setOptimisticUnreadIds((prev) => new Set(prev).add(chapterId));
      setOptimisticReadIds((prev) => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
      // Background DB update
      setTimeout(() => markChapterUnread(mangaId, chapterId), 0);
    },
    [mangaId, markChapterUnread]
  );

  // Mark all chapters up to a point as read
  const markPreviousAsRead = useCallback(
    (chapterNumber: number, chapters: { id: string; number: number }[]) => {
      // Optimistic update - mark all chapters with number < chapterNumber (NOT <=)
      const idsToMark = chapters
        .filter((ch) => ch.number < chapterNumber)
        .map((ch) => ch.id);

      setOptimisticReadIds((prev) => {
        const next = new Set(prev);
        idsToMark.forEach((id) => next.add(id));
        return next;
      });
      setOptimisticUnreadIds((prev) => {
        const next = new Set(prev);
        idsToMark.forEach((id) => next.delete(id));
        return next;
      });

      // Background DB update
      setTimeout(() => markPreviousAsReadMutation(mangaId, chapterNumber), 0);
    },
    [mangaId, markPreviousAsReadMutation]
  );

  // Mark all chapters up to a point as unread
  const markPreviousAsUnread = useCallback(
    (chapterNumber: number, chapters: { id: string; number: number }[]) => {
      // Optimistic update - mark all chapters with number < chapterNumber (NOT <=)
      const idsToMark = chapters
        .filter((ch) => ch.number < chapterNumber)
        .map((ch) => ch.id);

      setOptimisticUnreadIds((prev) => {
        const next = new Set(prev);
        idsToMark.forEach((id) => next.add(id));
        return next;
      });
      setOptimisticReadIds((prev) => {
        const next = new Set(prev);
        idsToMark.forEach((id) => next.delete(id));
        return next;
      });

      // We don't have markPreviousUnread - just mark each individually
      // This is handled in the component if needed
    },
    []
  );

  return {
    readChapterIds,
    markAsRead,
    markAsUnread,
    markPreviousAsRead,
    markPreviousAsUnread,
    isInLibrary: !!libraryManga,
  };
}
