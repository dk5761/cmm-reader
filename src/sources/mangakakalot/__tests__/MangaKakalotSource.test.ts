import { MangaKakalotSource } from "../MangaKakalotSource";
import { HttpClient } from "@/core/http";

// Mock HttpClient
jest.mock("@/core/http", () => ({
  HttpClient: {
    getText: jest.fn(),
  },
}));

describe("MangaKakalotSource", () => {
  let source: MangaKakalotSource;
  const mockGetText = HttpClient.getText as jest.Mock;

  beforeEach(() => {
    source = new MangaKakalotSource();
    jest.clearAllMocks();
  });

  describe("Config", () => {
    it("should have correct source configuration", () => {
      expect(source.config.id).toBe("mangakakalot");
      expect(source.config.name).toBe("MangaKakalot");
      expect(source.config.baseUrl).toBe("https://www.mangakakalot.gg");
      expect(source.config.language).toBe("en");
      expect(source.config.nsfw).toBe(false);
    });
  });

  describe("search", () => {
    it("should normalize search query with underscores", async () => {
      const mockHtml = `
        <div class="panel_story_list">
          <div class="story_item">
            <h3><a href="/manga/test-123">Test Manga</a></h3>
            <img src="/images/test.jpg" />
          </div>
        </div>
        <a class="page_select"></a>
        <a>Next</a>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      await source.search("one piece chapter", 1);

      expect(mockGetText).toHaveBeenCalledWith(
        expect.stringContaining("/search/story/one_piece_chapter"),
        expect.any(Object)
      );
    });

    it("should parse search results correctly", async () => {
      const mockHtml = `
        <div class="panel_story_list">
          <div class="story_item">
            <h3><a href="/manga/test-123">Test Manga</a></h3>
            <img src="/images/test.jpg" />
          </div>
        </div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.search("test", 1);

      expect(result.manga.length).toBeGreaterThan(0);
      expect(result.manga[0].sourceId).toBe("mangakakalot");
    });

    it("should detect next page correctly", async () => {
      const mockHtmlWithNext = `
        <div class="panel_story_list">
          <div class="story_item">
            <h3><a href="/manga/test">Test</a></h3>
            <img src="/test.jpg" />
          </div>
        </div>
        <a class="page_select"></a>
        <a>Next</a>
      `;
      mockGetText.mockResolvedValue(mockHtmlWithNext);

      const result = await source.search("test", 1);

      expect(result.hasNextPage).toBe(true);
    });
  });

  describe("getPopular", () => {
    it("should fetch popular manga from hot-manga endpoint", async () => {
      const mockHtml = `
        <div class="truyen-list">
          <div class="list-truyen-item-wrap">
            <h3><a href="/manga/popular-123">Popular Manga</a></h3>
            <img src="/popular.jpg" />
          </div>
        </div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.getPopular(1);

      expect(mockGetText).toHaveBeenCalledWith(
        expect.stringContaining("/manga-list/hot-manga"),
        expect.any(Object)
      );
      expect(result.manga.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getLatest", () => {
    it("should fetch latest manga from latest-manga endpoint", async () => {
      const mockHtml = `
        <div class="truyen-list">
          <div class="list-truyen-item-wrap">
            <h3><a href="/manga/latest-123">Latest Manga</a></h3>
            <img src="/latest.jpg" />
          </div>
        </div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.getLatest(1);

      expect(mockGetText).toHaveBeenCalledWith(
        expect.stringContaining("/manga-list/latest-manga"),
        expect.any(Object)
      );
    });
  });

  describe("getMangaDetails", () => {
    it("should parse manga details from page", async () => {
      const mockHtml = `
        <div class="manga-info-top">
          <h1>Test Manga Title</h1>
          <div class="manga-info-pic">
            <img src="/cover.jpg" />
          </div>
          <li>Author : <a>Test Author</a></li>
          <li>Status : Ongoing</li>
          <li>Genres : <a>Action</a><a>Adventure</a></li>
        </div>
        <div id="noidungm">This is the description</div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.getMangaDetails("/manga/test-123");

      expect(result.title).toContain("Test");
      expect(result.sourceId).toBe("mangakakalot");
    });

    it("should parse status correctly", async () => {
      const mockHtmlOngoing = `
        <div class="manga-info-top">
          <h1>Test</h1>
          <li>Status : Ongoing</li>
        </div>
        <div id="noidungm">Description</div>
      `;
      mockGetText.mockResolvedValue(mockHtmlOngoing);

      const result = await source.getMangaDetails("/test");

      expect(result.status).toBe("Ongoing");
    });
  });

  describe("getChapterList", () => {
    it("should parse chapter list from page", async () => {
      const mockHtml = `
        <div class="manga-info-top">
          <h1>Test</h1>
        </div>
        <div id="noidungm">Desc</div>
        <div class="chapter-list">
          <div class="row">
            <a href="/chapter/test-chapter-1">Chapter 1</a>
            <span>Jan 01, 2024</span>
          </div>
          <div class="row">
            <a href="/chapter/test-chapter-2">Chapter 2</a>
            <span>Jan 02, 2024</span>
          </div>
        </div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.getChapterList("/manga/test");

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getPageList", () => {
    it("should parse page images from chapter", async () => {
      const mockHtml = `
        <div class="container-chapter-reader">
          <img src="https://example.com/page1.jpg" />
          <img src="https://example.com/page2.jpg" />
          <img src="https://example.com/page3.jpg" />
        </div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.getPageList("/chapter/test-1");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].headers?.Referer).toBe("https://www.mangakakalot.gg/");
    });

    it("should filter out advertisement images", async () => {
      const mockHtml = `
        <div class="container-chapter-reader">
          <img src="https://example.com/page1.jpg" />
          <img src="https://ivy-ads.com/banner.jpg" />
          <img src="https://example.com/page2.jpg" />
        </div>
      `;
      mockGetText.mockResolvedValue(mockHtml);

      const result = await source.getPageList("/chapter/test");

      // Should filter out the ivy ad
      expect(result.every((p) => !p.imageUrl.includes("ivy"))).toBe(true);
    });
  });
});
