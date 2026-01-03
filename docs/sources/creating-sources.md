# Creating Manga Sources - Complete Guide

> This document provides all context needed for an LLM to create new manga/comic sources.

---

## Architecture Overview

Sources are TypeScript classes that scrape manga websites. Each source:

1. **Extends** the abstract `Source` base class (or a multi-source template like `MyMangaCMS`)
2. **Implements** required abstract methods for fetching manga/chapters/pages
3. **Is registered** in `src/sources/index.ts`

```
src/sources/
├── base/
│   ├── Source.ts        # Abstract base class
│   ├── MyMangaCMS.ts    # Multi-source template for CMS sites
│   └── types.ts         # Manga, Chapter, Page, SourceConfig types
├── index.ts             # Source registry + exports
├── mangakakalot/        # Example: simple HTML scraping
├── asurascans/          # Example: Next.js with JSON in scripts
├── kissmanga/           # Example: Madara WordPress theme
├── readcomiconline/     # Example: custom URL decoding
└── manhwa18/            # Example: NSFW source
```

---

## Required Types (from `base/types.ts`)

```typescript
interface SourceConfig {
  id: string; // Unique identifier (lowercase, no spaces)
  name: string; // Display name
  baseUrl: string; // Website base URL (no trailing slash)
  icon?: string; // Optional icon path
  logo?: any; // Optional logo (require() for local images)
  language: string; // Language code (e.g., "en", "vi")
  nsfw: boolean; // Adult content flag
}

interface Manga {
  id: string; // Unique manga ID (from URL)
  title: string; // Manga title
  cover: string; // Cover image URL (absolute)
  url: string; // Manga page URL (absolute)
  sourceId: string; // Source ID (this.id)
}

interface MangaDetails extends Manga {
  author?: string;
  artist?: string;
  description?: string;
  genres?: string[];
  status?: "Ongoing" | "Completed" | "Hiatus" | "Unknown";
  alternativeTitles?: string[];
  rating?: number;
  lastUpdated?: string;
}

interface Chapter {
  id: string; // Unique chapter ID
  mangaId: string; // Parent manga ID
  number: number; // Chapter number (parsed float)
  title?: string; // Chapter title/name
  url: string; // Chapter URL (absolute)
  date?: string; // Upload date
  scanlator?: string; // Scanlation group
}

interface Page {
  index: number; // Page index (0-based)
  imageUrl: string; // Image URL (absolute)
  headers?: Record<string, string>; // Headers for image loading
}

interface SearchResult {
  manga: Manga[];
  hasNextPage: boolean;
}
```

---

## Base Source Class API

### Abstract Methods (MUST implement)

```typescript
abstract readonly config: SourceConfig;

// Search for manga
abstract search(query: string, page?: number): Promise<SearchResult>;

// Get popular/trending manga list
abstract getPopular(page?: number): Promise<SearchResult>;

// Get latest updated manga list
abstract getLatest(page?: number): Promise<SearchResult>;

// Get detailed manga information
abstract getMangaDetails(url: string): Promise<MangaDetails>;

// Get list of chapters for a manga
abstract getChapterList(mangaUrl: string): Promise<Chapter[]>;

// Get list of pages/images for a chapter
abstract getPageList(chapterUrl: string): Promise<Page[]>;
```

### Protected Helper Methods (available to use)

```typescript
// Fetch HTML from URL (Cloudflare bypass handled automatically)
protected async fetchHtml(url: string): Promise<string>

// Parse HTML string into queryable document
protected parseHtml(html: string): HtmlParser

// Convert relative URL to absolute
protected absoluteUrl(path: string): string

// Extract manga ID from URL (default: last path segment)
protected getMangaIdFromUrl(url: string): string

// Parse chapter number from text string
protected parseChapterNumber(text: string): number
```

### Optional Override Methods

```typescript
// Get headers for image loading (default: { Referer: baseUrl })
getImageHeaders(): Record<string, string>
```

---

## HtmlParser API

The `parseHtml()` method returns an `HtmlParser` instance with:

