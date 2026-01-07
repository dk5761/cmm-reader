import { shiftWindowNext, shiftWindowPrev } from "../readerWindowUtils";
import type { Chapter } from "@/sources";
import type { ViewerChapters, ReaderChapter } from "../../types/reader.types";

// Mock the sources index to avoid loading native modules
jest.mock("@/sources", () => ({}));

// Helper to create a dummy chapter
const makeChapter = (id: string, number: number): Chapter => ({
  id,
  mangaId: "test-manga",
  number,
  url: `http://example.com/${id}`,
  title: `Chapter ${number}`,
});

// Helper to create a ReaderChapter
const makeReaderChapter = (
  id: string,
  number: number,
  state: "wait" | "loading" | "loaded" = "loaded"
): ReaderChapter => ({
  chapter: makeChapter(id, number),
  state,
  pages: [],
});

describe("Reader Window Logic", () => {
  /**
   * App terminology (from useReaderStoreV2.ts):
   * allChapters = [Ch3, Ch2, Ch1]  (Newest first)
   * if current = Ch2 (Index 1)
   *   nextChapter = Ch3 (Index 0) - Chronologically newer
   *   prevChapter = Ch1 (Index 2) - Chronologically older
   */
  const ch1 = makeChapter("ch1", 1);
  const ch2 = makeChapter("ch2", 2);
  const ch3 = makeChapter("ch3", 3);
  const allChapters = [ch3, ch2, ch1]; 

  describe("shiftWindowNext (Moving to newer chapter)", () => {
    it("shifts from Ch2 to Ch3", () => {
      // Start at Ch2
      const initialViewer: ViewerChapters = {
        prevChapter: makeReaderChapter("ch1", 1), // Index 2
        currChapter: makeReaderChapter("ch2", 2), // Index 1
        nextChapter: makeReaderChapter("ch3", 3), // Index 0
      };

      // Action: Shift to Next (Ch3)
      const result = shiftWindowNext(initialViewer, allChapters, 1);

      expect(result).not.toBeNull();
      const { newViewer, newIndex } = result!;

      // Expect:
      // New Curr: Ch3
      // New Prev: Ch2
      // New Next: null (no Ch4)
      expect(newViewer.currChapter.chapter.id).toBe("ch3");
      expect(newViewer.prevChapter?.chapter.id).toBe("ch2");
      expect(newViewer.nextChapter).toBeNull();
      expect(newIndex).toBe(0);
    });

    it("returns null if no next chapter", () => {
      const initialViewer: ViewerChapters = {
        prevChapter: makeReaderChapter("ch2", 2),
        currChapter: makeReaderChapter("ch3", 3),
        nextChapter: null,
      };

      const result = shiftWindowNext(initialViewer, allChapters, 0);
      expect(result).toBeNull();
    });
  });

  describe("shiftWindowPrev (Moving to older chapter)", () => {
    it("shifts from Ch2 to Ch1", () => {
      // Start at Ch2
      const initialViewer: ViewerChapters = {
        prevChapter: makeReaderChapter("ch1", 1), // Index 2
        currChapter: makeReaderChapter("ch2", 2), // Index 1
        nextChapter: makeReaderChapter("ch3", 3), // Index 0
      };

      // Action: Shift to Prev (Ch1)
      const result = shiftWindowPrev(initialViewer, allChapters, 1);

      expect(result).not.toBeNull();
      const { newViewer, newIndex } = result!;

      // Expect:
      // New Curr: Ch1
      // New Next: Ch2
      // New Prev: null (no Ch0)
      expect(newViewer.currChapter.chapter.id).toBe("ch1");
      expect(newViewer.nextChapter?.chapter.id).toBe("ch2");
      expect(newViewer.prevChapter).toBeNull();
      expect(newIndex).toBe(2);
    });
  });
});