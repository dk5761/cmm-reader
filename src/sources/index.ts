import { MangaKakalotSource } from "./mangakakalot";
import { KissMangaSource } from "./kissmanga";
import { AsuraScansSource } from "./asurascans";
import { Manhwa18NetSource } from "./manhwa18";
import type { Source } from "./base";

// Source instances
const mangakakalot = new MangaKakalotSource();
const kissmanga = new KissMangaSource();
const asurascans = new AsuraScansSource();
const manhwa18net = new Manhwa18NetSource();

// Source registry - add new sources here
export const SOURCES: Record<string, Source> = {
  mangakakalot,
  kissmanga,
  asurascans,
  manhwa18net,
} as const;

// Helper to get source by ID
export function getSource(id: string): Source | undefined {
  return SOURCES[id];
}

// Get all available sources
export function getAllSources(): Source[] {
  return Object.values(SOURCES);
}

// Re-export types
export * from "./base/types";
export { Source } from "./base/Source";
