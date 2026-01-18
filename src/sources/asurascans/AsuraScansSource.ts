import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../base/types";
import { cookieJar } from "@/core/http/CookieJar";

/**
 * AsuraScans Source Implementation
 * URL: https://asuracomic.net
 *
 * Features:
 * - Cloudflare protection (requires WebView bypass)
 * - Next.js based site (pages in script tags)
 * - Premium chapters (hidden by default)
 * - API endpoint for filters
 */
export class AsuraScansSource extends Source {
  readonly config: SourceConfig = {
    id: "asurascans",
    name: "Asura Scans",
    baseUrl: "https://asuracomic.net",
    logo: require("@/assets/webp/asura-scan.webp"),
    language: "en",
    nsfw: false,
  };

  private readonly apiUrl = "https://gg.asuracomic.net/api";

  private readonly selectors = {
    // Listings (popular, latest, search)
    // Grid: div.grid.grid-cols-2 > a[href]
    mangaList: "div.grid.grid-cols-2 > a[href], div.grid > a[href]",
    mangaTitle: "span.block.font-bold",
    mangaThumbnail: "img",
    nextPage: "a:contains(Next)",

    // Manga details - more specific selectors to avoid nav elements
    // Title is inside div with both text-center and sm:text-left classes
    // The colon in sm:text-left must be escaped in CSS selector
    detailTitle: "div.text-center.sm\\:text-left span.text-xl.font-bold",
    detailThumbnail: "img[alt=poster]",
    detailDescription: "span.font-medium.text-sm",
    detailInfoGrid: "div.grid > div",
    detailInfoFlex: "div.flex",
    // Genres are in a flex-wrap container with gap-3
    detailGenres: "div.flex.flex-row.flex-wrap.gap-3 button",

    // Chapter list (hide premium chapters by default)
    chapterList: "div.scrollbar-thumb-themecolor > div.group:not(:has(svg))",
    chapterLink: "a",
    chapterNumber: "h3",
    chapterTitle: "h3 > span",
    chapterDate: "h3 + h3",
  };

