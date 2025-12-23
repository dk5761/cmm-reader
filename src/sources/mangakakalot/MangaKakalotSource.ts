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
 * MangaKakalot Source Implementation
 * Based on Tachiyomi MangaBox multisrc
 * URL: https://www.mangakakalot.gg
 */
export class MangaKakalotSource extends Source {
  readonly config: SourceConfig = {
    id: "mangakakalot",
    name: "MangaKakalot",
    baseUrl: "https://www.mangakakalot.gg",
    language: "en",
    nsfw: false,
    needsCloudflareBypass: false,
  };

  // Selectors from Tachiyomi MangaBox
  private readonly popularSelector =
    "div.truyen-list > div.list-truyen-item-wrap, div.comic-list > .list-comic-item-wrap";
  private readonly searchSelector =
    ".panel_story_list .story_item, div.list-truyen-item-wrap, div.list-comic-item-wrap";
  private readonly chapterSelector =
    "div.chapter-list div.row, ul.row-content-chapter li";

  // Preferred CDN - rewrite all image URLs to use this working CDN
  private readonly preferredCdn = "imgs-2.2xstorage.com";

  /**
   * Rewrite image URL to use the preferred/working CDN
   */
  private rewriteToCdn(url: string): string {
    if (!url) return url;
    try {
      const parsed = new URL(url);
      // Only rewrite 2xstorage.com URLs
      if (parsed.host.includes("2xstorage.com")) {
        parsed.host = this.preferredCdn;
        return parsed.toString();
      }
    } catch {
      // Invalid URL, return as-is
    }
    return url;
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    // Normalize query: replace spaces with underscores
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, "_");
    const searchUrl = `/search/story/${encodeURIComponent(
      normalizedQuery
    )}?page=${page}`;
    const html = await this.fetchHtml(searchUrl);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.searchSelector, (el) => {
      const linkEl = el.querySelector("h3 a") || el.querySelector("a");
      const imgEl = el.querySelector("img");

      const url = linkEl?.getAttribute("href") || "";
      const title = linkEl?.textContent?.trim() || "";
      const cover = imgEl?.getAttribute("src") || "";

      return {
        id: this.getMangaIdFromUrl(url),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(url),
        sourceId: this.id,
      };
    });

    // Check for next page: a.page_select + a:not(.page_last)
    const hasNextPage =
      doc.querySelector("a.page_select + a:not(.page_last)") !== null ||
      doc.querySelector("a.page-select + a:not(.page-last)") !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getPopular(page = 1): Promise<SearchResult> {
    const url = `/manga-list/hot-manga?page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.popularSelector, (el) => {
      const linkEl = el.querySelector("h3 a") || el.querySelector("a");
      const imgEl = el.querySelector("img");

      const mangaUrl = linkEl?.getAttribute("href") || "";
      const title = linkEl?.textContent?.trim() || "";
      const cover =
        imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

      console.log("[MangaKakalot] Cover URL:", cover, "Title:", title);

      return {
        id: this.getMangaIdFromUrl(mangaUrl),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(mangaUrl),
        sourceId: this.id,
      };
    });

    // Check for next page
    const hasNextPage =
      doc.querySelector("div.group_page") !== null ||
      doc.querySelector(
        "div.group-page a:not([href]) + a:not(:contains(Last))"
      ) !== null;

    console.log("[MangaKakalot] Popular results:", manga.length, "titles");

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getLatest(page = 1): Promise<SearchResult> {
    const url = `/manga-list/latest-manga?page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc.selectAll(this.popularSelector, (el) => {
      const linkEl = el.querySelector("h3 a") || el.querySelector("a");
      const imgEl = el.querySelector("img");

      const mangaUrl = linkEl?.getAttribute("href") || "";
      const title = linkEl?.textContent?.trim() || "";
      const cover = imgEl?.getAttribute("src") || "";

      return {
        id: this.getMangaIdFromUrl(mangaUrl),
        title,
        cover: this.absoluteUrl(cover),
        url: this.absoluteUrl(mangaUrl),
        sourceId: this.id,
      };
    });

    const hasNextPage = doc.querySelector("div.group_page") !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getMangaDetails(url: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    // Selectors from MangaBox
    const mainSelector = "div.manga-info-top, div.panel-story-info";
    const mainEl = doc.querySelector(mainSelector);

    const title =
      doc.text("h1") || doc.text("h2") || doc.text(".story-info-right h1");
    const cover =
      doc.src("div.manga-info-pic img") ||
      doc.src("span.info-image img") ||
      doc.src(".story-info-left .info-image img");

    // Author: li:contains(author) a
    const author =
      doc.text("li:contains(Author) a") ||
      doc.text("td:contains(Author) + td a") ||
      doc.text(".info-author a");

    // Status
    const statusText =
      doc.text("li:contains(Status)") || doc.text("td:contains(Status) + td");

    // Description
    const description =
      doc.text("div#noidungm") ||
      doc.text("div#panel-story-info-description") ||
      doc.text("div#contentBox") ||
      doc.text(".panel-story-info-description");

    // Genres
    const genres =
      doc.textAll("div.manga-info-top li:contains(Genres) a") ||
      doc.textAll("td:contains(Genres) + td a") ||
      doc.textAll(".info-genres a");

    return {
      id: this.getMangaIdFromUrl(url),
      title,
      cover: this.absoluteUrl(cover),
      url,
      author,
      description: description.replace(/<br\s*\/?>/gi, "\n").trim(),
      genres,
      status: this.parseStatus(statusText),
      sourceId: this.id,
    };
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const chapters: Chapter[] = doc.selectAll(
      this.chapterSelector,
      (el, index) => {
        const linkEl = el.querySelector("a");
        const dateEl =
          el.querySelector("span:last-child") || el.querySelector("span");

        const chapterUrl = linkEl?.getAttribute("href") || "";
        const chapterTitle = linkEl?.textContent?.trim() || "";
        const dateText =
          dateEl?.getAttribute("title") || dateEl?.textContent?.trim();

        return {
          id: this.getMangaIdFromUrl(chapterUrl),
          mangaId: this.getMangaIdFromUrl(mangaUrl),
          number: this.parseChapterNumber(chapterTitle),
          title: chapterTitle,
          url: this.absoluteUrl(chapterUrl),
          date: dateText,
        };
      }
    );

    return chapters.filter((ch) => ch.url);
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    const html = await this.fetchHtml(chapterUrl);
    const doc = this.parseHtml(html);

    // Try multiple selectors for page images
    const selectors = [
      ".container-chapter-reader img",
      "#vungdoc img",
      ".reading-content img",
      ".page-chapter img",
    ];

    let pages: Page[] = [];

    for (const selector of selectors) {
      pages = doc.selectAll(selector, (el, index) => {
        const src =
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          el.getAttribute("data-original") ||
          "";

        return {
          index,
          imageUrl: this.absoluteUrl(src),
          headers: {
            Referer: this.baseUrl,
          },
        };
      });

      if (pages.length > 0) break;
    }

    return pages.filter((p) => p.imageUrl);
  }

  private parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase();
    if (lower.includes("ongoing")) return "Ongoing";
    if (lower.includes("completed")) return "Completed";
    if (lower.includes("hiatus")) return "Hiatus";
    return "Unknown";
  }
}
