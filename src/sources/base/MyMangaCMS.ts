import { Source } from "./Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "./types";

/**
 * MyMangaCMS Multi-Source Base
 * Port of Tachiyomi's MyMangaCMS library
 * Used for Vietnamese manga sites and similar CMS-based sources
 */
export abstract class MyMangaCMS extends Source {
  // Localization strings - override in subclasses
  protected parseAuthorString = "Tác giả";
  protected parseAlternativeNameString = "Tên khác";
  protected parseAlternative2ndNameString = "Tên gốc";
  protected parseStatusString = "Tính trạng";
  protected parseStatusOngoingStringLowerCase = "đang tiến hành";
  protected parseStatusOnHoldStringLowerCase = "tạm ngưng";
  protected parseStatusCompletedStringLowerCase = "đã hoàn thành";

  // Words to remove from alternative names
  protected removeGenericWords = ["manhwa", "engsub"];

  // Timezone for date parsing
  protected timeZone = "Asia/Ho_Chi_Minh";

  // Selectors - match Kotlin implementation exactly
  protected readonly popularSelector = "div.thumb-item-flow.col-6.col-md-2";
  protected readonly searchSelector = "div.thumb-item-flow.col-6.col-md-2";
  protected readonly chapterSelector = "ul.list-chapters > a";

  // URL prefix for direct manga links
  static readonly PREFIX_URL_SEARCH = "url:";

  /**
   * Date parser - override if needed
   */
  protected parseDateUpdated(date: string): string {
    // Default: return as-is, subclasses can override
    return date;
  }

