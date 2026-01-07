
import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
} from "../base/types";
import type { ScraperConfig } from "./types";

/**
 * A Generic Source that can scrape almost any standard manga site
 * based on a JSON configuration of CSS selectors.
 */
export class ConfigurableSource extends Source {
  readonly config: ScraperConfig;

  constructor(config: ScraperConfig) {
    super();
    this.config = config;
  }

  // ==========================================================================
  // Manga List (Popular, Latest, Search)
  // ==========================================================================

  async getPopular(page = 1): Promise<SearchResult> {
    return this.fetchAndParseList(this.config.paths.popular, page);
  }

  async getLatest(page = 1): Promise<SearchResult> {
    return this.fetchAndParseList(this.config.paths.latest, page);
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    // Replace ${query} and ${page} placeholders
    let path = this.config.paths.search
      .replace("${query}", encodeURIComponent(query))
      .replace("${page}", page.toString());
    
    // Handle cases where pagination isn't in the search URL pattern
    if (page > 1 && !this.config.paths.search.includes("${page}")) {
      // Common pattern: Append &page=2 or /page/2
      // For now, assume param based if ? exists
      if (path.includes("?")) {
        path += `&page=${page}`;
      } else {
        path += `/page/${page}`;
      }
    }

    return this.fetchAndParseList(path, page);
  }

  private async fetchAndParseList(path: string, page: number): Promise<SearchResult> {
    // Inject page number if placeholder exists
    const finalPath = path.replace("${page}", page.toString());
    const html = await this.fetchHtml(finalPath);
    const doc = this.parseHtml(html);

    const { itemSelector, titleSelector, urlSelector, coverSelector, nextPageSelector, coverAttribute } = this.config.list;

    const manga: Manga[] = doc
      .selectAll(itemSelector, (el) => {
        const titleEl = el.querySelector(titleSelector);
        const linkEl = el.querySelector(urlSelector);
        const coverEl = el.querySelector(coverSelector);

        // Try to get link from item itself if selector is just 'a' or empty
        const finalLinkEl = urlSelector === "a" || !urlSelector ? el : linkEl;
        
        const mangaUrl = (finalLinkEl?.getAttribute("href") ?? linkEl?.getAttribute("href")) || "";
        const title = titleEl?.textContent?.trim() || linkEl?.textContent?.trim() || "";
        const cover = coverEl?.getAttribute(coverAttribute || "src") || "";

        if (!mangaUrl || !title) return null;

        return {
          id: this.getMangaIdFromUrl(mangaUrl),
          title,
          cover: this.absoluteUrl(cover),
          url: this.absoluteUrl(mangaUrl),
          sourceId: this.id,
        };
      })
      .filter((m): m is Manga => m !== null);

    const hasNextPage = nextPageSelector ? (doc.querySelector(nextPageSelector) !== null) : false;

    return { manga, hasNextPage };
  }

  // ==========================================================================
  // Manga Details
  // ==========================================================================

  async getMangaDetails(mangaUrl: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);
    const s = this.config.details;

    const title = doc.querySelector(s.titleSelector)?.textContent?.trim() || "";
    const cover = doc.querySelector(s.coverSelector)?.getAttribute("src") || "";
    const description = doc.querySelector(s.descriptionSelector)?.textContent?.trim() || "";
    
    const author = s.authorSelector 
      ? doc.querySelector(s.authorSelector)?.textContent?.trim() 
      : undefined;

    const genres = s.genreSelector
      ? doc.querySelectorAll(s.genreSelector).map(el => el.textContent?.trim()).filter(Boolean) as string[]
      : [];

    const statusText = s.statusSelector 
      ? doc.querySelector(s.statusSelector)?.textContent?.trim() || ""
      : "";

    return {
      id: this.getMangaIdFromUrl(mangaUrl),
      title,
      cover: this.absoluteUrl(cover),
      url: this.absoluteUrl(mangaUrl),
      sourceId: this.id,
      author,
      description,
      genres,
      status: this.parseStatus(statusText),
    };
  }

  private parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase();
    if (lower.includes("completed")) return "Completed";
    if (lower.includes("ongoing")) return "Ongoing";
    if (lower.includes("hiatus")) return "Hiatus";
    return "Unknown";
  }

  // ==========================================================================
  // Chapter List
  // ==========================================================================

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);
    const s = this.config.chapters;

    const chapters = doc
      .selectAll(s.itemSelector, (el) => {
        const linkEl = el.querySelector(s.linkSelector);
        const dateEl = s.dateSelector ? el.querySelector(s.dateSelector) : null;

        const chapterUrl = linkEl?.getAttribute("href") || "";
        const title = linkEl?.textContent?.trim() || "";
        const date = dateEl?.textContent?.trim() || "";

        if (!chapterUrl) return null;

        return {
          id: this.getChapterIdFromUrl(chapterUrl),
          mangaId: this.getMangaIdFromUrl(mangaUrl),
          number: this.parseChapterNumber(title),
          title,
          url: this.absoluteUrl(chapterUrl),
          date,
        };
      })
      .filter((ch) => ch !== null) as Chapter[];

    // Standardize order: Newest first (descending)
    // If source provides ascending (oldest first), reverse it
    if (s.isDesc === false) {
        chapters.reverse();
    }

    return chapters;
  }

  protected getChapterIdFromUrl(url: string): string {
    const cleaned = url.replace(/\/$/, "");
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  }

  // ==========================================================================
  // Pages
  // ==========================================================================

  async getPageList(chapterUrl: string): Promise<Page[]> {
    const html = await this.fetchHtml(chapterUrl);
    
    if (this.config.pages.mode === "regex" && this.config.pages.regexPattern) {
        return this.getPageListRegex(html);
    }

    // Default: Selector mode
    const doc = this.parseHtml(html);
    const s = this.config.pages;
    const selector = s.imageSelector || "img";
    const attr = s.imageAttribute || "src";

    const pages = doc
        .querySelectorAll(selector)
        .map((el, index) => {
            const url = el.getAttribute(attr);
            if (!url) return null;
            return {
                index,
                imageUrl: this.absoluteUrl(url),
                headers: this.getImageHeaders(),
            };
        })
        .filter((p) => p !== null) as Page[];

    return pages;
  }

  private getPageListRegex(html: string): Page[] {
      // Basic regex implementation for common array formats
      // This is a simplified version; real-world regex scraping might need the specific logic
      // from the specific source (like MangaKatana's).
      // For now, we will leave this as a placeholder or implement basic array matching.
      
      const pattern = new RegExp(this.config.pages.regexPattern || "");
      const match = html.match(pattern);
      
      if (!match) return [];
      
      // Assume match[1] contains the list of URLs
      // This is highly dependent on the regex provided
      return [];
  }
}
