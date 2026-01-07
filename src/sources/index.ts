import { MangaKakalotSource } from "./mangakakalot";
import { AsuraScansSource } from "./asurascans";
import { Manhwa18NetSource } from "./manhwa18";
import { ReadComicOnlineSource } from "./readcomiconline";
import { MangaKatanaSource } from "./mangakatana";
import type { Source } from "./base";

// Source instances
const mangakakalot = new MangaKakalotSource();
const asurascans = new AsuraScansSource();
const manhwa18net = new Manhwa18NetSource();
const readcomiconline = new ReadComicOnlineSource();
const mangakatana = new MangaKatanaSource();

// Source registry - add new sources here
export const SOURCES: Record<string, Source> = {
  mangakakalot,
  asurascans,
  manhwa18net,
  readcomiconline,
  mangakatana,
} as const;

// Helper to get source by ID
export function getSource(id: string): Source | undefined {
  return SOURCES[id];
}

// Check if a source is NSFW by ID
export function isNsfwSource(sourceId: string): boolean {
  const source = getSource(sourceId);
  return source?.config.nsfw ?? false;
}

// Get all available sources (no filtering)
export function getAllSources(): Source[] {
  return Object.values(SOURCES);
}

/**
 * Get available sources based on NSFW preference
 * @param showNsfw - Whether to include NSFW sources
 * @returns Filtered array of sources
 */
export function getAvailableSources(showNsfw: boolean): Source[] {
  const allSources = getAllSources();
  if (showNsfw) {
    return allSources;
  }
  return allSources.filter((source) => !source.config.nsfw);
}

// Re-export types
export * from "./base/types";
export { Source } from "./base/Source";
