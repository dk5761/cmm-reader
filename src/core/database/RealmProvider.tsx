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
      schemaVersion={6}
      onMigration={(oldRealm, newRealm) => {
        // Migration from version 1 to 2: added localCover property
        // Migration from version 2 to 3: added ReadingHistorySchema
        // Migration from version 3 to 4: added mangaUrl to ReadingHistorySchema
        // Migration from version 4 to 5: added inLibrary to MangaSchema
        // Migration from version 5 to 6: added categories to MangaSchema and CategorySchema

        if (oldRealm.schemaVersion < 5) {
          const oldManga = newRealm.objects("Manga");
          oldManga.forEach((manga: any) => {
            // Set all existing manga to inLibrary = true
            // (they were in library before this field existed)
            manga.inLibrary = true;
          });
          console.log(
            "[Migration] Set inLibrary=true for",
            oldManga.length,
            "existing manga"
          );
        }

        if (oldRealm.schemaVersion < 6) {
          const manga = newRealm.objects("Manga");
          manga.forEach((m: any) => {
            if (!m.categories) {
              m.categories = [];
            }
          });
          console.log(
            "[Migration] Initialized categories for",
            manga.length,
            "existing manga"
          );
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
