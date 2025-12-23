import { HttpClient } from "@/core/http";
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
  get needsCloudflareBypass(): boolean {
    return this.config.needsCloudflareBypass;
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
   * Fetch HTML from URL with proper headers
   */
  protected async fetchHtml(url: string): Promise<string> {
    const fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;
    return HttpClient.getText(fullUrl, {
      headers: {
        Referer: this.baseUrl,
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
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
