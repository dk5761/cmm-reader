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
 * MangaKatana Source Implementation
 * Ported from Tachiyomi keiyoushi/extensions-source
 * URL: https://mangakatana.com
 */
export class MangaKatanaSource extends Source {
  readonly config: SourceConfig = {
    id: "mangakatana",
    name: "MangaKatana",
    baseUrl: "https://mangakatana.com",
    language: "en",
    nsfw: false,
  };

  private readonly selectors = {
    // Manga list items
    mangaItem: "div#book_list > div.item",
    mangaTitle: "div.text > h3 > a",
    mangaThumbnail: "img",

    // Manga details
    detailAuthor: ".author",
    detailDescription: ".summary > p",
    detailAltName: ".alt_name",
    detailStatus: ".value.status",
    detailGenres: ".genres > a",
    detailThumbnail: "div.media div.cover img",

    // Chapters
    chapterRow: "tr:has(.chapter)",
    chapterLink: "a",
    chapterDate: ".update_time",

    // Pagination
    nextPage: "a.next.page-numbers",
  };

  async getLatest(page = 1): Promise<SearchResult> {
    const url = `/page/${page}`;
    return this.parseMangaList(url);
  }

  async getPopular(page = 1): Promise<SearchResult> {
    // MangaKatana's "popular" is actually alphabetical
    const url = `/manga/page/${page}`;
    return this.parseMangaList(url);
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    const url = `/page/${page}?search=${encodeURIComponent(
      query
    )}&search_by=book_name`;
    const html = await this.fetchHtml(url);

    // Check if redirected to single manga page
    if (html.includes('class="heading"') && html.includes("div.media")) {
      return this.parseSingleMangaResult(html);
    }

    return this.parseMangaListFromHtml(html);
  }

  private async parseMangaList(url: string): Promise<SearchResult> {
    const html = await this.fetchHtml(url);
    return this.parseMangaListFromHtml(html);
  }

  private parseMangaListFromHtml(html: string): SearchResult {
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc
      .selectAll(this.selectors.mangaItem, (el) => {
        const titleEl = el.querySelector(this.selectors.mangaTitle);
        const imgEl = el.querySelector(this.selectors.mangaThumbnail);

        const mangaUrl = titleEl?.getAttribute("href") || "";
        const title = titleEl?.textContent?.trim() || "";
        const cover = imgEl?.getAttribute("src") || "";

        return {
          id: this.getMangaIdFromUrl(mangaUrl),
          title,
          cover: this.absoluteUrl(cover),
          url: this.absoluteUrl(mangaUrl),
          sourceId: this.id,
        };
      })
      .filter((m) => m.url && m.title);

    const hasNextPage = doc.querySelector(this.selectors.nextPage) !== null;

    return { manga, hasNextPage };
  }

  private parseSingleMangaResult(html: string): SearchResult {
    const doc = this.parseHtml(html);

    const title = doc.querySelector("h1.heading")?.textContent?.trim() || "";
    const cover =
      doc.querySelector(this.selectors.detailThumbnail)?.getAttribute("src") ||
      "";

    // Extract URL from og:url meta or current page
    const urlMeta = doc.querySelector('meta[property="og:url"]');
    const mangaUrl = urlMeta?.getAttribute("content") || "";

    if (!title || !mangaUrl) {
      return { manga: [], hasNextPage: false };
    }

    const manga: Manga = {
      id: this.getMangaIdFromUrl(mangaUrl),
      title,
      cover: this.absoluteUrl(cover),
      url: this.absoluteUrl(mangaUrl),
      sourceId: this.id,
    };

    return { manga: [manga], hasNextPage: false };
  }

  async getMangaDetails(mangaUrl: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const title = doc.querySelector("h1.heading")?.textContent?.trim() || "";

    const author =
      doc
        .querySelectorAll(this.selectors.detailAuthor)
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(", ") || undefined;

    const descriptionEl = doc.querySelector(this.selectors.detailDescription);
    let description = descriptionEl?.textContent?.trim() || "";

    // Add alt names if present
    const altName = doc
      .querySelector(this.selectors.detailAltName)
      ?.textContent?.trim();
    if (altName) {
      description += `\n\nAlt name(s): ${altName}`;
    }

    const cover =
      doc.querySelector(this.selectors.detailThumbnail)?.getAttribute("src") ||
      "";

    const genres = doc
      .querySelectorAll(this.selectors.detailGenres)
      .map((el) => el.textContent?.trim())
      .filter(Boolean) as string[];

    const statusText =
      doc.querySelector(this.selectors.detailStatus)?.textContent?.trim() || "";
    const status = this.parseStatus(statusText);

    return {
      id: this.getMangaIdFromUrl(mangaUrl),
      title,
      cover: this.absoluteUrl(cover),
      url: this.absoluteUrl(mangaUrl),
      sourceId: this.id,
      author,
      description,
      genres,
      status,
    };
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const chapters: Chapter[] = doc
      .selectAll(this.selectors.chapterRow, (el) => {
        const linkEl = el.querySelector(this.selectors.chapterLink);
        const dateEl = el.querySelector(this.selectors.chapterDate);

        const chapterUrl = linkEl?.getAttribute("href") || "";
        const chapterTitle = linkEl?.textContent?.trim() || "";
        const dateText = dateEl?.textContent?.trim() || "";

        return {
          id: this.getChapterIdFromUrl(chapterUrl),
          mangaId: this.getMangaIdFromUrl(mangaUrl),
          number: this.parseChapterNumber(chapterTitle),
          title: chapterTitle,
          url: this.absoluteUrl(chapterUrl),
          date: dateText,
        };
      })
      .filter((ch) => ch.url);

    return chapters;
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    const html = await this.fetchHtml(chapterUrl);

    // Find script containing image data
    // Pattern: data-src', arrayName where arrayName is the variable name
    const arrayNameMatch = html.match(/data-src['"]\s*,\s*(\w+)/);
    if (!arrayNameMatch) {
      return [];
    }

    const arrayName = arrayNameMatch[1];

    // Extract array: var arrayName=['url1','url2',...]
    const arrayRegex = new RegExp(
      `var\\s+${arrayName}\\s*=\\s*\\[([^\\]]*)\\]`
    );
    const arrayMatch = html.match(arrayRegex);
    if (!arrayMatch) {
      return [];
    }

    // Parse URLs from array content: 'url1','url2'
    const urlMatches = arrayMatch[1].match(/'([^']+)'/g);
    if (!urlMatches) {
      return [];
    }

    const pages: Page[] = urlMatches.map((urlStr, index) => {
      // Remove quotes
      const imageUrl = urlStr.replace(/'/g, "");
      return {
        index,
        imageUrl,
        headers: {
          Referer: this.baseUrl,
        },
      };
    });

    return pages;
  }

  private parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase();
    if (lower.includes("completed")) return "Completed";
    if (lower.includes("ongoing")) return "Ongoing";
    return "Unknown";
  }

  private getChapterIdFromUrl(url: string): string {
    const cleaned = url.replace(/\/$/, "");
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  }

  protected override getMangaIdFromUrl(url: string): string {
    const cleaned = url.replace(/\/$/, "");
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  }
}