```typescript
// Single element selection
querySelector(selector: string): Element | null
text(selector: string): string
attr(selector: string, attribute: string): string
src(selector: string): string   // shorthand for attr(sel, "src")
href(selector: string): string  // shorthand for attr(sel, "href")

// Multiple elements
querySelectorAll(selector: string): Element[]
textAll(selector: string): string[]
attrAll(selector: string, attribute: string): string[]
selectAll<T>(selector: string, mapper: (el, index) => T): T[]
```

### CSS Selectors Support

- Standard CSS selectors work
- `:contains(text)` pseudo-selector for text matching
- Escape special chars in class names: `sm\\:text-left`

---

## Step-by-Step: Creating a New Source

### Step 1: Create Source Directory

```
src/sources/mysite/
├── MySiteSource.ts    # Main source file
└── index.ts           # Export
```

### Step 2: Implement the Source

```typescript
// MySiteSource.ts
import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../base/types";
import { CookieManagerInstance } from "@/core/http/CookieManager";

export class MySiteSource extends Source {
  readonly config: SourceConfig = {
    id: "mysite", // lowercase, unique
    name: "MySite", // display name
    baseUrl: "https://mysite.com", // NO trailing slash
    language: "en",
    nsfw: false,
  };

  // CSS selectors for scraping
  private readonly selectors = {
    mangaList: ".manga-item",
    mangaTitle: ".title a",
    mangaCover: ".cover img",
    nextPage: "a.next",
    // ... add more as needed
  };

  async getPopular(page = 1): Promise<SearchResult> {
    const url = `/popular?page=${page}`;
    const html = await this.fetchHtml(url);
    const doc = this.parseHtml(html);

    const manga = doc.selectAll(this.selectors.mangaList, (el) => {
      const titleEl = el.querySelector(this.selectors.mangaTitle);
      const imgEl = el.querySelector(this.selectors.mangaCover);

      return {
        id: this.getMangaIdFromUrl(titleEl?.getAttribute("href") || ""),
        title: titleEl?.textContent?.trim() || "",
        cover: this.absoluteUrl(imgEl?.getAttribute("src") || ""),
        url: this.absoluteUrl(titleEl?.getAttribute("href") || ""),
        sourceId: this.id,
      };
    });

    const hasNextPage = !!doc.querySelector(this.selectors.nextPage);

    return { manga: manga.filter((m) => m.url), hasNextPage };
  }

  async getLatest(page = 1): Promise<SearchResult> {
    // Similar to getPopular, different URL
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    const url = `/search?q=${encodeURIComponent(query)}&page=${page}`;
    // ... similar scraping logic
  }

  async getMangaDetails(mangaUrl: string): Promise<MangaDetails> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    return {
      id: this.getMangaIdFromUrl(mangaUrl),
      title: doc.text(".manga-title"),
      cover: this.absoluteUrl(doc.attr(".cover img", "src")),
      url: this.absoluteUrl(mangaUrl),
      sourceId: this.id,
      author: doc.text(".author"),
      description: doc.text(".description"),
      genres: doc.textAll(".genres a"),
      status: this.parseStatus(doc.text(".status")),
    };
  }

  async getChapterList(mangaUrl: string): Promise<Chapter[]> {
    const html = await this.fetchHtml(mangaUrl);
    const doc = this.parseHtml(html);

    return doc
      .selectAll(".chapter-list a", (el) => ({
        id: this.getMangaIdFromUrl(el.getAttribute("href") || ""),
        mangaId: this.getMangaIdFromUrl(mangaUrl),
        number: this.parseChapterNumber(el.textContent || ""),
        title: el.textContent?.trim(),
        url: this.absoluteUrl(el.getAttribute("href") || ""),
        date: el.querySelector(".date")?.textContent?.trim(),
      }))
      .filter((ch) => ch.url);
  }

  async getPageList(chapterUrl: string): Promise<Page[]> {
    const html = await this.fetchHtml(chapterUrl);
    const doc = this.parseHtml(html);

    // Get cookies for image auth if needed
    const domain = new URL(this.baseUrl).hostname;
    const cookies = await CookieManagerInstance.getCookies(domain);

    return doc
      .selectAll(".page-image img", (el, index) => ({
        index,
        imageUrl: this.absoluteUrl(el.getAttribute("src") || ""),
        headers: {
          Referer: `${this.baseUrl}/`,
          ...(cookies && { Cookie: cookies }),
        },
      }))
      .filter((p) => p.imageUrl);
  }

  private parseStatus(text: string): MangaDetails["status"] {
    const lower = text.toLowerCase();
    if (lower.includes("ongoing")) return "Ongoing";
    if (lower.includes("completed")) return "Completed";
    if (lower.includes("hiatus")) return "Hiatus";
    return "Unknown";
  }
}
```

