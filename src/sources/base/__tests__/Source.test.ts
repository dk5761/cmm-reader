import { Source } from "../Source";
import { HttpClient } from "@/core/http";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../types";

// Mock HttpClient
jest.mock("@/core/http", () => ({
  HttpClient: {
    getText: jest.fn(),
  },
}));

// Create a concrete implementation for testing
class TestSource extends Source {
  readonly config: SourceConfig = {
    id: "test",
    name: "Test Source",
    baseUrl: "https://test.com",
    logo: "test-logo.png",
    language: "en",
    nsfw: false,
  };

  async search(query: string, page?: number): Promise<SearchResult> {
    return { manga: [], hasNextPage: false };
  }

  async getPopular(page?: number): Promise<SearchResult> {
    return { manga: [], hasNextPage: false };
  }

  async getLatest(page?: number): Promise<SearchResult> {
    return { manga: [], hasNextPage: false };
  }

  async getMangaDetails(url: string): Promise<MangaDetails> {
    return {
      id: "test",
      title: "Test",
      cover: "",
      url: "",
      sourceId: "test",
    };
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    return [];
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    return [];
  }
}

describe("Source Base Class", () => {
  let source: TestSource;
  const mockGetText = HttpClient.getText as jest.Mock;

  beforeEach(() => {
    source = new TestSource();
    jest.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should expose config properties", () => {
      expect(source.id).toBe("test");
      expect(source.name).toBe("Test Source");
      expect(source.baseUrl).toBe("https://test.com");
    });

    it("should provide image headers with Referer", () => {
      const headers = source.getImageHeaders();
      expect(headers.Referer).toBe("https://test.com/");
    });
  });

  describe("fetchHtml", () => {
    it("should fetch HTML with relative URL", async () => {
      mockGetText.mockResolvedValue("<html>test</html>");

      await source["fetchHtml"]("/manga/test");

      expect(mockGetText).toHaveBeenCalledWith(
        "https://test.com/manga/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            Referer: "https://test.com",
          }),
        })
      );
    });

    it("should fetch HTML with absolute URL", async () => {
      mockGetText.mockResolvedValue("<html>test</html>");

      await source["fetchHtml"]("https://example.com/manga");

      expect(mockGetText).toHaveBeenCalledWith(
        "https://example.com/manga",
        expect.any(Object)
      );
    });
  });

  describe("absoluteUrl", () => {
    it("should handle absolute HTTP URLs", () => {
      expect(source["absoluteUrl"]("https://example.com/image.jpg")).toBe(
        "https://example.com/image.jpg"
      );
    });

    it("should handle protocol-relative URLs", () => {
      expect(source["absoluteUrl"]("//cdn.example.com/image.jpg")).toBe(
        "https://cdn.example.com/image.jpg"
      );
    });

    it("should handle absolute paths", () => {
      expect(source["absoluteUrl"]("/images/cover.jpg")).toBe(
        "https://test.com/images/cover.jpg"
      );
    });

    it("should handle relative paths", () => {
      expect(source["absoluteUrl"]("images/cover.jpg")).toBe(
        "https://test.com/images/cover.jpg"
      );
    });

    it("should handle empty URLs", () => {
      expect(source["absoluteUrl"]("")).toBe("");
    });
  });

  describe("getMangaIdFromUrl", () => {
    it("should extract last path segment as ID", () => {
      expect(source["getMangaIdFromUrl"]("/manga/one-piece-123")).toBe(
        "one-piece-123"
      );
    });

    it("should handle URLs without leading slash", () => {
      expect(source["getMangaIdFromUrl"]("manga/test-456")).toBe("test-456");
    });

    it("should handle URLs with trailing slash", () => {
      expect(source["getMangaIdFromUrl"]("/manga/test/")).toBe("test");
    });

    it("should return original URL if no path segments", () => {
      expect(source["getMangaIdFromUrl"]("test-id")).toBe("test-id");
    });
  });

  describe("parseChapterNumber", () => {
    it("should extract integer chapter numbers", () => {
      expect(source["parseChapterNumber"]("Chapter 123")).toBe(123);
    });

    it("should extract decimal chapter numbers", () => {
      expect(source["parseChapterNumber"]("Chapter 12.5")).toBe(12.5);
    });

    it("should extract numbers from various formats", () => {
      expect(source["parseChapterNumber"]("Ch. 45")).toBe(45);
      expect(source["parseChapterNumber"]("Episode 7")).toBe(7);
      expect(source["parseChapterNumber"]("Vol.3 Ch.15")).toBe(3);
    });

    it("should return 0 for non-numeric strings", () => {
      expect(source["parseChapterNumber"]("Prologue")).toBe(0);
      expect(source["parseChapterNumber"]("One Shot")).toBe(0);
    });
  });

  describe("parseHtml", () => {
    it("should parse HTML string into parser object", () => {
      const html = "<div><h1>Test</h1></div>";
      const parser = source["parseHtml"](html);

      expect(parser).toBeDefined();
      expect(typeof parser.querySelector).toBe("function");
    });
  });
});
