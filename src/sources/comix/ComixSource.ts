import { Source } from "../base/Source";
import { HttpClient } from "@/core/http";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../base/types";
import type {
  ComixManga,
  ComixChapter,
  SearchResponse,
  SingleMangaResponse,
  ChapterDetailsResponse,
  ChapterResponse,
  Poster,
} from "./types";

/**
 * Comix Source Implementation
 * Based on Mihon extension
 * URL: https://comix.to
 */
export class ComixSource extends Source {
  readonly config: SourceConfig = {
    id: "comix",
    name: "Comix",
    baseUrl: "https://comix.to",
    logo: require("@/assets/webp/comix.webp"),
    language: "en",
    nsfw: false, // Has NSFW content but we filter it by default
  };

  private readonly apiUrl = "https://comix.to/api/v2/";

  // NSFW genre IDs to exclude by default
  private readonly NSFW_GENRE_IDS = [
    "87264",
    "8",
    "87265",
    "13",
    "87266",
    "87268",
  ];

  /**
   * Get poster URL with quality fallback
   */
  private getPosterUrl(poster: Poster): string {
    return poster.large || poster.medium || poster.small;
  }

  /**
   * Build API URL with query parameters
   */
  private buildApiUrl(
    endpoint: string,
    params: Record<string, string | number | string[]> = {}
  ): string {
    const url = new URL(endpoint, this.apiUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v.toString()));
      } else {
        url.searchParams.append(key, value.toString());
      }
    });

    return url.toString();
  }

  /**
   * Add NSFW filter params to exclude NSFW content
   */
  private addNsfwFilter(params: Record<string, any>): void {
    if (!params["genres[]"]) {
      params["genres[]"] = [];
    }
    const genres = Array.isArray(params["genres[]"])
      ? params["genres[]"]
      : [params["genres[]"]];

    this.NSFW_GENRE_IDS.forEach((id) => {
      genres.push(`-${id}`);
    });

    params["genres[]"] = genres;
  }

  /**
   * Map Comix manga to app Manga type
   */
  private mapToManga(manga: ComixManga): Manga {
    return {
      id: manga.hash_id,
      title: manga.title,
      cover: this.absoluteUrl(this.getPosterUrl(manga.poster)),
      url: `/${manga.hash_id}`,
      sourceId: this.id,
    };
  }

  /**
   * Map Comix manga to app MangaDetails type
   */
  private mapToMangaDetails(manga: ComixManga): MangaDetails {
    // Build genres list
    const genres: string[] = [];

    // Add type
    const typeMap: Record<string, string> = {
      manhwa: "Manhwa",
      manhua: "Manhua",
      manga: "Manga",
    };
    if (manga.type && typeMap[manga.type]) {
      genres.push(typeMap[manga.type]);
    }

    // Add genre terms
    manga.genre?.forEach((g) => genres.push(g.title));
    manga.theme?.forEach((t) => genres.push(t.title));
    manga.demographic?.forEach((d) => genres.push(d.title));

    // Add NSFW tag if applicable
    if (manga.is_nsfw) {
      genres.push("NSFW");
    }

    return {
      id: manga.hash_id,
      title: manga.title,
      cover: this.absoluteUrl(this.getPosterUrl(manga.poster)),
      url: `/${manga.hash_id}`,
      author: manga.author?.map((a) => a.title).join(", "),
      description: manga.synopsis || "",
      genres,
      status: this.parseStatus(manga.status),
      sourceId: this.id,
    };
  }

  /**
   * Parse Comix status to app status
   */
  private parseStatus(status: string): MangaDetails["status"] {
    switch (status) {
      case "releasing":
        return "Ongoing";
      case "finished":
        return "Completed";
      case "on_hiatus":
        return "Hiatus";
      case "discontinued":
        return "Unknown";
      default:
        return "Unknown";
    }
  }

  /**
   * Map Comix chapter to app Chapter type
   */
  private mapToChapter(chapter: ComixChapter, mangaId: string): Chapter {
    // Build chapter title
    const numberStr = chapter.number.toString().replace(".0", "");
    let title = `Chapter ${numberStr}`;
    if (chapter.name) {
      title += `: ${chapter.name}`;
    }

    // Determine scanlator
    let scanlator = "Unknown";
    if (chapter.scanlation_group?.name) {
      scanlator = chapter.scanlation_group.name;
    } else if (chapter.is_official === 1) {
      scanlator = "Official";
    }

    // Format date: Unix timestamp -> "Jan 13, 2026"
    const date = new Date(chapter.updated_at * 1000);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      id: chapter.chapter_id.toString(),
      mangaId,
      number: chapter.number,
      title,
      url: `title/${mangaId}/${chapter.chapter_id}`,
      date: formattedDate,
      scanlator,
    };
  }

  /**
   * Deduplicate chapters - prefer official, then votes, then date
   */
  private deduplicateChapters(chapters: ComixChapter[]): ComixChapter[] {
    const chapterMap = new Map<number, ComixChapter>();

    chapters.forEach((ch) => {
      const existing = chapterMap.get(ch.number);

      if (!existing) {
        chapterMap.set(ch.number, ch);
        return;
      }

      // Check if new chapter is official
      const newIsOfficial =
        ch.is_official === 1 || ch.scanlation_group_id === 9275;
      const existingIsOfficial =
        existing.is_official === 1 || existing.scanlation_group_id === 9275;

      let useCurrent = false;

      if (newIsOfficial && !existingIsOfficial) {
        useCurrent = true;
      } else if (!newIsOfficial && existingIsOfficial) {
        useCurrent = false;
      } else {
        // Both official or both unofficial - compare votes then date
        if (ch.votes > existing.votes) {
          useCurrent = true;
        } else if (ch.votes < existing.votes) {
          useCurrent = false;
        } else {
          // Same votes - use more recent
          useCurrent = ch.updated_at > existing.updated_at;
        }
      }

      if (useCurrent) {
        chapterMap.set(ch.number, ch);
      }
    });

    return Array.from(chapterMap.values());
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    const params: Record<string, any> = {
      limit: "50",
      page: page.toString(),
    };

    if (query.trim()) {
      params.keyword = query;
      params["order[relevance]"] = "desc";
    } else {
      params["order[views_30d]"] = "desc";
    }

    // Add NSFW filter
    this.addNsfwFilter(params);

    const url = this.buildApiUrl("manga", params);
    const json = await HttpClient.getJson<SearchResponse>(url, {
      headers: {
        Referer: `${this.baseUrl}/`,
      },
    });

    const manga = json.result.items.map((m) => this.mapToManga(m));
    const hasNextPage =
      json.result.pagination.current_page < json.result.pagination.last_page;

    return { manga, hasNextPage };
  }

  async getPopular(page = 1): Promise<SearchResult> {
    return this.search("", page);
  }

  async getLatest(page = 1): Promise<SearchResult> {
    const params: Record<string, any> = {
      "order[chapter_updated_at]": "desc",
      limit: "50",
      page: page.toString(),
    };

    // Add NSFW filter
    this.addNsfwFilter(params);

    const url = this.buildApiUrl("manga", params);
    const json = await HttpClient.getJson<SearchResponse>(url, {
      headers: {
        Referer: `${this.baseUrl}/`,
      },
    });

    const manga = json.result.items.map((m) => this.mapToManga(m));
    const hasNextPage =
      json.result.pagination.current_page < json.result.pagination.last_page;

    return { manga, hasNextPage };
  }

  async getMangaDetails(url: string): Promise<MangaDetails> {
    // Extract hash_id from URL
    const hashId = url.replace(/^\//, "").split("/")[0];

    const apiUrl = this.buildApiUrl(`manga/${hashId}`, {
      "includes[]": [
        "demographic",
        "genre",
        "theme",
        "author",
        "artist",
        "publisher",
      ],
    });

    const json = await HttpClient.getJson<SingleMangaResponse>(apiUrl, {
      headers: {
        Referer: `${this.baseUrl}/`,
      },
    });

    return this.mapToMangaDetails(json.result);
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    // Extract hash_id from URL
    const hashId = mangaUrl.replace(/^\//, "").split("/")[0];

    let allChapters: ComixChapter[] = [];
    let currentPage = 1;
    let hasMore = true;

    // Fetch all pages
    while (hasMore) {
      const url = this.buildApiUrl(`manga/${hashId}/chapters`, {
        "order[number]": "desc",
        limit: "100",
        page: currentPage.toString(),
      });

      const json = await HttpClient.getJson<ChapterDetailsResponse>(url, {
        headers: {
          Referer: `${this.baseUrl}/`,
        },
      });

      allChapters.push(...json.result.items);

      hasMore =
        json.result.pagination.current_page < json.result.pagination.last_page;
      currentPage++;
    }

    // Deduplicate chapters
    const deduplicated = this.deduplicateChapters(allChapters);

    // Map to app Chapter type
    return deduplicated.map((ch) => this.mapToChapter(ch, hashId));
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    // Extract chapter_id from URL: title/{hash_id}/{chapter_id}
    const parts = chapterUrl.split("/");
    const chapterId = parts[parts.length - 1];

    const url = this.buildApiUrl(`chapters/${chapterId}`, {});

    const json = await HttpClient.getJson<ChapterResponse>(url, {
      headers: {
        Referer: `${this.baseUrl}/`,
      },
    });

    if (!json.result?.images) {
      throw new Error(`No images found for chapter ${chapterId}`);
    }

    return json.result.images.map((img, index) => ({
      index,
      imageUrl: img.url,
      headers: {
        Referer: `${this.baseUrl}/`,
      },
    }));
  }

  /**
   * Override to extract hash_id from various URL formats
   */
  protected getMangaIdFromUrl(url: string): string {
    const cleaned = url.replace(/^\//, "");
    const parts = cleaned.split("/");
    return parts[0] || url;
  }
}
