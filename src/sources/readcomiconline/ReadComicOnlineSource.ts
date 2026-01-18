import { Platform } from "react-native";
import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
  SourceFilters,
  PublisherFilter,
  SortOption,
} from "../base/types";

/**
 * ReadComicOnline Source Implementation
 * Based on Tachiyomi/Keiyoushi extension
 * URL: https://readcomiconline.li
 */
export class ReadComicOnlineSource extends Source {
  readonly config: SourceConfig = {
    id: "readcomiconline",
    name: "ReadComicOnline",
    baseUrl: "https://readcomiconline.li",

    language: "en",
    nsfw: false,
  };

  // Selectors for mobile HTML structure
  private readonly itemSelector = ".item-list .section.group.list";
  private readonly chapterSelector = "ul.list > li";

  // Preferences (hardcoded for MVP)
  private readonly quality: "hq" | "lq" = "hq";
  private readonly server: "" | "s2" = "";

  /**
   * Get comics with publisher and sort filters
   * Publisher filter: Marvel, DC-Comics, or all
   * Sort options: MostPopular, LatestUpdate, Newest, or Alphabet (empty)
   */
  async getWithFilters(
    page = 1,
    filters: SourceFilters = {}
  ): Promise<SearchResult> {
    const { publisher = "all", sort = "LatestUpdate" } = filters;

    // Build URL based on filters
    // If publisher selected: /Publisher/{publisher}/{sort}?page=X
    // If no publisher: /ComicList/{sort}?page=X
    let url: string;
    if (publisher && publisher !== "all") {
      const sortPath = sort || "";
      url = `/Publisher/${publisher}${
        sortPath ? `/${sortPath}` : ""
      }?page=${page}`;
    } else {
      const sortPath = sort || "LatestUpdate";
      url = `/ComicList/${sortPath}?page=${page}`;
    }

    
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.itemSelector, (el) => {
      const infoLink = el.querySelector(".col.info p a");
      const title = infoLink?.textContent?.trim() || "";
      const itemUrl = infoLink?.getAttribute("href") || "";

      const coverImg = el.querySelector(".col.cover a img");
      const cover = coverImg?.getAttribute("src") || "";

      return {
        id: this.getMangaIdFromUrl(itemUrl),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(itemUrl),
        sourceId: this.id,
      };
    });

