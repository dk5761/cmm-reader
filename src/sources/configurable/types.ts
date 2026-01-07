
import type { SourceConfig } from "../base/types";

/**
 * Configuration for the GenericSource.
 * Defines CSS selectors and behaviors for scraping.
 */
export interface ScraperConfig extends SourceConfig {
  /** CSS Selectors for list views (Popular/Latest/Search) */
  list: {
    /** Container for a single manga item */
    itemSelector: string;
    /** Selector for title (relative to item) */
    titleSelector: string;
    /** Selector for link (relative to item) */
    urlSelector: string;
    /** Selector for cover image (relative to item) */
    coverSelector: string;
    /** Selector for "Next Page" button */
    nextPageSelector?: string;
    /** Optional: Attribute to get cover URL from (default: "src") */
    coverAttribute?: string;
  };

  /** CSS Selectors for Manga Details page */
  details: {
    titleSelector: string;
    coverSelector: string;
    descriptionSelector: string;
    authorSelector?: string;
    artistSelector?: string;
    statusSelector?: string;
    genreSelector?: string; // Multi-select
    altNameSelector?: string;
  };

  /** CSS Selectors for Chapter List */
  chapters: {
    /** Container for a single chapter row/item */
    itemSelector: string;
    /** Selector for chapter link (relative to item) */
    linkSelector: string;
    /** Selector for date (relative to item) */
    dateSelector?: string;
    /** 
     * If true, chapters are listed in descending order (newest first).
     * If false, the source reverses them automatically.
     * Default: true
     */
    isDesc?: boolean;
  };

  /** CSS Selectors for Page List (Reader) */
  pages: {
    /** 
     * Mode: 'selector' (find <img> tags) or 'regex' (extract JSON/Array)
     * Default: 'selector'
     */
    mode?: "selector" | "regex";
    
    // For 'selector' mode:
    imageSelector?: string;
    imageAttribute?: string; // Default: "src"

    // For 'regex' mode:
    regexPattern?: string; // Regex to find the array/json
  };
  
  /** URL formatting */
  paths: {
    /** Path for latest updates (e.g., "/latest") */
    latest: string;
    /** Path for popular (e.g., "/popular") */
    popular: string;
    /** Path for search (e.g., "/search?q=${query}") */
    search: string;
  };
}
