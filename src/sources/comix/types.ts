/**
 * Comix API Type Definitions
 * Based on Mihon extension ComixDTO.kt
 */

export interface Term {
  term_id: number;
  type: string;
  title: string;
  slug: string;
  count?: number;
}

export interface Poster {
  small: string;
  medium: string;
  large: string;
}

export interface ComixManga {
  hash_id: string;
  title: string;
  alt_titles: string[];
  synopsis?: string;
  type: string; // manga/manhwa/manhua
  poster: Poster;
  status: string; // releasing/on_hiatus/finished/discontinued
  is_nsfw: boolean;
  author?: Term[];
  artist?: Term[];
  genre?: Term[];
  theme?: Term[];
  demographic?: Term[];
  rated_avg?: number; // 0-10 rating
}

export interface Pagination {
  current_page: number;
  last_page: number;
}

export interface SearchResponse {
  result: {
    items: ComixManga[];
    pagination: Pagination;
  };
}

export interface SingleMangaResponse {
  result: ComixManga;
}

export interface ScanlationGroup {
  name: string;
}

export interface ComixChapter {
  chapter_id: number;
  scanlation_group_id: number;
  number: number; // Can be decimal like 12.5
  name: string;
  votes: number;
  updated_at: number; // Unix timestamp
  scanlation_group?: ScanlationGroup;
  is_official: number; // 1 or 0
}

export interface ChapterDetailsResponse {
  result: {
    items: ComixChapter[];
    pagination: Pagination;
  };
}

export interface ChapterImage {
  url: string;
}

export interface ChapterResponse {
  result?: {
    chapter_id: number;
    images: ChapterImage[];
  };
}
