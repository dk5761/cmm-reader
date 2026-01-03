import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../base/types";
import { CookieManagerInstance } from "@/core/http/CookieManager";
import { WebViewFetcherService } from "@/core/http/WebViewFetcherService";

import { HttpClient } from "@/core/http";

/**
 * Kun Manga Source Implementation
 * Based on Madara WordPress Theme
 * URL: https://kunmanga.com
 */
export class KunMangaSource extends Source {
  readonly config: SourceConfig = {
    id: "kunmanga",
    name: "Kun Manga",
    baseUrl: "https://kunmanga.com",
    language: "en",
    nsfw: false,
  };

  // Standard Madara theme uses "manga"
  private readonly mangaSubString = "manga";

  override getImageHeaders(): Record<string, string> {
    return {
      Referer: `${this.baseUrl}/`,
      "User-Agent": HttpClient.getUserAgent(),
    };
  }

  // Selectors based on Madara WordPress theme
  private readonly selectors = {
    // Popular/Latest listing
    mangaList: "div.page-item-detail.manga, div.c-tabs-item__content",
    mangaTitle: "div.post-title a, h3.h5 a",
    mangaThumbnail: "img",

    // Search results
    searchItem: "div.c-tabs-item__content, div.row.c-tabs-item__content",

    // Manga details page
    detailTitle: "div.post-title h1, div.post-title h3",
    detailAuthor: "div.author-content > a",
    detailArtist: "div.artist-content > a",
    detailDescription:
      "div.description-summary div.summary__content, div.summary_content div.post-content_item > h5 + div",
    detailThumbnail: "div.summary_image img",
    detailGenres: "div.genres-content a",
    detailStatus: "div.summary-content",

    // Chapter list
    chapterList: "li.wp-manga-chapter",
    chapterLink: "a",
    chapterDate: "span.chapter-release-date",

    // Page reader
    pageImages: "div.page-break img, .reading-content img",
  };

  /**
   * Extract image URL from element, checking multiple attributes
   */
  private getImageUrl(element: any): string {
    const attrs = ["data-src", "data-lazy-src", "data-cfsrc", "src"];
    for (const attr of attrs) {
      const val = element?.getAttribute(attr);
      if (val && !val.includes("data:image")) {
        return this.absoluteUrl(val.trim());
      }
    }
    return "";
  }

  async getPopular(page = 1): Promise<SearchResult> {
    const url = `/${this.mangaSubString}/${
      page > 1 ? `page/${page}/` : ""
    }?m_orderby=views`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga = doc
      .selectAll(this.selectors.mangaList, (el) => {
        const titleEl = el.querySelector(this.selectors.mangaTitle);
        const imgEl = el.querySelector(this.selectors.mangaThumbnail);

        const mangaUrl = titleEl?.getAttribute("href") || "";
        const title = titleEl?.textContent?.trim() || "";
        const cover = this.getImageUrl(imgEl);

        return {
          id: this.getMangaIdFromUrl(mangaUrl),
          title,
          cover,
          url: this.absoluteUrl(mangaUrl),
          sourceId: this.id,
        };
      })
      .filter((m) => m.url && m.title);

    const hasNextPage =
      doc.querySelector("a.nextpostslink, div.nav-previous") !== null;
    return { manga, hasNextPage };
  }