### Step 3: Create Export File

```typescript
// index.ts
export { MySiteSource } from "./MySiteSource";
```

### Step 4: Register in Sources Index

```typescript
// src/sources/index.ts
import { MySiteSource } from "./mysite";

const mysite = new MySiteSource();

export const SOURCES: Record<string, Source> = {
  // ... existing sources
  mysite,
} as const;
```

---

## Common Patterns & Techniques

### Pattern 1: Image URL Extraction

```typescript
private getImageUrl(el: Element | null): string {
  if (!el) return "";

  // Check multiple attributes (lazy loading, data sources)
  for (const attr of ["data-src", "data-lazy-src", "data-cfsrc", "src"]) {
    const val = el.getAttribute(attr);
    if (val && !val.includes("data:image")) {
      return this.absoluteUrl(val.trim());
    }
  }
  return "";
}
```

### Pattern 2: Override absoluteUrl for Special Paths

```typescript
// Example: AsuraScans needs /series/ prefix
protected absoluteUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("//")) return `https:${path}`;

  // Add /series/ prefix if missing
  if (!path.startsWith("/series/") && !path.startsWith("/api/")) {
    path = `/series${path.startsWith("/") ? "" : "/"}${path}`;
  }

  return `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}
```

### Pattern 3: Extracting Data from JavaScript

```typescript
// For Next.js sites with data in script tags
async getPageList(chapterUrl: string): Promise<Page[]> {
  const html = await this.fetchHtml(chapterUrl);

  // Find script with data
  const scriptRegex = /<script[^>]*>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  const matches = Array.from(html.matchAll(scriptRegex));

  // Extract and parse content
  const scriptData = matches.map((m) => {
    try {
      const parsed = JSON.parse(m[1]);
      return parsed[1]; // Usually [index, "content"]
    } catch {
      return "";
    }
  }).join("");

  // Find pages array in script data
  const pagesMatch = /"pages":\s*(\[[\s\S]*?\])/s.exec(scriptData);
  if (!pagesMatch) return [];

  const pages = JSON.parse(pagesMatch[1]);
  return pages.map((p: any, i: number) => ({
    index: i,
    imageUrl: p.url,
  }));
}
```

### Pattern 4: AJAX Chapter Loading (WordPress/Madara)

```typescript
async getChapterList(mangaUrl: string): Promise<Chapter[]> {
  const html = await this.fetchHtml(mangaUrl);
  const doc = this.parseHtml(html);

  // Check if chapters need AJAX fetch
  const chaptersHolder = doc.querySelector("div[id^=manga-chapters-holder]");

  if (chaptersHolder) {
    // POST to ajax endpoint
    const ajaxUrl = `${mangaUrl.replace(/\/$/, "")}/ajax/chapters/`;
    const chapterHtml = await WebViewFetcherService.postHtml(ajaxUrl, "", {
      "X-Requested-With": "XMLHttpRequest",
      Referer: this.baseUrl + "/",
    });
    // Parse chapterHtml...
  }
}
```

### Pattern 5: Filtering Ads/Unwanted Images

```typescript
const adPatterns = [
  /sponsor/i,
  /banner/i,
  /advert/i,
  /promo/i,
  /googlesyndication/i,
  /doubleclick/i,
];

return pages
  .filter((p) => p.imageUrl)
  .filter((p) => !adPatterns.some((pattern) => pattern.test(p.imageUrl)));
