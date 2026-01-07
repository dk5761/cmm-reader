import * as FileSystem from "expo-file-system/legacy";

// @ts-ignore - documentDirectory exists at runtime in Expo FileSystem
const COVERS_DIR = `${FileSystem.documentDirectory}covers/`;

/**
 * Ensure the covers directory exists
 */
async function ensureDirExists() {
  const dirInfo = await FileSystem.getInfoAsync(COVERS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });
  }
}

/**
 * Get the local path for a manga cover
 */
export function getLocalCoverPath(mangaId: string): string {
  // Sanitize mangaId for use as filename
  const safeId = mangaId.replace(/[^a-z0-9_-]/gi, "_");
  return `${COVERS_DIR}${safeId}.jpg`;
}

/**
 * Download a manga cover to local storage with optional headers
 */
export async function downloadCover(
  url: string,
  mangaId: string,
  headers?: Record<string, string>
): Promise<string | null> {
  if (!url) return null;

  try {
    await ensureDirExists();
    const localPath = getLocalCoverPath(mangaId);

    // Download the file with headers if provided
    const downloadOptions: FileSystem.DownloadOptions = {};
    if (headers && Object.keys(headers).length > 0) {
      downloadOptions.headers = headers;
    }

    const result = await FileSystem.downloadAsync(url, localPath, downloadOptions);

    if (result.status === 200) {
      console.log("[ImageCache] Downloaded cover:", mangaId);
      return localPath;
    }

    console.warn("[ImageCache] Download failed with status:", result.status, mangaId);
    return null;
  } catch (error) {
    console.error("[ImageCache] Failed to download cover:", mangaId, error);
    return null;
  }
}

/**
 * Delete a local manga cover
 */
export async function deleteCover(mangaId: string): Promise<void> {
  try {
    const localPath = getLocalCoverPath(mangaId);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath);
      console.log("[ImageCache] Deleted cover:", mangaId);
    }
  } catch (error) {
    console.error("[ImageCache] Failed to delete cover:", error);
  }
}

/**
 * Get total cache size in bytes
 */
export async function getCacheSize(): Promise<number> {
  try {
    await ensureDirExists();
    const files = await FileSystem.readDirectoryAsync(COVERS_DIR);
    let totalSize = 0;

    for (const file of files) {
      const info = await FileSystem.getInfoAsync(COVERS_DIR + file);
      if (info.exists) {
        totalSize += info.size;
      }
    }
    return totalSize;
  } catch (error) {
    console.error("[ImageCache] Failed to calculate cache size:", error);
    return 0;
  }
}

/**
 * Prune cache to keep it under maxSizeMB (LRU eviction)
 * @param maxSizeMB Max size in Megabytes (default 500MB)
 */
export async function pruneCache(maxSizeMB: number = 500): Promise<void> {
  try {
    await ensureDirExists();
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    let currentSize = await getCacheSize();

    if (currentSize <= maxSizeBytes) {
      console.log("[ImageCache] Cache size OK:", (currentSize / 1024 / 1024).toFixed(2), "MB");
      return;
    }

    console.log("[ImageCache] Pruning cache. Current:", (currentSize / 1024 / 1024).toFixed(2), "MB");

    // Get all files with info
    const files = await FileSystem.readDirectoryAsync(COVERS_DIR);
    const fileInfos = await Promise.all(
      files.map(async (file) => {
        const path = COVERS_DIR + file;
        const info = await FileSystem.getInfoAsync(path);
        return {
          path,
          size: info.exists ? info.size : 0,
          modificationTime: info.exists ? info.modificationTime : 0,
        };
      })
    );

    // Sort by modification time (oldest first)
    // Note: expo-file-system modificationTime is a unix timestamp (seconds or ms depending on platform)
    fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);

    // Delete files until under limit
    for (const file of fileInfos) {
      if (currentSize <= maxSizeBytes) break;

      await FileSystem.deleteAsync(file.path, { idempotent: true });
      currentSize -= file.size;
      console.log("[ImageCache] Pruned:", file.path);
    }

    console.log("[ImageCache] Prune complete. New size:", (currentSize / 1024 / 1024).toFixed(2), "MB");
  } catch (error) {
    console.error("[ImageCache] Failed to prune cache:", error);
  }
}