  /**
   * Search manga - supports direct URL search with "url:" prefix
   */
  async search(query: string, page = 1): Promise<SearchResult> {
    // Handle direct URL search
    if (query.startsWith(MyMangaCMS.PREFIX_URL_SEARCH)) {
      const url = query.replace(MyMangaCMS.PREFIX_URL_SEARCH, "").trim();
      const details = await this.getMangaDetails(url);
      return {
        manga: [details],
        hasNextPage: false,
      };
    }

    const searchUrl = `/tim-kiem?q=${encodeURIComponent(query)}&page=${page}`;
    const html = await this.fetchHtml(searchUrl);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.searchSelector, (el) => {
      const linkEl = el.querySelector("a");
      const titleEl = el.querySelector("div.thumb_attr.series-title a[title]");
      const imgEl = el.querySelector("div.content.img-in-ratio");

      const url = linkEl?.getAttribute("href") || "";
      const title = titleEl?.textContent?.trim() || "";
      const cover = imgEl?.getAttribute("data-bg") || "";

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    const hasNextPage =
      doc.querySelector(
        "div.pagination_wrap a.paging_item:last-of-type:not(.disabled)"
      ) !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  /**
   * Get popular manga
   */
  async getPopular(page = 1): Promise<SearchResult> {
    const url = `/tim-kiem?sort=top&page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.popularSelector, (el) => {
      const linkEl = el.querySelector("a");
      const titleEl = el.querySelector("div.thumb_attr.series-title a[title]");
      const imgEl = el.querySelector("div.content.img-in-ratio");

      const url = linkEl?.getAttribute("href") || "";
      const title = titleEl?.textContent?.trim() || "";
      const cover = imgEl?.getAttribute("data-bg") || "";

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    const hasNextPage =
      doc.querySelector(
        "div.pagination_wrap a.paging_item:last-of-type:not(.disabled)"
      ) !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  /**
   * Get latest updated manga
   */
  async getLatest(page = 1): Promise<SearchResult> {
    const url = `/tim-kiem?sort=update&page=${page}`;
    console.log(`[MyMangaCMS] getLatest - ${this.name}:`, this.baseUrl + url);

    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.popularSelector, (el) => {
      const linkEl = el.querySelector("a");
      const titleEl = el.querySelector("div.thumb_attr.series-title a[title]");
      const imgEl = el.querySelector("div.content.img-in-ratio");

      const url = linkEl?.getAttribute("href") || "";
      const title = titleEl?.textContent?.trim() || "";
      const cover = imgEl?.getAttribute("data-bg") || "";

      // Debug logging
      console.log("[MyMangaCMS] Element extraction:", {
        hasLinkEl: !!linkEl,
        hasTitleEl: !!titleEl,
        hasImgEl: !!imgEl,
        url: url.substring(0, 50),
        title: title.substring(0, 30),
        cover: cover.substring(0, 50),
      });

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    const hasNextPage =
      doc.querySelector(
        "div.pagination_wrap a.paging_item:last-of-type:not(.disabled)"
      ) !== null;

    console.log(
      `[MyMangaCMS] getLatest found ${manga.length} manga, hasNext: ${hasNextPage}`
    );
    if (manga.length > 0) {
      console.log(
        "[MyMangaCMS] Sample cover URL:",
        manga[0].cover?.substring(0, 80)
      );
    }

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  /**
   * Get manga details
   */
  async getMangaDetails(url: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const title = doc.text(".series-name") || "";

    // Extract thumbnail from background-image CSS
    const thumbStyle = doc.attr("div.content.img-in-ratio", "style") || "";
    const bgMatch = thumbStyle.match(/url\(['"]?(.*?)['"]?\)/);
    const cover = bgMatch ? bgMatch[1] : "";

    // Parse info items
    let author = "";
    let alternativeNames = "";
    let status: MangaDetails["status"] = "Unknown";

    doc.selectAll(".info-item", (el) => {
      const nameEl = el.querySelector(".info-name");
      const valueEl = el.querySelector(".info-value");
      const label = nameEl?.textContent?.trim() || "";
      const value = valueEl?.textContent?.trim() || "";

      if (label.includes(this.parseAuthorString)) {
        author = value;
      } else if (label.includes(this.parseAlternativeNameString)) {
        alternativeNames += value + ", ";
      } else if (label.includes(this.parseAlternative2ndNameString)) {
        alternativeNames += value + ", ";
      } else if (label.includes(this.parseStatusString)) {
        status = this.parseStatus(value);
      }
    });

    // Clean alternative names
    if (alternativeNames) {
      alternativeNames = this.removeGenericWordsFromName(alternativeNames);
    }

    // Description
    const descriptionEl = doc.querySelector(".summary-content");
    let description = descriptionEl?.textContent?.trim() || "";

    // Prepend alternative names if present
    if (alternativeNames) {
      description = `${this.parseAlternativeNameString}: ${alternativeNames}\n\n${description}`;
    }

    // Genres
    const genres = doc.textAll("a[href*=the-loai] span.badge");

    return {
      id: this.getMangaIdFromUrl(url),
      title,
      cover: this.absoluteUrl(cover),
      url,
      author,
      description,
      genres,
      status,
      sourceId: this.id,
    };
  }

  /**
   * Get chapter list
   */
  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    // Extract scanlator
    const scanlatorEl = doc.querySelector("div.fantrans-value a");
    const scanlatorText = scanlatorEl?.textContent?.trim().toLowerCase();
    const scanlator =
      scanlatorText && scanlatorText !== "đang cập nhật"
        ? scanlatorEl?.textContent?.trim()
        : undefined;

    const chapters: Chapter[] = doc.selectAll(this.chapterSelector, (el) => {
      const chapterUrl = el.getAttribute("href") || "";
      const nameEl = el.querySelector("div.chapter-name");
      const timeEl = el.querySelector("div.chapter-time");

      const chapterTitle = nameEl?.textContent?.trim() || "";
      const dateText = timeEl?.textContent?.trim() || "";

      return {
        id: this.getMangaIdFromUrl(chapterUrl),
        mangaId: this.getMangaIdFromUrl(mangaUrl),
        number: this.extractChapterNumber(chapterTitle),
        title: chapterTitle,
        url: this.absoluteUrl(chapterUrl),
        date: this.parseDateUpdated(dateText),
        scanlator,
      };
    });

    return chapters.filter((ch) => ch.url);
  }

  /**
   * Get page list for chapter
   */
  async getPageList(chapterUrl: string): Promise<Page[]> {
    const html = await this.fetchHtml(chapterUrl);
    const doc = this.parseHtml(html);

    const pages = doc
      .selectAll("div#chapter-content img", (el, index) => {
        const src = el.getAttribute("data-src") || el.getAttribute("src") || "";

        if (!src) return null;

        const page: Page = {
          index,
          imageUrl: this.absoluteUrl(src),
          headers: this.getImageHeaders(),
        };

        return page;
      })
      .filter((p): p is Page => p !== null);

    return pages;
  }

  /**
   * Extract chapter number from title
   */
  protected extractChapterNumber(title: string): number {
    const lowerTitle = title.toLowerCase();

    // Match floating point numbers
    const match = title.match(/([+-]?(?:[0-9]*[.])?[0-9]+)/);

    if (lowerTitle.startsWith("vol")) {
      // For volume-based, try to get second number
      const matches = title.match(/([+-]?(?:[0-9]*[.])?[0-9]+)/g);
      if (matches && matches.length > 1) {
        return parseFloat(matches[1]);
      }
    }

    return match ? parseFloat(match[1]) : -1;
  }

  /**
   * Parse status string
   */
  protected parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase().trim();
    if (lower === this.parseStatusOngoingStringLowerCase) return "Ongoing";
    if (lower === this.parseStatusOnHoldStringLowerCase) return "Hiatus";
    if (lower === this.parseStatusCompletedStringLowerCase) return "Completed";
    return "Unknown";
  }

  /**
   * Remove generic words from name
   */
  protected removeGenericWordsFromName(name: string): string {
    return name
      .split(" ")
      .filter((word) => !this.removeGenericWords.includes(word.toLowerCase()))
      .join(" ")
      .trim();
  }
}
