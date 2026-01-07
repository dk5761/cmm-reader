
import { parseHtml } from "../HtmlParser";

describe("HtmlParser", () => {
  it("selects elements with body tag and onlyBody: true", () => {
    const html = "<html><body><div class='test'>Hello</div></body></html>";
    const parser = parseHtml(html);
    const elements = parser.querySelectorAll(".test");
    expect(elements).toHaveLength(1);
    expect(elements[0].textContent).toBe("Hello");
  });

  it("selects elements without body tag", () => {
    const html = "<div class='test'>Hello</div>";
    const parser = parseHtml(html);
    const elements = parser.querySelectorAll(".test");
    expect(elements).toHaveLength(1);
  });
});