  /**
   * Override absoluteUrl to ensure /series/ prefix for manga/chapter URLs
   * AsuraScans URLs should be: /series/{slug}/chapter/{num}
   * But hrefs might be: /{slug}/chapter/{num} (missing /series/)
   */
  protected absoluteUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("//")) return `https:${path}`;

    // Clean up the path
    let cleanPath = path.trim();

    // If it starts with /, check if it needs /series/ prefix
    if (cleanPath.startsWith("/")) {
      // If it doesn't start with /series/, /api/, /_next/, etc., add /series/
      if (
        !cleanPath.startsWith("/series/") &&
        !cleanPath.startsWith("/api/") &&
        !cleanPath.startsWith("/_next/") &&
        !cleanPath.startsWith("/storage/")
      ) {
        cleanPath = `/series${cleanPath}`;
      }
      return `${this.baseUrl}${cleanPath}`;
    }

    // If relative path doesn't start with series/, add it
    if (
      !cleanPath.startsWith("series/") &&
      !cleanPath.startsWith("api/") &&
      !cleanPath.startsWith("_next/") &&
      !cleanPath.startsWith("storage/")
    ) {
      cleanPath = `series/${cleanPath}`;
    }

    return `${this.baseUrl}/${cleanPath}`;
  }

  /**
   * Get image URL from element, checking multiple attributes
   */
  private getImageUrl(el: Element | null): string {
    if (!el) return "";

    for (const attr of ["data-src", "src", "data-lazy-src"]) {
      const val = el.getAttribute(attr);
      if (val && !val.includes("data:image")) {
        // For images, use parent class absoluteUrl (don't add /series/)
        if (!val) return "";
        if (val.startsWith("http")) return val;
        if (val.startsWith("//")) return `https:${val}`;
        if (val.startsWith("/")) return `${this.baseUrl}${val}`;
        return `${this.baseUrl}/${val}`;
      }
    }
    return "";
  }

  async getPopular(page = 1): Promise<SearchResult> {
    const url = `/series?genres=&status=-1&types=-1&order=rating&page=${page}`;
    
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga = doc.selectAll(this.selectors.mangaList, (el) => {
      const titleEl = el.querySelector(this.selectors.mangaTitle);
      const imgEl = el.querySelector(this.selectors.mangaThumbnail);

      const mangaUrl = el.getAttribute("href") || "";
      const title = titleEl?.textContent?.trim() || "";
      const cover = this.getImageUrl(imgEl as any);

      return {
        id: this.getMangaIdFromUrl(mangaUrl),
        title,
        cover,
        url: this.absoluteUrl(mangaUrl),
        sourceId: this.id,
      };
    });

    const hasNextPage = !!doc.querySelector(this.selectors.nextPage);

    return {
      manga: manga.filter((m) => m.url),
      hasNextPage,
    };
  }

  async getLatest(page = 1): Promise<SearchResult> {
    const url = `/series?genres=&status=-1&types=-1&order=update&page=${page}`;
    
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga = doc.selectAll(this.selectors.mangaList, (el) => {
      const titleEl = el.querySelector(this.selectors.mangaTitle);
      const imgEl = el.querySelector(this.selectors.mangaThumbnail);

      const mangaUrl = el.getAttribute("href") || "";
      const title = titleEl?.textContent?.trim() || "";
      const cover = this.getImageUrl(imgEl as any);

      return {
        id: this.getMangaIdFromUrl(mangaUrl),
        title,
        cover,
        url: this.absoluteUrl(mangaUrl),
        sourceId: this.id,
      };
    });

    const hasNextPage = !!doc.querySelector(this.selectors.nextPage);

    return {
      manga: manga.filter((m) => m.url),
      hasNextPage,
    };
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    const url = `/series?name=${encodeURIComponent(
      query
    )}&genres=&status=-1&types=-1&order=rating&page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga = doc.selectAll(this.selectors.mangaList, (el) => {
      const titleEl = el.querySelector(this.selectors.mangaTitle);
      const imgEl = el.querySelector(this.selectors.mangaThumbnail);

      const mangaUrl = el.getAttribute("href") || "";
      const title = titleEl?.textContent?.trim() || "";
      const cover = this.getImageUrl(imgEl as any);

      return {
        id: this.getMangaIdFromUrl(mangaUrl),
        title,
        cover,
        url: this.absoluteUrl(mangaUrl),
        sourceId: this.id,
      };
    });

    const hasNextPage = !!doc.querySelector(this.selectors.nextPage);

    return {
      manga: manga.filter((m) => m.url),
      hasNextPage,
    };
  }

  async getMangaDetails(mangaUrl: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const title =
      doc.querySelector(this.selectors.detailTitle)?.textContent?.trim() || "";

    const thumbnailEl = doc.querySelector(this.selectors.detailThumbnail);
    const cover = this.getImageUrl(thumbnailEl as any);

    const description =
      doc
        .querySelector(this.selectors.detailDescription)
        ?.textContent?.trim() || "";

    // Parse author/artist from grid divs
    let author: string | undefined;
    let artist: string | undefined;
    doc.querySelectorAll(this.selectors.detailInfoGrid).forEach((div) => {
      const h3s = Array.from(div.querySelectorAll("h3"));
      if (h3s.length >= 2) {
        const label = h3s[0].textContent?.trim().toLowerCase() || "";
        const value = h3s[1].textContent?.trim();
        if (label.includes("author")) author = value;
        if (label.includes("artist")) artist = value;
      }
    });

    // Parse type and status from flex divs
    let statusText = "";
    const genres: string[] = [];
    doc.querySelectorAll(this.selectors.detailInfoFlex).forEach((div) => {
      const h3s = Array.from(div.querySelectorAll("h3"));
      if (h3s.length >= 2) {
        const label = h3s[0].textContent?.trim().toLowerCase() || "";
        const value = h3s[1].textContent?.trim();
        if (label.includes("type") && value) {
          genres.push(value);
        }
        if (label.includes("status")) {
          statusText = value?.toLowerCase() || "";
        }
      }
    });

    // Collect genre buttons
    doc.querySelectorAll(this.selectors.detailGenres).forEach((el) => {
      const genre = el.textContent?.trim();
      if (genre) genres.push(genre);
    });

    const status = this.parseStatus(statusText);

    return {
      id: this.getMangaIdFromUrl(mangaUrl),
      title,
      cover,
      url: this.absoluteUrl(mangaUrl),
      sourceId: this.id,
      author,
      artist,
      description,
      genres: Array.from(new Set(genres)), // Deduplicate genres
      status,
    };
  }

  private parseStatus(status: string): MangaDetails["status"] {
    if (status.includes("ongoing") || status.includes("season end")) {
      return "Ongoing";
    }
    if (status.includes("hiatus")) {
      return "Hiatus";
    }
    if (status.includes("completed")) {
      return "Completed";
    }
    if (status.includes("dropped") || status.includes("cancelled")) {
      return "Unknown"; // No cancelled status in type
    }
    return "Unknown";
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const chapters = doc.selectAll(this.selectors.chapterList, (el, idx) => {
      const linkEl = el.querySelector(this.selectors.chapterLink);
      const numberEl = el.querySelector(this.selectors.chapterNumber);
      const dateEl = el.querySelector(this.selectors.chapterDate);

      const chapterUrl = linkEl?.getAttribute("href") || "";
      const chapterNumber = numberEl?.textContent?.trim() || "";
      const absoluteChapterUrl = this.absoluteUrl(chapterUrl);

      // Collect title spans
      const titleSpans = el.querySelectorAll(this.selectors.chapterTitle);
      const chapterTitle = Array.from(titleSpans)
        .map((span) => span.textContent?.trim())
        .filter(Boolean)
        .join(" ");

      const fullTitle = chapterTitle
        ? `${chapterNumber} - ${chapterTitle}`
        : chapterNumber;

      const dateText = dateEl?.textContent?.trim() || "";
      const date = this.parseDate(dateText);

      return {
        id: this.getChapterIdFromUrl(chapterUrl),
        mangaId: this.getMangaIdFromUrl(mangaUrl),
        number: this.parseChapterNumber(chapterNumber),
        title: fullTitle,
        url: this.absoluteUrl(chapterUrl),
        date: date,
      };
    });

    
    if (chapters.length > 0) {
      
    }

    return chapters.filter((ch) => ch.url);
  }

  /**
   * Parse date with format "January 1st 2024"
   */
  private parseDate(dateText: string): string {
    if (!dateText) return "";

    try {
      // Remove ordinal suffixes (1st, 2nd, 3rd, 4th)
      const cleaned = dateText.replace(/(\d+)(st|nd|rd|th)/g, "$1");

      // Parse date
      const date = new Date(cleaned);
      if (isNaN(date.getTime())) return dateText;

      return date.toISOString().split("T")[0]; // Return YYYY-MM-DD
    } catch {
      return dateText;
    }
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    
    const html = await this.fetchHtml(chapterUrl);
    

    // Log a sample of the HTML to see what we're working with
    const sampleStart = html.indexOf("self.__next_f");
    if (sampleStart > 0) {
      
    } else {
      
      
    }

    // Extract pages from Next.js script tags
    // Use a more permissive regex - capture everything between script tags that contain self.__next_f.push
    const scriptRegex =
      /<script[^>]*>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
    const matches = Array.from(html.matchAll(scriptRegex));
    

    if (matches.length === 0) {
      // Try alternative: look for all script content containing self.__next_f.push
      const altRegex =
        /<script[^>]*>([\s\S]*?self\.__next_f\.push[\s\S]*?)<\/script>/g;
      const altMatches = Array.from(html.matchAll(altRegex));
      
      if (altMatches.length > 0) {
        
      }
      
      return [];
    }

    // Extract content from each script array: [1, "content"]
    const scriptData = matches
      .map((match, idx) => {
        const arrayStr = match[1] || "";
        
        try {
          // Parse the array [1, "content"]
          const parsed = JSON.parse(arrayStr);
          if (
            Array.isArray(parsed) &&
            parsed.length >= 2 &&
            typeof parsed[1] === "string"
          ) {
            return parsed[1];
          }
        } catch (e) {
          
        }
        return "";
      })
      .join("");

    
    

    // Find pages array - try both escaped and unescaped patterns
    // Escaped: \"pages\":  (when content is still raw from script)
    // Unescaped: "pages": (when content was already parsed)
    let pagesMatch = /\\"pages\\":\s*(\[[\s\S]*?\])/s.exec(scriptData);
    let needsUnescape = true;

    if (!pagesMatch) {
      // Try unescaped version
      pagesMatch = /"pages":\s*(\[[\s\S]*?\])/s.exec(scriptData);
      needsUnescape = false;
    }

    if (!pagesMatch) {
      
      
      
      // Log more of the data to understand structure
      
      return [];
    }

    
    
    

    // Unescape if needed: replace \x with x (like Tachiyomi's UNESCAPE_REGEX)
    const unescaped = needsUnescape
      ? pagesMatch[1].replace(/\\(.)/g, "$1")
      : pagesMatch[1];
    

    try {
      const pagesData: Array<{ order: number; url: string }> =
        JSON.parse(unescaped);
      

      // Sort by order and map to Page objects
      const sortedPages = pagesData.sort((a, b) => a.order - b.order);

      // Get cookies for image requests
      const cookies = await cookieJar.getCookieString(this.baseUrl);

      return sortedPages.map((page, index) => ({
        index,
        imageUrl: page.url,
        headers: {
          Referer: this.baseUrl + "/",
          ...(cookies && { Cookie: cookies }),
        },
      }));
    } catch (e) {
      
      
      return [];
    }
  }

  /**
   * Get chapter ID from URL
   */
  private getChapterIdFromUrl(url: string): string {
    // Extract from /series/{manga-slug}/{chapter-slug}
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  }
}
