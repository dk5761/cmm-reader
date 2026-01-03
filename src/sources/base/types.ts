// Base types for manga sources

export interface Manga {
  id: string;
  title: string;
  cover: string;
  url: string;
  author?: string;
  artist?: string;
  description?: string;
  genres?: string[];
  status?: "Ongoing" | "Completed" | "Hiatus" | "Unknown";
  sourceId: string;
}

export interface MangaDetails extends Manga {
  alternativeTitles?: string[];
  rating?: number;
  lastUpdated?: string;
}

export interface Chapter {
  id: string;
  mangaId: string;
  number: number;
  title?: string;
  url: string;
  date?: string;
  scanlator?: string;
}

export interface Page {
  index: number;
  imageUrl: string;
  headers?: Record<string, string>; // For referer/auth headers
}

export interface SearchResult {
  manga: Manga[];
  hasNextPage: boolean;
}

// Source configuration
export interface SourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  icon?: string;
  logo?: any; // require() returns number for local images
  language: string;
  nsfw: boolean;
  /**
   * @deprecated No longer needed - CloudflareInterceptor handles CF automatically
   */
  needsCloudflareBypass?: boolean;
}

// Filter types for sources that support filtering
export type PublisherFilter = "all" | "Marvel" | "DC-Comics";
export type SortOption = "" | "MostPopular" | "LatestUpdate" | "Newest";

export interface SourceFilters {
  publisher?: PublisherFilter;
  sort?: SortOption;
}