  async getLatest(page = 1): Promise<SearchResult> {
    const url = `/${this.mangaSubString}/${
      page > 1 ? `page/${page}/` : ""
    }?m_orderby=latest`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga = doc
      .selectAll(this.selectors.mangaList, (el) => {
        const titleEl = el.querySelector(this.selectors.mangaTitle);
        const imgEl = el.querySelector(this.selectors.mangaThumbnail);

        const mangaUrl = titleEl?.getAttribute("href") || "";
        const title = titleEl?.textContent?.trim() || "";
        const cover = this.getImageUrl(imgEl);

        return {
          id: this.getMangaIdFromUrl(mangaUrl),
          title,
          cover,
          url: this.absoluteUrl(mangaUrl),
          sourceId: this.id,
        };
      })
      .filter((m) => m.url && m.title);

    const hasNextPage =
      doc.querySelector("a.nextpostslink, div.nav-previous") !== null;
    return { manga, hasNextPage };
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    const searchUrl = `/${
      page > 1 ? `page/${page}/` : ""
    }?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    const html = await this.fetchHtml(searchUrl);
    const doc = this.parseHtml(html);

    const manga: Manga[] = doc
      .selectAll(this.selectors.searchItem, (el) => {
        const titleEl = el.querySelector(this.selectors.mangaTitle);
        const imgEl = el.querySelector(this.selectors.mangaThumbnail);

        const mangaUrl = titleEl?.getAttribute("href") || "";
        const title = titleEl?.textContent?.trim() || "";
        const cover = this.getImageUrl(imgEl);

        return {
          id: this.getMangaIdFromUrl(mangaUrl),
          title,
          cover,
          url: this.absoluteUrl(mangaUrl),
          sourceId: this.id,
        };
      })
      .filter((m) => m.url && m.title);

    // Check for next page
    const hasNextPage =
      doc.querySelector("a.nextpostslink, div.nav-previous") !== null;

    return { manga, hasNextPage };
  }

  async getMangaDetails(mangaUrl: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    const title =
      doc.querySelector(this.selectors.detailTitle)?.textContent?.trim() || "";

    const author =
      doc
        .querySelectorAll(this.selectors.detailAuthor)
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(", ") || undefined;

    const artist =
      doc
        .querySelectorAll(this.selectors.detailArtist)
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(", ") || undefined;

    const descriptionEl = doc.querySelector(this.selectors.detailDescription);
    const description = descriptionEl?.textContent?.trim() || "";

    const thumbnailEl = doc.querySelector(this.selectors.detailThumbnail);
    const cover = this.getImageUrl(thumbnailEl);

    const genres = doc
      .querySelectorAll(this.selectors.detailGenres)
      .map((el) => el.textContent?.trim())
      .filter(Boolean) as string[];

    const statusText =
      doc
        .querySelector(this.selectors.detailStatus)
        ?.textContent?.toLowerCase() || "";
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
      genres,
      status,
    };
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    // First, get the manga page to check for chapter container
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    // Check if chapters are on the page
    let chapterHtml = html;
    const chaptersHolder = doc.querySelector("div[id^=manga-chapters-holder]");

    if (chaptersHolder) {
      // Chapters need to be fetched via AJAX
      // POST to /manga-slug/ajax/chapters/
      const mangaUrlClean = mangaUrl.endsWith("/")
        ? mangaUrl.slice(0, -1)
        : mangaUrl;
      const ajaxUrl = `${mangaUrlClean}/ajax/chapters/`;

      try {
        // Use WebView for POST to maintain CF bypass fingerprint
        chapterHtml = await WebViewFetcherService.postHtml(
          ajaxUrl,
          "", // empty body
          {
            "X-Requested-With": "XMLHttpRequest",
            Referer: this.baseUrl + "/",
            "Content-Type": "application/x-www-form-urlencoded",
          }
        );
      } catch (e) {
        console.warn("[KunManga] Failed to fetch chapters via AJAX:", e);
      }
    }

    // Parse chapters - use regex for AJAX response fragments
    const chapters: Chapter[] = [];

    // Match each <li class="wp-manga-chapter"> block
    const chapterRegex =
      /<li[^>]*class="[^"]*wp-manga-chapter[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;

    while ((match = chapterRegex.exec(chapterHtml)) !== null) {
      const liContent = match[1];

      // Extract href and title from <a> tag
      const linkMatch = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(
        liContent
      );
      if (!linkMatch) continue;

      const chapterUrl = linkMatch[1].trim();
      const chapterTitle = linkMatch[2].replace(/<[^>]+>/g, "").trim();

      // Extract date from <span class="chapter-release-date">
      const dateMatch =
        /<span[^>]*class="[^"]*chapter-release-date[^"]*"[^>]*>[\s\S]*?<i>([^<]+)<\/i>/i.exec(
          liContent
        );
      const dateText = dateMatch ? dateMatch[1].trim() : "";

      if (!chapterUrl) continue;

      // Append ?style=list for vertical reading
      const finalUrl = chapterUrl.includes("?")
        ? chapterUrl
        : `${chapterUrl}?style=list`;

      chapters.push({
        id: this.getChapterIdFromUrl(chapterUrl),
        mangaId: this.getMangaIdFromUrl(mangaUrl),
        number: this.parseChapterNumber(chapterTitle),
        title: chapterTitle,
        url: this.absoluteUrl(finalUrl),
        date: dateText,
      });
    }

    return chapters.filter((ch) => ch.url);
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    const html = await this.fetchHtml(chapterUrl);
    const doc = this.parseHtml(html);

    // Get cookies for image requests
    const domain = new URL(this.baseUrl).hostname;
    const cookies = await CookieManagerInstance.getCookies(domain);

    const pages: Page[] = doc.selectAll(
      this.selectors.pageImages,
      (el, index) => {
        const imageUrl = this.getImageUrl(el);

        return {
          index,
          imageUrl,
          headers: {
            Referer: this.baseUrl,
            "User-Agent": HttpClient.getUserAgent(),
            ...(cookies && { Cookie: cookies }),
          },
        };
      }
    );

    // Filter out empty/invalid pages and ad images
    const adPatterns = [
      /sponsor/i,
      /banner/i,
      /advert/i,
      /promo/i,
      /toffee/i,
      /doubleclick/i,
      /googlesyndication/i,
    ];

    return pages
      .filter((p) => p.imageUrl)
      .filter((p) => !adPatterns.some((pattern) => pattern.test(p.imageUrl)));
  }

  private parseStatus(text: string): MangaDetails["status"] {
    if (text.includes("completed") || text.includes("end")) return "Completed";
    if (text.includes("ongoing") || text.includes("updating")) return "Ongoing";
    if (
      text.includes("hiatus") ||
      text.includes("hold") ||
      text.includes("canceled") ||
      text.includes("dropped")
    )
      return "Hiatus";
    return "Unknown";
  }

  protected override parseChapterNumber(title: string): number {
    const match = title.match(/chapter\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  protected getChapterIdFromUrl(url: string): string {
    const cleaned = url.replace(/\/$/, "").replace(/\?.*$/, "");
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  }

  protected override getMangaIdFromUrl(url: string): string {
    const cleaned = url.replace(/\/$/, "");
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  }
}
