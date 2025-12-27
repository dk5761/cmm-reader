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
 * Download a manga cover to local storage
 */
export async function downloadCover(
  url: string,
  mangaId: string
): Promise<string | null> {
  if (!url) return null;

  try {
    await ensureDirExists();
    const localPath = getLocalCoverPath(mangaId);

    // Download the file
    const result = await FileSystem.downloadAsync(url, localPath);

    if (result.status === 200) {
      console.log("[ImageCache] Downloaded cover:", mangaId);
      return localPath;
    }
    return null;
  } catch (error) {
    console.error("[ImageCache] Failed to download cover:", error);
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
