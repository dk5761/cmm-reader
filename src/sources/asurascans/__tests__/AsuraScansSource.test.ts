import { AsuraScansSource } from "../AsuraScansSource";
import { HttpClient } from "@/core/http";

jest.mock("@/core/http", () => ({
  HttpClient: { getText: jest.fn() },
}));

describe("AsuraScansSource", () => {
  let source: AsuraScansSource;
  const mockGetText = HttpClient.getText as jest.Mock;

  beforeEach(() => {
    source = new AsuraScansSource();
    jest.clearAllMocks();
  });

  describe("Config", () => {
    it("should have correct configuration", () => {
      expect(source.config.id).toBe("asurascans");
      expect(source.config.name).toBe("Asura Scans");
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

  describe("getPopular", () => {
    it("should call popular endpoint", async () => {
      mockGetText.mockResolvedValue("<div></div>");

      await source.getPopular(1).catch(() => {});

      expect(mockGetText).toHaveBeenCalled();
    });
  });

  describe("getLatest", () => {
    it("should call latest endpoint", async () => {
      mockGetText.mockResolvedValue("<div></div>");

      await source.getLatest(1).catch(() => {});

      expect(mockGetText).toHaveBeenCalled();
    });
  });
});
