import { useEffect, useRef } from "react";
import { useRealm } from "@realm/react";
import { MangaSchema } from "@/core/database/schema";
import { downloadCover } from "@/core/services/ImageCacheService";

const downloadingSet = new Set<string>();

export function useLazyCover(
  mangaId: string,
  coverUrl?: string,
  localCoverUrl?: string
): string | undefined {
  const realm = useRealm();
  const hasTriedDownload = useRef(false);

  useEffect(() => {
    if (
      localCoverUrl ||
      !coverUrl ||
      hasTriedDownload.current ||
      downloadingSet.has(mangaId)
    ) {
      return;
    }

    hasTriedDownload.current = true;
    downloadingSet.add(mangaId);

    downloadCover(coverUrl, mangaId)
      .then((localPath) => {
        if (localPath) {
          const manga = realm.objectForPrimaryKey(MangaSchema, mangaId);
          if (manga) {
            realm.write(() => {
              manga.localCover = localPath;
            });
          }
        }
      })
      .catch((error) => {
        console.error("[useLazyCover] Failed to download:", mangaId, error);
      })
      .finally(() => {
        downloadingSet.delete(mangaId);
      });
  }, [mangaId, coverUrl, localCoverUrl, realm]);

  return localCoverUrl || coverUrl;
}
