import { MyMangaCMS } from "../base/MyMangaCMS";
import type { SourceConfig } from "../base/types";

/**
 * Manhwa18.net Source
 * Adult manga/manhwa source using MyMangaCMS framework
 */
export class Manhwa18NetSource extends MyMangaCMS {
  readonly config: SourceConfig = {
    id: "manhwa18net",
    name: "Manhwa18.net",
    baseUrl: "https://manhwa18.net",
    language: "en",
    nsfw: true,
  };

  // Version ID for migration tracking
  readonly versionId = 2;

  // English language overrides
  protected parseAuthorString = "Author";
  protected parseAlternativeNameString = "Other name";
  protected parseAlternative2ndNameString = "Doujinshi";
  protected parseStatusString = "Status";
  protected parseStatusOngoingStringLowerCase = "on going";
  protected parseStatusOnHoldStringLowerCase = "on hold";
  protected parseStatusCompletedStringLowerCase = "completed";

  /**
   * Parse date format: "XX - MM/DD/YYYY"
   * Extracts the date after the dash
   */
  protected parseDateUpdated(date: string): string {
    if (!date) return "";

    // Format is typically "XX - MM/DD/YYYY"
    const parts = date.split(" - ");
    if (parts.length > 1) {
      return parts[1].trim();
    }

    return date.trim();
  }

  /**
   * Genre list for Manhwa18.net
   * Extracted from site's search filters
   */
  protected getGenreList() {
    return [
      { name: "Adult", id: 4 },
      { name: "Doujinshi", id: 9 },
      { name: "Harem", id: 17 },
      { name: "Manga", id: 24 },
      { name: "Manhwa", id: 26 },
      { name: "Mature", id: 28 },
      { name: "NTR", id: 33 },
      { name: "Romance", id: 36 },
      { name: "Webtoon", id: 57 },
      { name: "Action", id: 59 },
      { name: "Comedy", id: 60 },
      { name: "BL", id: 61 },
      { name: "Horror", id: 62 },
      { name: "Raw", id: 63 },
      { name: "Uncensore", id: 64 },
    ];
  }
}
