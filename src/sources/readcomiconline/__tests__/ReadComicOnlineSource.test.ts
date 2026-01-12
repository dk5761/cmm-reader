import { ReadComicOnlineSource } from "../ReadComicOnlineSource";
import { HttpClient } from "@/core/http";

jest.mock("@/core/http", () => ({
  HttpClient: { getText: jest.fn() },
}));

describe("ReadComicOnlineSource", () => {
  let source: ReadComicOnlineSource;
  const mockGetText = HttpClient.getText as jest.Mock;

  beforeEach(() => {
    source = new ReadComicOnlineSource();
    jest.clearAllMocks();
  });

  describe("Config", () => {
    it("should have correct configuration", () => {
      expect(source.config.id).toBe("readcomiconline");
      expect(source.config.name).toBe("ReadComicOnline");
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
