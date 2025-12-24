import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../base/types";

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
    language: "en",
    needsCloudflareBypass: true,
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
    console.log("[AsuraScans] getPopular called, URL:", url);
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
    console.log("[AsuraScans] getLatest called, URL:", url);
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
    console.log("[AsuraScans] Getting chapter list for:", mangaUrl);
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const chapters = doc.selectAll(this.selectors.chapterList, (el, idx) => {
      const linkEl = el.querySelector(this.selectors.chapterLink);
      const numberEl = el.querySelector(this.selectors.chapterNumber);
      const dateEl = el.querySelector(this.selectors.chapterDate);

      const chapterUrl = linkEl?.getAttribute("href") || "";
      const chapterNumber = numberEl?.textContent?.trim() || "";
      const absoluteChapterUrl = this.absoluteUrl(chapterUrl);

      // Log first 3 chapters for debugging
      if (idx < 3) {
        console.log(`[AsuraScans] Chapter ${idx}:`, {
          rawHref: chapterUrl,
          absoluteUrl: absoluteChapterUrl,
          chapterNumber,
        });
      }

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

    console.log("[AsuraScans] Total chapters found:", chapters.length);
    if (chapters.length > 0) {
      console.log("[AsuraScans] First chapter URL:", chapters[0].url);
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
    console.log("[AsuraScans] Fetching chapter URL:", chapterUrl);
    const html = await this.fetchHtml(chapterUrl);
    console.log("[AsuraScans] Chapter HTML length:", html.length);

    // Log a sample of the HTML to see what we're working with
    const sampleStart = html.indexOf("self.__next_f");
    if (sampleStart > 0) {
      console.log(
        "[AsuraScans] Sample around __next_f:",
        html.substring(sampleStart, sampleStart + 500)
      );
    } else {
      console.log("[AsuraScans] __next_f not found in HTML!");
      console.log("[AsuraScans] HTML preview:", html.substring(0, 1000));
    }

    // Extract pages from Next.js script tags
    // Use a more permissive regex - capture everything between script tags that contain self.__next_f.push
    const scriptRegex =
      /<script[^>]*>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
    const matches = Array.from(html.matchAll(scriptRegex));
    console.log("[AsuraScans] Found script matches:", matches.length);

    if (matches.length === 0) {
      // Try alternative: look for all script content containing self.__next_f.push
      const altRegex =
        /<script[^>]*>([\s\S]*?self\.__next_f\.push[\s\S]*?)<\/script>/g;
      const altMatches = Array.from(html.matchAll(altRegex));
      console.log("[AsuraScans] Alt regex matches:", altMatches.length);
      if (altMatches.length > 0) {
        console.log(
          "[AsuraScans] First alt match:",
          altMatches[0][1].substring(0, 300)
        );
      }
      console.warn("[AsuraScans] No Next.js scripts found");
      return [];
    }

    // Extract content from each script array: [1, "content"]
    const scriptData = matches
      .map((match, idx) => {
        const arrayStr = match[1] || "";
        console.log(
          `[AsuraScans] Match ${idx} array:`,
          arrayStr.substring(0, 100)
        );
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
          console.log(`[AsuraScans] Match ${idx} parse error:`, e);
        }
        return "";
      })
      .join("");

    console.log("[AsuraScans] Script data length:", scriptData.length);
    console.log(
      "[AsuraScans] Script data preview:",
      scriptData.substring(0, 500)
    );

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
      console.warn("[AsuraScans] Failed to find pages in script data");
      console.log(
        "[AsuraScans] Contains escaped 'pages':",
        scriptData.includes('\\"pages\\"')
      );
      console.log(
        "[AsuraScans] Contains unescaped 'pages':",
        scriptData.includes('"pages"')
      );
      // Log more of the data to understand structure
      console.log(
        "[AsuraScans] Full script data (first 2000 chars):",
        scriptData.substring(0, 2000)
      );
      return [];
    }

    console.log(
      "[AsuraScans] Found pages match, length:",
      pagesMatch[1].length
    );
    console.log("[AsuraScans] Pages preview:", pagesMatch[1].substring(0, 200));
    console.log("[AsuraScans] Needs unescape:", needsUnescape);

    // Unescape if needed: replace \x with x (like Tachiyomi's UNESCAPE_REGEX)
    const unescaped = needsUnescape
      ? pagesMatch[1].replace(/\\(.)/g, "$1")
      : pagesMatch[1];
    console.log("[AsuraScans] Unescaped preview:", unescaped.substring(0, 200));

    try {
      const pagesData: Array<{ order: number; url: string }> =
        JSON.parse(unescaped);
      console.log("[AsuraScans] Parsed pages count:", pagesData.length);

      // Sort by order and map to Page objects
      const sortedPages = pagesData.sort((a, b) => a.order - b.order);

      return sortedPages.map((page, index) => ({
        index,
        imageUrl: page.url,
        headers: {
          Referer: this.baseUrl + "/",
        },
      }));
    } catch (e) {
      console.error("[AsuraScans] Failed to parse pages JSON:", e);
      console.log("[AsuraScans] Raw unescaped:", unescaped);
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