    const hasNextPage = doc.querySelector("a.next_bt") !== null;
    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getPopular(page = 1): Promise<SearchResult> {
    const url = `/ComicList/MostPopular?page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.itemSelector, (el) => {
      // Get title and URL from .col.info > p > a
      const infoLink = el.querySelector(".col.info p a");
      const title = infoLink?.textContent?.trim() || "";
      const url = infoLink?.getAttribute("href") || "";

      // Get cover from .col.cover > a > img
      const coverImg = el.querySelector(".col.cover a img");
      const cover = coverImg?.getAttribute("src") || "";

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    // Check for Next link - mobile uses a.next_bt
    const hasNextPage = doc.querySelector("a.next_bt") !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getLatest(page = 1): Promise<SearchResult> {
    const url = `/ComicList/LatestUpdate?page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.itemSelector, (el) => {
      // Get title and URL from .col.info > p > a
      const infoLink = el.querySelector(".col.info p a");
      const title = infoLink?.textContent?.trim() || "";
      const url = infoLink?.getAttribute("href") || "";

      // Get cover from .col.cover > a > img
      const coverImg = el.querySelector(".col.cover a img");
      const cover = coverImg?.getAttribute("src") || "";

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    // Check for Next link - mobile uses a.next_bt
    const hasNextPage = doc.querySelector("a.next_bt") !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    // Basic search using AdvanceSearch endpoint
    const searchUrl = new URL(`${this.baseUrl}/AdvanceSearch`);
    searchUrl.searchParams.set("comicName", query.trim());
    searchUrl.searchParams.set("page", page.toString());

    const html = await this.fetchHtml(searchUrl.toString());
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.itemSelector, (el) => {
      // Get title and URL from .col.info > p > a
      const infoLink = el.querySelector(".col.info p a");
      const title = infoLink?.textContent?.trim() || "";
      const url = infoLink?.getAttribute("href") || "";

      // Get cover from .col.cover > a > img
      const coverImg = el.querySelector(".col.cover a img");
      const cover = coverImg?.getAttribute("src") || "";

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    // Check for Next link - mobile uses a.next_bt
    const hasNextPage = doc.querySelector("a.next_bt") !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getMangaDetails(url: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    // Mobile title is in .content_top .heading h3
    const title = doc.text(".content_top .heading h3") || "";

    // Find author/writer - look for paragraph with "Writer:" text
    const infoParagraphs = doc.querySelectorAll(".col.info p");
    const authorPara = infoParagraphs.find((p) =>
      p.textContent?.includes("Writer:")
    );
    const author = authorPara?.querySelector("a")?.textContent?.trim();

    // Find artist
    const artistPara = infoParagraphs.find((p) =>
      p.textContent?.includes("Artist:")
    );
    const artist = artistPara?.querySelector("a")?.textContent?.trim();

    // Find genres
    const genresPara = infoParagraphs.find((p) =>
      p.textContent?.includes("Genres:")
    );
    const genres = genresPara
      ? Array.from(genresPara.querySelectorAll("a")).map(
          (a: any) => a.textContent?.trim() || ""
        )
      : [];

    // Find description - it's in a p tag in .section.group after the info section
    const descriptionSections = doc.querySelectorAll(".section.group p");
    let description = "";
    for (const p of descriptionSections) {
      const text = p.textContent?.trim() || "";
      // Skip if it's an info paragraph or too short
      if (text && !text.includes(":") && text.length > 50) {
        description = text;
        break;
      }
    }

    // Find status
    const statusPara = infoParagraphs.find((p) =>
      p.textContent?.includes("Status:")
    );
    const statusText = statusPara?.textContent || "";

    // Cover image is in .col.cover img
    const cover = doc.attr(".col.cover img", "src") || "";

    return {
      id: this.getMangaIdFromUrl(url),
      title,
      cover: this.absoluteUrl(cover),
      url,
      author,
      description: description.trim(),
      genres,
      status: this.parseStatus(statusText),
      sourceId: this.id,
    };
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    // Mobile uses ul.list > li for chapters
    const chapterItems = doc.querySelectorAll(this.chapterSelector);
    const chapters: Chapter[] = chapterItems
      .map((el) => {
        // Chapter link is in .col-1 > a
        const linkEl = el.querySelector(".col-1 a");
        const chapterUrl = linkEl?.getAttribute("href") || "";
        const chapterTitle =
          linkEl?.querySelector("span")?.textContent?.trim() || "";

        // Date is in .col-2 > span
        const dateEl = el.querySelector(".col-2 span");
        const dateText = dateEl?.textContent?.trim();

        return {
          id: this.getMangaIdFromUrl(chapterUrl),
          mangaId: this.getMangaIdFromUrl(mangaUrl),
          number: this.parseChapterNumber(chapterTitle),
          title: chapterTitle,
          url: this.absoluteUrl(chapterUrl),
          date: dateText,
        };
      })
      .filter((ch) => ch.url); // Filter out any invalid entries

    return chapters;
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    

    // Build URL with quality and server params
    const qualitySuffix =
      (this.quality !== "lq" && this.server !== "s2") ||
      (this.quality === "lq" && this.server === "s2")
        ? `&s=${this.server}&quality=${this.quality}&readType=1`
        : `&s=${this.server}&readType=1`;

    const fullUrl = chapterUrl + qualitySuffix;
    const html = await this.fetchHtml(fullUrl);

    // Extract and decrypt image URLs
    const pages = await this.decryptPages(html);

    

    return pages;
  }
  /**
   * Decrypt image URLs from page HTML by parsing JavaScript arrays
   * Algorithm based on the website's JS: dTfnT -> step1 -> step2 -> atob -> trim
   */
  private async decryptPages(html: string): Promise<Page[]> {
    let imageUrls: string[] = [];

    // Match algorithm from Keiyoushi config.json
    // First find var _[...]mvn pattern to get array name
    const varRegex = /var\s+(_[^\s=]+mvn)\s*(?:=\s*[^;]+)?\s*;/;
    const varMatch = html.match(varRegex);

    if (varMatch) {
      // Get first 8 chars of the variable name to match push calls
      const arrayPrefix = varMatch[1].substring(0, 8);
      

      // Match .push('...') calls for this array
      const pushPattern = new RegExp(
        `(\\b${arrayPrefix}\\s*\\.push\\(\\s*['"])([^'"]+)(['"]\\s*\\))`,
        "g"
      );

      for (const match of html.matchAll(pushPattern)) {
        if (match[2]) {
          try {
            const decodedUrl = this.decodeImageUrl(match[2]);
            if (decodedUrl) {
              imageUrls.push(decodedUrl);
            }
          } catch (e) {
            
          }
        }
      }
    } else {
      
      // Fallback: try to find pth assignments with auth tokens
      const pthPattern = /pth\s*=\s*'([^']+\?rhlupa=[^']+)'/g;

      for (const match of html.matchAll(pthPattern)) {
        try {
          const decodedUrl = this.decodeImageUrl(match[1]);
          if (decodedUrl) {
            imageUrls.push(decodedUrl);
          }
        } catch (e) {
          
        }
      }
    }

    
    if (imageUrls.length > 0) {
      
    }

    

    // Convert to Page objects
    const pages: Page[] = imageUrls.map((url, index) => ({
      index,
      imageUrl: url,
      headers: {
        Referer: `${this.baseUrl}/`,
        "User-Agent": this.getUserAgent(),
      },
    }));

    return pages;
  }

  /**
   * Decode an obfuscated image URL using the exact algorithm from Keiyoushi config.json
   */
  private decodeImageUrl(rawPath: string): string | null {
    try {
      let e = rawPath;

      // Step 1: Replace obfuscation markers
      // \w{5}__\w{3}__ -> 'g'
      e = e.replace(/\w{5}__\w{3}__/g, "g");
      // \w{2}__\w{6}_ -> 'a'
      e = e.replace(/\w{2}__\w{6}_/g, "a");

      // Step 2: Swap b <-> pw_.g28x and h <-> d2pr.x_27 (round-trip = no-op essentially)
      e = e.replace(/b/g, "pw_.g28x");
      e = e.replace(/h/g, "d2pr.x_27");
      e = e.replace(/pw_.g28x/g, "b");
      e = e.replace(/d2pr.x_27/g, "h");

      // If already starts with https, return as-is
      if (e.startsWith("https")) {
        return e;
      }

      // Step 3: Extract query params
      const queryIdx = e.indexOf("?");
      const queryString = e.substring(queryIdx);

      // Step 4: Check if s0 or s1600 quality
      const isLowQuality = e.includes("=s0?");
      const sizeIdx = isLowQuality ? e.indexOf("=s0?") : e.indexOf("=s1600?");

      // Step 5: Extract path before size marker
      let c = e.substring(0, sizeIdx);

      // Step 6: Apply step1 - keep chars [15,33) + [50,end)
      c = c.substring(15, 33) + c.substring(50);

      // Step 7: Apply step2 - keep [0, len-11) + last 2 chars
      const len = c.length;
      c = c.substring(0, len - 11) + c[len - 2] + c[len - 1];

      // Step 8: Base64 decode
      const decoded = atob(c);

      // Step 9: URI decode
      let path = decodeURIComponent(decoded);

      // Step 10: Skip chars [13,17)
      path = path.substring(0, 13) + path.substring(17);

      // Step 11: Replace last 2 chars with size suffix
      path =
        path.substring(0, path.length - 2) + (isLowQuality ? "=s0" : "=s1600");

      // Step 12: Build final URL
      const baseUrl = "https://2.bp.blogspot.com";
      const fullUrl = `${baseUrl}/${path}${queryString}`;

      

      return fullUrl;
    } catch (e) {
      
      return null;
    }
  }

  /**
   * Evaluate JavaScript code using React Native's JavaScriptCore
   */
  private evalJS(code: string): string {
    try {
      // React Native provides global.eval which uses JSC
      // We need to wrap this in a safe evaluation context
      const result = eval(code);
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (error) {
      
      throw new Error(`JS eval failed: ${error}`);
    }
  }

  private getUserAgent(): string {
    return Platform.OS === "ios"
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  }

  private parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase();
    if (lower.includes("ongoing")) return "Ongoing";
    if (lower.includes("completed")) return "Completed";
    return "Unknown";
  }
}
