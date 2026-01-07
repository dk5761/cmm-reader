import React from "react";
import { RealmProvider as BaseRealmProvider } from "@realm/react";
import { realmSchemas } from "./schema";

type DatabaseProviderProps = {
  children: React.ReactNode;
};

/**
 * Database provider wrapping the app with Realm context
 * All components can use useRealm, useQuery, useObject hooks
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  return (
    <BaseRealmProvider
      schema={realmSchemas}
      schemaVersion={7}
      onMigration={(oldRealm, newRealm) => {
        // Migration from version 1 to 2: added localCover property
        // Migration from version 2 to 3: added ReadingHistorySchema
        // Migration from version 3 to 4: added mangaUrl to ReadingHistorySchema
        // Migration from version 4 to 5: added inLibrary to MangaSchema
        // Migration from version 5 to 6: added categories to MangaSchema and CategorySchema
        // Migration from version 6 to 7: added download fields to ChapterSchema

        if (oldRealm.schemaVersion < 5) {
          const oldManga = newRealm.objects("Manga");
          oldManga.forEach((manga: any) => {
            manga.inLibrary = true;
          });
        }

        if (oldRealm.schemaVersion < 6) {
          const manga = newRealm.objects("Manga");
          manga.forEach((m: any) => {
            if (!m.categories) {
              m.categories = [];
            }
          });
        }

        if (oldRealm.schemaVersion < 7) {
          const mangaList = newRealm.objects("Manga");
          let chapterCount = 0;
          
          mangaList.forEach((manga: any) => {
            if (manga.chapters) {
              manga.chapters.forEach((chapter: any) => {
                chapter.downloadStatus = 0;
                chapter.downloadTotal = 0;
                chapter.downloadedCount = 0;
                chapterCount++;
              });
            }
          });
          
          console.log(`[Migration] Initialized download fields for ${chapterCount} chapters`);
        }

        // Backfill null lastUpdated values (runs on every migration)
        const mangaWithNullLastUpdated = newRealm
          .objects("Manga")
          .filtered("lastUpdated == null OR lastUpdated == 0");

        mangaWithNullLastUpdated.forEach((manga: any) => {
          manga.lastUpdated = manga.addedAt || Date.now();
        });

        if (mangaWithNullLastUpdated.length > 0) {
          console.log(
            "[Migration] Backfilled lastUpdated for",
            mangaWithNullLastUpdated.length,
            "manga"
          );
        }
      }}
    >
      {children}
    </BaseRealmProvider>
  );
}
