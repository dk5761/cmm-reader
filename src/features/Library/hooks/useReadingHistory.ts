import { useCallback, useMemo } from "react";
import { useRealm, useQuery } from "@realm/react";
import { ReadingHistorySchema } from "@/core/database";
import { isNsfwSource } from "@/sources";

type HistoryEntry = {
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  mangaUrl?: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  chapterUrl: string;
  pageReached: number;
  totalPages?: number;
  sourceId: string;
};

/**
 * Add or update a reading history entry
 * Updates existing entry for same manga+chapter instead of creating duplicate
 */
export function useAddHistoryEntry() {
  const realm = useRealm();

  return useCallback(
    (entry: HistoryEntry) => {
      realm.write(() => {
        // Remove existing entry for same chapter (update instead of duplicate)
        const existing = realm
          .objects(ReadingHistorySchema)
          .filtered(
            "mangaId == $0 AND chapterId == $1",
            entry.mangaId,
            entry.chapterId
          );
        realm.delete(existing);

        // Create new entry with current timestamp
        realm.create(ReadingHistorySchema, {
          id: `${Date.now()}_${entry.chapterId}`,
          ...entry,
          timestamp: Date.now(),
        });
      });
    },
    [realm]
  );
}

/**
 * Get reading history sorted by timestamp (most recent first)
 */
export function useReadingHistory(limit: number = 100) {
  const history = useQuery(ReadingHistorySchema);

  return useMemo(() => {
    return [...history.sorted("timestamp", true)].slice(0, limit);
  }, [history, limit]);
}

/**
 * Get history grouped by date for display
 */
export function useGroupedHistory() {
  const history = useReadingHistory(100);

  return useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const thisWeek = new Date(today.getTime() - 7 * 86400000);

    const groups: {
      title: string;
      data: typeof history;
    }[] = [];

    const todayItems: typeof history = [];
    const yesterdayItems: typeof history = [];
    const thisWeekItems: typeof history = [];
    const olderItems: typeof history = [];

    history.forEach((item) => {
      const itemDate = new Date(item.timestamp);
      if (itemDate >= today) {
        todayItems.push(item);
      } else if (itemDate >= yesterday) {
        yesterdayItems.push(item);
      } else if (itemDate >= thisWeek) {
        thisWeekItems.push(item);
      } else {
        olderItems.push(item);
      }
    });

    if (todayItems.length > 0)
      groups.push({ title: "Today", data: todayItems });
    if (yesterdayItems.length > 0)
      groups.push({ title: "Yesterday", data: yesterdayItems });
    if (thisWeekItems.length > 0)
      groups.push({ title: "This Week", data: thisWeekItems });
    if (olderItems.length > 0)
      groups.push({ title: "Older", data: olderItems });

    return groups;
  }, [history]);
}

type GroupedMangaHistory = {
  uniqueKey: string;
  sourceId: string;
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  mangaUrl?: string;
  latestChapterNumber: number;
  latestChapterTitle?: string;
  latestTimestamp: number;
  chaptersReadCount: number;
  latestPageReached: number;
  latestTotalPages?: number;
};

/**
 * Get history grouped by manga (sourceId + mangaId)
 * Each manga from a specific source appears once with latest read info
 * @param showNsfw - Whether to include NSFW sources (default: true)
 */
export function useGroupedMangaHistory(showNsfw: boolean = true) {
  const history = useReadingHistory(500);

  return useMemo(() => {
    const groupedMap = new Map<string, GroupedMangaHistory>();

    history.forEach((item) => {
      const uniqueKey = `${item.sourceId}_${item.mangaId}`;
      const existing = groupedMap.get(uniqueKey);

      if (!existing || item.timestamp > existing.latestTimestamp) {
        const chaptersRead = history.filter(
          (h) => h.sourceId === item.sourceId && h.mangaId === item.mangaId
        ).length;

        groupedMap.set(uniqueKey, {
          uniqueKey,
          sourceId: item.sourceId,
          mangaId: item.mangaId,
          mangaTitle: item.mangaTitle,
          mangaCover: item.mangaCover,
          mangaUrl: item.mangaUrl,
          latestChapterNumber: item.chapterNumber,
          latestChapterTitle: item.chapterTitle,
          latestTimestamp: item.timestamp,
          chaptersReadCount: chaptersRead,
          latestPageReached: item.pageReached,
          latestTotalPages: item.totalPages,
        });
      }
    });

    let result = Array.from(groupedMap.values()).sort(
      (a, b) => b.latestTimestamp - a.latestTimestamp
    );

    // Filter NSFW sources if toggle is off
    if (!showNsfw) {
      result = result.filter((manga) => !isNsfwSource(manga.sourceId));
    }

    return result;
  }, [history, showNsfw]);
}

/**
 * Get all history entries for a specific manga from a specific source
 */
export function useMangaHistoryDetails(sourceId: string, mangaId: string) {
  const history = useReadingHistory(500);

  return useMemo(() => {
    return history
      .filter((item) => item.sourceId === sourceId && item.mangaId === mangaId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [history, sourceId, mangaId]);
}

/**
 * Remove all history entries for a specific manga from a specific source
 */
export function useRemoveMangaHistory() {
  const realm = useRealm();

  return useCallback(
    (sourceId: string, mangaId: string) => {
      realm.write(() => {
        const entries = realm
          .objects(ReadingHistorySchema)
          .filtered("sourceId == $0 AND mangaId == $1", sourceId, mangaId);
        realm.delete(entries);
      });
    },
    [realm]
  );
}

/**
 * Remove a specific history entry
 */
export function useRemoveHistoryEntry() {
  const realm = useRealm();

  return useCallback(
    (id: string) => {
      realm.write(() => {
        const entry = realm.objectForPrimaryKey(ReadingHistorySchema, id);
        if (entry) {
          realm.delete(entry);
        }
      });
    },
    [realm]
  );
}

/**
 * Clear all reading history
 */
export function useClearHistory() {
  const realm = useRealm();

  return useCallback(() => {
    realm.write(() => {
      realm.delete(realm.objects(ReadingHistorySchema));
    });
  }, [realm]);
}
