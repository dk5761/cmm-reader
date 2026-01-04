import { useEffect, useRef } from "react";
import { useRealm } from "@realm/react";
import { MangaSchema } from "@/core/database/schema";
import { downloadCover } from "@/core/services/ImageCacheService";
import { getSourceHeaders } from "@/core/services/getSourceHeaders";

const downloadingSet = new Set<string>();

/**
 * Hook for lazy-loading manga covers.
 * If localCover is missing but remote cover exists, downloads it in background.
 * Returns the best available cover URL to display.
 *
 * @param mangaId - The manga ID
 * @param coverUrl - Remote cover URL
 * @param localCoverUrl - Local cover path (if already downloaded)
 * @param sourceId - Source ID for getting appropriate headers
 */
export function useLazyCover(
  mangaId: string,
  coverUrl?: string,
  localCoverUrl?: string,
  sourceId?: string
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

    // Get headers for this source
    const headers = sourceId ? getSourceHeaders(sourceId) : undefined;

    downloadCover(coverUrl, mangaId, headers)
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
  }, [mangaId, coverUrl, localCoverUrl, sourceId, realm]);

  return localCoverUrl || coverUrl;
}
