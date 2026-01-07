import IDomParser from "advanced-html-parser";
import type { Document, Element } from "advanced-html-parser/types";

// Suppress xmldom warnings about HTML5 boolean attributes
const silentErrorHandler = {
  warning: () => {}, // Silence warnings
  error: (e: string) => {
    // console.error("[HtmlParser Error]", e); // Commented out to reduce noise, we catch below
  },
  fatalError: (e: string) => {
    console.error("[HtmlParser Fatal]", e);
  },
};

export class HtmlParser {
  private doc: Document | Element;

  constructor(html: string) {
    // ... same sanitize logic ...
    const sanitized = html
      // Fix attributes ending with semicolon e.g. <div class="foo";>
      .replace(/(\s+[a-zA-Z-]+="[^"]*");(?=\s|>)/g, '$1"')
      // Fix attributes without quotes containing semicolons
      .replace(/(\s+[a-zA-Z-]+=[^"\s>]*);(?=\s|>)/g, "$1")
      // Fix hanging semicolons in tags e.g. <img src="..." ;>
      .replace(/\s+;(?=\s|>)/g, "")
      // Aggressive: remove any semicolon at the end of a tag that isn't in quotes
      .replace(/([^"'>]);(?=\s*>)/g, "$1");

    try {
      // Check if html has body tag
      const hasBody = /<body[^>]*>/i.test(sanitized);

      this.doc = IDomParser.parse(sanitized, {
        onlyBody: hasBody,
        errorHandler: silentErrorHandler,
      }) as any;
    } catch (e) {
      console.error(
        "[HtmlParser] Parse failed. Sanitized HTML snippet:",
        sanitized.substring(0, 500)
      );
      throw e;
    }
  }

  private get root(): any {
    return this.doc;
  }

  /**
   * Select a single element using CSS selector
   */
  querySelector(selector: string): Element | null {
    if ((this.doc as any).querySelector) {
        return (this.doc as any).querySelector(selector);
    }
    return (this.doc as any).documentElement?.querySelector(selector) || null;
  }

  /**
   * Select multiple elements using CSS selector
   */
  querySelectorAll(selector: string): Element[] {
    let nodeList: any = [];
    if ((this.doc as any).querySelectorAll) {
        nodeList = (this.doc as any).querySelectorAll(selector);
    } else if ((this.doc as any).documentElement) {
        nodeList = (this.doc as any).documentElement.querySelectorAll(selector);
    }
    return Array.from(nodeList);
  }

  /**
   * Get text content from selector
   */
  text(selector: string): string {
    const el = this.querySelector(selector);
    return el?.textContent?.trim() || "";
  }

  /**
   * Get attribute value from selector
   */
  attr(selector: string, attribute: string): string {
    const el = this.querySelector(selector);
    return el?.getAttribute(attribute) || "";
  }

  /**
   * Get src attribute (common for images)
   */
  src(selector: string): string {
    return this.attr(selector, "src");
  }

  /**
   * Get href attribute (common for links)
   */
  href(selector: string): string {
    return this.attr(selector, "href");
  }

  /**
   * Get all elements matching selector and extract data
   */
  selectAll<T>(
    selector: string,
    mapper: (el: Element, index: number) => T
  ): T[] {
    const elements = this.querySelectorAll(selector);
    return elements.map(mapper);
  }

  /**
   * Get text content from multiple elements
   */
  textAll(selector: string): string[] {
    return this.selectAll(selector, (el) => el.textContent?.trim() || "");
  }

  /**
   * Get attribute from multiple elements
   */
  attrAll(selector: string, attribute: string): string[] {
    return this.selectAll(selector, (el) => el.getAttribute(attribute) || "");
  }
}

/**
 * Parse HTML string and return parser instance
 */
export function parseHtml(html: string): HtmlParser {
  return new HtmlParser(html);
}
