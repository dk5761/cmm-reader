import { HttpClient } from "@/core/http";
import { WebViewFetcherService } from "@/core/http/WebViewFetcherService";
import { parseHtml, HtmlParser } from "@/core/parser";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "./types";

/**
 * Abstract base class for manga sources
 * Implement this for each manga website
 */
export abstract class Source {
  abstract readonly config: SourceConfig;

  // Convenience getters
  get id(): string {
    return this.config.id;
  }
  get name(): string {
    return this.config.name;
  }
  get baseUrl(): string {
    return this.config.baseUrl;
  }
  /**
   * @deprecated No longer used - CloudflareInterceptor handles CF automatically
   */
  get needsCloudflareBypass(): boolean {
    return this.config.needsCloudflareBypass ?? false;
  }

  /**
   * Get headers required for loading images from this source.
   * Override in subclasses if special headers are needed.
   */
  getImageHeaders(): Record<string, string> {
    return {
      Referer: `${this.baseUrl}/`,
    };
  }

  /**
   * Search for manga by query
   */
  abstract search(query: string, page?: number): Promise<SearchResult>;

  /**
   * Get popular/trending manga
   */
  abstract getPopular(page?: number): Promise<SearchResult>;

  /**
   * Get latest updated manga
   */
  abstract getLatest(page?: number): Promise<SearchResult>;

  /**
   * Get detailed manga information
   */
  abstract getMangaDetails(url: string): Promise<MangaDetails>;

  /**
   * Get list of chapters for a manga
   */
  abstract getChapterList(mangaUrl: string): Promise<Chapter[]>;

  /**
   * Get list of pages/images for a chapter
   */
  abstract getPageList(chapterUrl: string): Promise<Page[]>;

  // ─────────────────────────────────────────────────────────────
  // Protected helper methods for subclasses
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch HTML from URL with proper headers.
   * CloudflareInterceptor automatically handles CF challenges.
   */
  protected async fetchHtml(url: string): Promise<string> {
    const fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;

    // Use HttpClient - CloudflareInterceptor handles CF automatically
    return HttpClient.getText(fullUrl, {
      headers: {
        Referer: this.baseUrl,
      },
    });
  }

  /**
   * Parse HTML string into queryable document
   */
  protected parseHtml(html: string): HtmlParser {
    return parseHtml(html);
  }

  /**
   * Resolve relative URL to absolute
   */
  protected absoluteUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("//")) return `https:${path}`;
    if (path.startsWith("/")) return `${this.baseUrl}${path}`;
    return `${this.baseUrl}/${path}`;
  }

  /**
   * Extract manga ID from URL (override if needed)
   */
  protected getMangaIdFromUrl(url: string): string {
    // Default: use last path segment
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  }

  /**
   * Parse chapter number from string
   */
  protected parseChapterNumber(text: string): number {
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }
}
