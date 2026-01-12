import { Manhwa18NetSource } from "../Manhwa18NetSource";
import { HttpClient } from "@/core/http";

jest.mock("@/core/http", () => ({
  HttpClient: { getText: jest.fn() },
}));

describe("Manhwa18NetSource", () => {
  let source: Manhwa18NetSource;
  const mockGetText = HttpClient.getText as jest.Mock;

  beforeEach(() => {
    source = new Manhwa18NetSource();
    jest.clearAllMocks();
  });

  describe("Config", () => {
    it("should have correct configuration", () => {
      expect(source.config.id).toBe("manhwa18net");
      expect(source.config.name).toBe("Manhwa18.net");
      expect(source.config.language).toBe("en");
      expect(source.config.nsfw).toBe(true);
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
