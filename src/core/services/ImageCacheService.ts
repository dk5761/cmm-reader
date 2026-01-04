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
