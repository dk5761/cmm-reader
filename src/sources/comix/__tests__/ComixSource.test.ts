import { ComixSource } from "../ComixSource";
import { HttpClient } from "@/core/http";
import {
  mockComixSearchResponse,
  mockComixManga,
  mockComixChapterList,
  mockComixPageList,
  mockDuplicateChapters,
} from "@/__tests__/fixtures/comix";

// Mock HttpClient
jest.mock("@/core/http", () => ({
  HttpClient: {
    getJson: jest.fn(),
    getText: jest.fn(),
  },
}));

describe("ComixSource", () => {
  let source: ComixSource;
  const mockGetJson = HttpClient.getJson as jest.Mock;

  beforeEach(() => {
    source = new ComixSource();
    jest.clearAllMocks();
  });

  describe("Config", () => {
    it("should have correct source configuration", () => {
      expect(source.config.id).toBe("comix");
      expect(source.config.name).toBe("Comix");
      expect(source.config.baseUrl).toBe("https://comix.to");
      expect(source.config.language).toBe("en");
    });
  });

  describe("search", () => {
    it("should search with keyword and return results", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      const result = await source.search("test manga", 1);

      // Spaces are encoded as + in query params
      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("keyword=test+manga"),
        expect.any(Object)
      );
      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("order%5Brelevance%5D=desc"),
        expect.any(Object)
      );
      expect(result.manga).toHaveLength(1);
      expect(result.manga[0].title).toBe("Test Manga Title");
      expect(result.hasNextPage).toBe(true);
    });

    it("should exclude NSFW genres in search", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      await source.search("test", 1);

      const callUrl = mockGetJson.mock.calls[0][0];
      // URL encoded: genres%5B%5D = genres[]
      expect(callUrl).toContain("genres%5B%5D=-87264");
      expect(callUrl).toContain("genres%5B%5D=-8");
      expect(callUrl).toContain("genres%5B%5D=-87265");
      expect(callUrl).toContain("genres%5B%5D=-13");
      expect(callUrl).toContain("genres%5B%5D=-87266");
      expect(callUrl).toContain("genres%5B%5D=-87268");
    });

    it("should handle pagination correctly", async () => {
      mockGetJson.mockResolvedValue({
        result: {
          items: [mockComixManga],
          pagination: { current_page: 5, last_page: 5 },
        },
      });

      const result = await source.search("test", 5);

      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("page=5"),
        expect.any(Object)
      );
      expect(result.hasNextPage).toBe(false);
    });

    it("should handle empty search query as popular", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      await source.search("", 1);

      const callUrl = mockGetJson.mock.calls[0][0];
      // URL encoded: order%5Bviews_30d%5D = order[views_30d]
      expect(callUrl).toContain("order%5Bviews_30d%5D=desc");
      expect(callUrl).not.toContain("keyword");
    });
  });

  describe("getPopular", () => {
    it("should fetch popular manga sorted by views", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      const result = await source.getPopular(1);

      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("order%5Bviews_30d%5D=desc"),
        expect.any(Object)
      );
      expect(result.manga).toHaveLength(1);
    });

    it("should apply NSFW filter to popular manga", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      await source.getPopular(1);

      const callUrl = mockGetJson.mock.calls[0][0];
      expect(callUrl).toContain("genres%5B%5D=-87264");
    });
  });

  describe("getLatest", () => {
    it("should fetch latest manga sorted by chapter update", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      const result = await source.getLatest(1);

      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("order%5Bchapter_updated_at%5D=desc"),
        expect.any(Object)
      );
      expect(result.manga).toHaveLength(1);
    });

    it("should apply NSFW filter to latest manga", async () => {
      mockGetJson.mockResolvedValue(mockComixSearchResponse);

      await source.getLatest(1);

      const callUrl = mockGetJson.mock.calls[0][0];
      expect(callUrl).toContain("genres%5B%5D=-87264");
    });
  });

  describe("getMangaDetails", () => {
    it("should fetch manga details with all metadata", async () => {
      mockGetJson.mockResolvedValue({ result: mockComixManga });

      const result = await source.getMangaDetails("/test-manga-123");

      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("manga/test-manga-123"),
        expect.any(Object)
      );
      expect(result.id).toBe("test-manga-123");
      expect(result.title).toBe("Test Manga Title");
      expect(result.author).toBe("Test Author");
      expect(result.description).toBe(
        "This is a test manga synopsis with some description"
      );
      expect(result.status).toBe("Ongoing");
      expect(result.genres).toContain("Manga");
      expect(result.genres).toContain("Action");
      expect(result.genres).toContain("Romance");
      expect(result.genres).toContain("Shounen");
    });

    it("should map status correctly", async () => {
      const testCases = [
        { status: "releasing", expected: "Ongoing" },
        { status: "finished", expected: "Completed" },
        { status: "on_hiatus", expected: "Hiatus" },
        { input: "discontinued", expected: "Unknown" },
      ];

      for (const { status, expected } of testCases) {
        mockGetJson.mockResolvedValue({
          result: { ...mockComixManga, status },
        });

        const result = await source.getMangaDetails("/test");

        expect(result.status).toBe(expected);
      }
    });

    it("should use large poster with fallback to medium", async () => {
      mockGetJson.mockResolvedValue({ result: mockComixManga });

      const result = await source.getMangaDetails("/test");

      expect(result.cover).toContain("large.jpg");
    });
  });

  describe("getChapterList", () => {
    it("should fetch all chapters with pagination", async () => {
      mockGetJson.mockResolvedValue(mockComixChapterList);

      const result = await source.getChapterList("/test-manga-123");

      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("manga/test-manga-123/chapters"),
        expect.any(Object)
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it("should format chapter titles correctly", async () => {
      mockGetJson.mockResolvedValue(mockComixChapterList);

      const result = await source.getChapterList("/test-manga-123");

      expect(result[0].title).toBe("Chapter 1: The Beginning");
      expect(result[1].title).toBe("Chapter 2: The Journey");
    });

    it("should handle chapters without names", async () => {
      const responseWithoutNames = {
        result: {
          items: [{ ...mockComixChapterList.result.items[0], name: "" }],
          pagination: { current_page: 1, last_page: 1 },
        },
      };
      mockGetJson.mockResolvedValue(responseWithoutNames);

      const result = await source.getChapterList("/test-manga-123");

      expect(result[0].title).toBe("Chapter 1");
    });

    it("should set scanlator correctly", async () => {
      mockGetJson.mockResolvedValue(mockComixChapterList);

      const result = await source.getChapterList("/test-manga-123");

      expect(result[0].scanlator).toBe("Test Scans");
    });

    it("should mark official chapters", async () => {
      const officialChapter = {
        result: {
          items: [
            {
              ...mockComixChapterList.result.items[0],
              is_official: 1,
              scanlation_group: null,
            },
          ],
          pagination: { current_page: 1, last_page: 1 },
        },
      };
      mockGetJson.mockResolvedValue(officialChapter);

      const result = await source.getChapterList("/test");

      expect(result[0].scanlator).toBe("Official");
    });
  });

  describe("Chapter Deduplication", () => {
    it("should prefer official chapters over fansubbed", async () => {
      const response = {
        result: {
          items: mockDuplicateChapters.slice(0, 2), // Both chapter 1
          pagination: { current_page: 1, last_page: 1 },
        },
      };
      mockGetJson.mockResolvedValue(response);

      const result = await source.getChapterList("/test");

      // Should only have 1 chapter (the official one)
      const chapter1s = result.filter((ch) => ch.number === 1);
      expect(chapter1s).toHaveLength(1);
      expect(chapter1s[0].scanlator).toBe("Official");
    });

    it("should prefer higher votes when both unofficial", async () => {
      const response = {
        result: {
          items: mockDuplicateChapters.slice(2, 4), // Both chapter 2, unofficial
          pagination: { current_page: 1, last_page: 1 },
        },
      };
      mockGetJson.mockResolvedValue(response);

      const result = await source.getChapterList("/test");

      const chapter2s = result.filter((ch) => ch.number === 2);
      expect(chapter2s).toHaveLength(1);
      expect(chapter2s[0].title).toContain("High Votes");
    });

    it("should prefer more recent when votes are equal", async () => {
      const chapters = [
        { ...mockDuplicateChapters[2], updated_at: 1000, votes: 100 },
        {
          ...mockDuplicateChapters[3],
          number: 2,
          updated_at: 2000,
          votes: 100,
        },
      ];
      const response = {
        result: {
          items: chapters,
          pagination: { current_page: 1, last_page: 1 },
        },
      };
      mockGetJson.mockResolvedValue(response);

      const result = await source.getChapterList("/test");

      const chapter2s = result.filter((ch) => ch.number === 2);
      expect(chapter2s).toHaveLength(1);
      // Date should be formatted as "Jan 1, 1970" (from timestamp 2000)
      expect(chapter2s[0].date).toContain("1970");
      expect(chapter2s[0].date).toContain("Jan 1");
    });
  });

  describe("getPageList", () => {
    it("should fetch chapter images", async () => {
      mockGetJson.mockResolvedValue(mockComixPageList);

      const result = await source.getPageList("title/test-manga-123/12345");

      expect(mockGetJson).toHaveBeenCalledWith(
        expect.stringContaining("chapters/12345"),
        expect.any(Object)
      );
      expect(result).toHaveLength(3);
      expect(result[0].imageUrl).toBe("https://example.com/page1.jpg");
      expect(result[0].headers?.Referer).toBe("https://comix.to/");
    });

    it("should throw error when no images found", async () => {
      mockGetJson.mockResolvedValue({ result: null });

      await expect(source.getPageList("title/test/123")).rejects.toThrow(
        "No images found"
      );
    });

    it("should set correct page indices", async () => {
      mockGetJson.mockResolvedValue(mockComixPageList);

      const result = await source.getPageList("title/test/123");

      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(1);
      expect(result[2].index).toBe(2);
    });
  });

  describe("Helper Methods", () => {
    it("should extract manga ID from various URL formats", () => {
      expect(source["getMangaIdFromUrl"]("/test-123")).toBe("test-123");
      expect(source["getMangaIdFromUrl"]("test-123")).toBe("test-123");
      // For "title/test-123/456", first segment after split is "title"
      expect(source["getMangaIdFromUrl"]("title/test-123/456")).toBe("title");
    });

    it("should build absolute URLs correctly", () => {
      expect(source["absoluteUrl"]("/path/to/image.jpg")).toBe(
        "https://comix.to/path/to/image.jpg"
      );
      expect(source["absoluteUrl"]("https://example.com/image.jpg")).toBe(
        "https://example.com/image.jpg"
      );
    });
  });
});
