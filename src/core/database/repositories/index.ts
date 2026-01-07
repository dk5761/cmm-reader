import { useRealm } from "@realm/react";
import { useMemo } from "react";
import { RealmMangaRepository } from "./MangaRepository";
import { RealmChapterRepository } from "./ChapterRepository";
import { RealmHistoryRepository } from "./HistoryRepository";
import { RealmCategoryRepository } from "./CategoryRepository";

export function useRepositories() {
  const realm = useRealm();

  return useMemo(() => ({
    manga: new RealmMangaRepository(realm),
    chapter: new RealmChapterRepository(realm),
    history: new RealmHistoryRepository(realm),
    category: new RealmCategoryRepository(realm),
  }), [realm]);
}