```

### Pattern 6: Custom URL Decoding

```typescript
// ReadComicOnline obfuscated URLs
private decodeImageUrl(encoded: string): string {
  let e = encoded;

  // Step 1: Replace obfuscation patterns
  e = e.replace(/\w{5}__\w{3}__/g, "g");
  e = e.replace(/\w{2}__\w{6}_/g, "a");

  // Step 2: Base64 decode
  const decoded = atob(e);

  // Step 3: Build final URL
  return `https://cdn.example.com/${decoded}`;
}
```

---

## Using Multi-Source Templates

### MyMangaCMS Template (Vietnamese sites)

If the target site uses MyMangaCMS:

```typescript
import { MyMangaCMS } from "../base/MyMangaCMS";

export class VietnameseSite extends MyMangaCMS {
  readonly config = {
    id: "visite",
    name: "Vietnamese Site",
    baseUrl: "https://visite.com",
    language: "vi",
    nsfw: false,
  };

  // Override localization strings if needed
  protected parseAuthorString = "Tác giả";
  protected parseStatusOngoingStringLowerCase = "đang tiến hành";

  // Override selectors if site differs
  protected readonly popularSelector = "div.thumb-item";
}
```

---

## Image Headers and Cookies

### When to Add Headers

1. **Referer Header**: Most sites require this to load images
2. **Cookies**: Sites with Cloudflare or authentication
3. **User-Agent**: Some CDNs validate this

```typescript
async getPageList(chapterUrl: string): Promise<Page[]> {
  // Get stored cookies
  const domain = new URL(this.baseUrl).hostname;
  const cookies = await CookieManagerInstance.getCookies(domain);

  return pages.map((url, index) => ({
    index,
    imageUrl: url,
    headers: {
      Referer: `${this.baseUrl}/`,
      "User-Agent": Platform.OS === "ios"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0..."
        : "Mozilla/5.0 (Linux; Android 13...",
      ...(cookies && { Cookie: cookies }),
    },
  }));
}
```

---

## Debugging Tips

1. **Log HTML snippets** when selectors fail:

   ```typescript
   console.log("[Source] HTML preview:", html.substring(0, 1000));
   ```

2. **Log extracted data** before returning:

   ```typescript
   console.log("[Source] Manga found:", manga.length);
   console.log("[Source] Sample:", manga[0]);
   ```

3. **Check network tab** in browser devtools for actual requests/responses

4. **Use regex fallbacks** when HTML parsing fails:
   ```typescript
   const srcMatch = html.match(/<img[^>]+src="([^"]+)"/);
   ```

---

## Checklist for New Source

- [ ] Config has unique `id` (lowercase, no spaces)
- [ ] `baseUrl` has no trailing slash
- [ ] All URLs returned are absolute (use `this.absoluteUrl()`)
- [ ] `sourceId` is set on every Manga/Chapter object
- [ ] Chapter list includes `mangaId`
- [ ] Pages include proper headers (at least Referer)
- [ ] Filter out empty/invalid entries
- [ ] Filter out ad images if applicable
- [ ] Handle pagination (`hasNextPage`)
- [ ] Parse status correctly
- [ ] Parse chapter numbers correctly
- [ ] Source is registered in `index.ts`
- [ ] Export is created in source folder's `index.ts`

---

## Reference: Existing Sources

| Source          | Pattern      | Notes                                 |
| --------------- | ------------ | ------------------------------------- |
| MangaKakalot    | Simple HTML  | Standard CSS selectors, CDN rewriting |
| AsuraScans      | Next.js/JSON | Data in script tags, CF protection    |
| KissManga       | Madara/WP    | AJAX chapters, WebView POST           |
| ReadComicOnline | URL Decoding | Custom image URL obfuscation          |
| Manhwa18        | MyMangaCMS   | Template-based, NSFW flag             |

---

## Core HTTP & Parser Imports

```typescript
// Required imports
import { Source } from "../base/Source";
import type {
  Manga,
  MangaDetails,
  Chapter,
  Page,
  SearchResult,
  SourceConfig,
} from "../base/types";

// Optional imports
import { CookieManagerInstance } from "@/core/http/CookieManager";
import { HttpClient } from "@/core/http";
import { WebViewFetcherService } from "@/core/http/WebViewFetcherService";
import { Platform } from "react-native";
```
