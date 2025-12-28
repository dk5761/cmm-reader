import FastImage from "react-native-fast-image";

/**
 * Image cache management utilities for react-native-fast-image.
 * Provides functions to clear memory and disk cache.
 */

/**
 * Clear all images from memory cache.
 * Frees up RAM but images will need to be reloaded from disk cache or network.
 */
export async function clearMemoryCache(): Promise<void> {
  try {
    await FastImage.clearMemoryCache();
    console.log("[ImageCache] Memory cache cleared");
  } catch (error) {
    console.error("[ImageCache] Failed to clear memory cache:", error);
    throw error;
  }
}

/**
 * Clear all images from disk cache.
 * Images will need to be re-downloaded from network.
 */
export async function clearDiskCache(): Promise<void> {
  try {
    await FastImage.clearDiskCache();
    console.log("[ImageCache] Disk cache cleared");
  } catch (error) {
    console.error("[ImageCache] Failed to clear disk cache:", error);
    throw error;
  }
}

/**
 * Clear both memory and disk cache.
 * Complete cache reset - all images will need to be re-downloaded.
 */
export async function clearAllCache(): Promise<void> {
  try {
    await Promise.all([
      FastImage.clearMemoryCache(),
      FastImage.clearDiskCache(),
    ]);
    console.log("[ImageCache] All caches cleared");
  } catch (error) {
    console.error("[ImageCache] Failed to clear caches:", error);
    throw error;
  }
}

/**
 * Preload images for better reading experience.
 * Images will be cached and ready when needed.
 *
 * @param uris - Array of image URIs or source objects with headers
 */
export function preloadImages(
  sources: Array<{
    uri: string;
    headers?: Record<string, string>;
    priority?: "low" | "normal" | "high";
  }>
): void {
  const fastImageSources = sources.map((source) => ({
    uri: source.uri,
    headers: source.headers,
    priority:
      source.priority === "high"
        ? FastImage.priority.high
        : source.priority === "low"
        ? FastImage.priority.low
        : FastImage.priority.normal,
  }));

  FastImage.preload(fastImageSources);
}
