import { useCallback, useMemo } from "react";
import { useRealm, useQuery } from "@realm/react";
import { ReadingHistorySchema } from "@/core/database";

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
