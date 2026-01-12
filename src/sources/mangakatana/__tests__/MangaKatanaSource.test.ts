import { MangaKatanaSource } from "../MangaKatanaSource";
import { HttpClient } from "@/core/http";

jest.mock("@/core/http", () => ({
  HttpClient: { getText: jest.fn() },
}));

describe("MangaKatanaSource", () => {
  let source: MangaKatanaSource;
  const mockGetText = HttpClient.getText as jest.Mock;

  beforeEach(() => {
    source = new MangaKatanaSource();
    jest.clearAllMocks();
  });

  describe("Config", () => {
    it("should have correct configuration", () => {
      expect(source.config.id).toBe("mangakatana");
      expect(source.config.name).toBe("MangaKatana");
      expect(source.config.language).toBe("en");
    });
  });

  describe("search", () => {
    it("should call search endpoint", async () => {
      mockGetText.mockResolvedValue("<div></div>");

      await source.search("test", 1).catch(() => {});

      expect(mockGetText).toHaveBeenCalled();
    });
  });
});
