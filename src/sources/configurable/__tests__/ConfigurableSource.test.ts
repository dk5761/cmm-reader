
import { ConfigurableSource } from "../ConfigurableSource";
import { ScraperConfig } from "../types";
import { HttpClient } from "@/core/http";

// Mock HttpClient
jest.mock("@/core/http", () => ({
  HttpClient: {
    getText: jest.fn(),
  },
}));

describe("ConfigurableSource", () => {
  const mockConfig: ScraperConfig = {
    id: "test-source",
    name: "Test Source",
    baseUrl: "https://test.com",
    language: "en",
    nsfw: false,
    paths: {
      popular: "/popular",
      latest: "/latest",
      search: "/search?q=${query}&p=${page}",
    },
    list: {
      itemSelector: ".manga-item",
      titleSelector: ".title",
      urlSelector: "a",
      coverSelector: "img",
    },
    details: {
      titleSelector: "h1",
      coverSelector: ".cover img",
      descriptionSelector: ".desc",
    },
    chapters: {
      itemSelector: ".chapter-row",
      linkSelector: "a",
    },
    pages: {
      mode: "selector",
      imageSelector: ".reader img",
    },
  };

  const source = new ConfigurableSource(mockConfig);

  it("parses manga list correctly", async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="manga-item">
            <a href="/manga/1">
              <img src="/cover1.jpg" />
              <span class="title">Manga 1</span>
            </a>
          </div>
          <div class="manga-item">
            <a href="/manga/2">
              <img src="/cover2.jpg" />
              <span class="title">Manga 2</span>
            </a>
          </div>
        </body>
      </html>
    `;

    (HttpClient.getText as jest.Mock).mockResolvedValue(mockHtml);

    const result = await source.getPopular(1);

    expect(result.manga).toHaveLength(2);
    expect(result.manga[0].title).toBe("Manga 1");
    expect(result.manga[0].url).toBe("https://test.com/manga/1");
    expect(result.manga[0].cover).toBe("https://test.com/cover1.jpg");
  });

  it("handles search URL replacement", async () => {
    (HttpClient.getText as jest.Mock).mockResolvedValue("<html></html>");

    await source.search("one piece", 2);

    expect(HttpClient.getText).toHaveBeenCalledWith(
      "https://test.com/search?q=one%20piece&p=2",
      expect.anything()
    );
  });

  it("parses chapter list correctly", async () => {
    const mockHtml = `
      <div class="chapter-row">
        <a href="/ch/1">Chapter 1</a>
      </div>
      <div class="chapter-row">
        <a href="/ch/2">Chapter 2</a>
      </div>
    `;

    (HttpClient.getText as jest.Mock).mockResolvedValue(mockHtml);

    const result = await source.getChapterList("https://test.com/manga/1");

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Chapter 1");
    expect(result[0].number).toBe(1);
  });
});
