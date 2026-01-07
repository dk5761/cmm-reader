import { Platform } from "react-native";
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
import { USER_AGENT } from "@/core/http/userAgent";

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
    logo: require("@/assets/webp/managakakalot.webp"),
    language: "en",
    nsfw: false,
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
      const titleLinkEl = el.querySelector("h3 a");
      const firstLinkEl = el.querySelector("a");
      const imgEl = el.querySelector("img");

      // Title and URL usually come from the h3 link, fallback to first link
      const url = (titleLinkEl || firstLinkEl)?.getAttribute("href") || "";
      const title = (titleLinkEl || firstLinkEl)?.textContent?.trim() || "";

      let cover =
        imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";

      // Fallback: If img extraction failed, the img tag might be escaped text inside the FIRST link
      if (!cover && firstLinkEl) {
        const textContent = firstLinkEl.textContent || "";
        // Look for src="..." in the text content
        const srcMatch = textContent.match(/src="([^"]+)"/);
        if (srcMatch) {
          cover = srcMatch[1];
        } else {
          // Debug log if we still can't find it
          // console.log("Regex failed on:", textContent.substring(0, 100));
        }
      }

      if (!cover) {
        console.log("[MangaKakalot] Missing cover for:", title);
      }

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
      doc.querySelector("a.page_select + a:not(.page_last)") !== null ||
      doc.querySelector("a.page-select + a:not(.page-last)") !== null;

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

    const hasNextPage =
      doc.querySelector("a.page_select + a:not(.page_last)") !== null ||
      doc.querySelector("a.page-select + a:not(.page-last)") !== null;

    return { manga: manga.filter((m) => m.title), hasNextPage };
  }

  async getMangaDetails(url: string): Promise<MangaDetails> {
    console.log("[MangaKakalot] getMangaDetails URL:", url);
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    // Selectors from MangaBox
    const mainSelector = "div.manga-info-top, div.panel-story-info";
    const mainEl = doc.querySelector(mainSelector);

    const title =
      doc.text("h1") || doc.text("h2") || doc.text(".story-info-right h1");
    // Debugging cover extraction
    const picHtml =
      doc.querySelector("div.manga-info-pic")?.toString() ||
      doc.querySelector(".info-image")?.toString() ||
      doc.querySelector(".manga-info-top")?.toString() ||
      "No cover container found";

    console.log(
      "[MangaKakalot] Cover container HTML:",
      picHtml.substring(0, 500)
    );

    let cover =
      doc.attr("div.manga-info-pic img", "src") ||
      doc.attr("div.manga-info-pic img", "data-src") ||
      doc.attr("span.info-image img", "src") ||
      doc.attr("span.info-image img", "data-src") ||
      doc.attr(".story-info-left .info-image img", "src") ||
      doc.attr(".story-info-left .info-image img", "data-src");

    console.log("[MangaKakalot] Extracted cover:", cover);

    // Fallback: If cover is still missing, try to extract from raw HTML if possible
    // or log it. The main view usually has the image clearly.
    if (!cover) {
      // Try regex on the main container just in case
      const mainHtml =
        doc.querySelector(".manga-info-top")?.toString() ||
        doc.querySelector(".panel-story-info")?.toString() ||
        "";
      const srcMatch = mainHtml.match(/<img[^>]+src="([^"]+)"/);
      if (srcMatch) {
        cover = srcMatch[1];
      }
    }

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
    console.log("[MangaKakalot] getPageList - Chapter URL:", chapterUrl);

    const html = await this.fetchHtml(chapterUrl);
    const doc = this.parseHtml(html);

    // Get cookies for image requests
    const cookies = await cookieJar.getCookieString(this.baseUrl);
    console.log(
      "[MangaKakalot] getPageList - Cookies:",
      cookies ? "present" : "none"
    );

    // Try multiple selectors for page images
    const selectors = [
      ".container-chapter-reader img",
      "#vungdoc img",
      ".reading-content img",
      ".page-chapter img",
    ];

    // Common ad URL patterns to filter out
    const adPatterns = [
      /ivy/i,
      /soulmate/i,
      /sponsor/i,
      /banner/i,
      /advert/i,
      /promo/i,
      /toffee\.ai/i,
      /doubleclick/i,
      /googlesyndication/i,
      /adsense/i,
      /zinmanga/i, // Watermark/ad source
      /fantasy/i, // "Live Your Fantasy"
      /explore.*now/i,
      /extreme/i,
      /unbelievable/i,
      /aimodel/i,
      /ai.*model/i,
    ];

    let pages: Page[] = [];
    let matchedSelector = "";

    for (const selector of selectors) {
      pages = doc.selectAll(selector, (el, index) => {
        const src =
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          el.getAttribute("data-original") ||
          "";

        console.log(`[MangaKakalot] getPageList - Page ${index} raw URL:`, src);

        return {
          index,
          imageUrl: this.absoluteUrl(src),
          headers: {
            Referer: `${this.baseUrl}/`,
            "User-Agent": USER_AGENT,
            ...(cookies && { Cookie: cookies }),
          },
        };
      });

      if (pages.length > 0) {
        matchedSelector = selector;
        console.log(
          `[MangaKakalot] getPageList - Matched selector: "${selector}", found ${pages.length} images`
        );
        break;
      }
    }

    if (pages.length === 0) {
      console.log(
        "[MangaKakalot] getPageList - No images found with any selector!"
      );
    }

    // Filter out empty URLs and advertisement images
    const beforeFilterCount = pages.length;
    const filtered = pages
      .filter((p) => p.imageUrl)
      .filter((p) => !adPatterns.some((pattern) => pattern.test(p.imageUrl)));

    console.log(
      `[MangaKakalot] getPageList - After filtering: ${
        filtered.length
      } pages (removed ${beforeFilterCount - filtered.length} ads/empty)`
    );

    filtered.forEach((page, idx) => {
      console.log(`[MangaKakalot] getPageList - Final Page ${idx}:`, {
        url: page.imageUrl,
        hasReferer: !!page.headers?.Referer,
        hasUserAgent: !!page.headers?.["User-Agent"],
        hasCookie: !!page.headers?.Cookie,
      });
    });

    return filtered;
  }

  private parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase();
    if (lower.includes("ongoing")) return "Ongoing";
    if (lower.includes("completed")) return "Completed";
    if (lower.includes("hiatus")) return "Hiatus";
    return "Unknown";
  }
}
