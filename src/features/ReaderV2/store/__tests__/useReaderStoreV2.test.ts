
import { useReaderStoreV2 } from "../useReaderStoreV2";
import type { ReaderChapter } from "../../types/reader.types";

// Mock helper to make testing easier
const makeReaderChapter = (id: string, number: number): ReaderChapter => ({
  chapter: {
    id,
    mangaId: "test-manga",
    number,
    url: "http://example.com",
    title: `Chapter ${number}`,
  },
  state: "loaded",
  pages: [{ index: 0, imageUrl: "img1", state: "queue" }],
});

describe("useReaderStoreV2", () => {
  beforeEach(() => {
    useReaderStoreV2.getState().reset();
  });

  it("initializes state correctly", () => {
    const chapters = [
      { id: "c3", number: 3, mangaId: "m1", url: "u" },
      { id: "c2", number: 2, mangaId: "m1", url: "u" },
      { id: "c1", number: 1, mangaId: "m1", url: "u" },
    ];

    useReaderStoreV2.getState().initialize({
      mangaId: "m1",
      sourceId: "s1",
      chapterId: "c2",
      chapters,
      initialPage: 0,
    });

    const state = useReaderStoreV2.getState();
    expect(state.currentChapterIndex).toBe(1);
    expect(state.mangaId).toBe("m1");
    expect(state.isInitialized).toBe(true);
  });

  it("updates active chapter metadata", () => {
    const chapters = [
      { id: "c2", number: 2, mangaId: "m1", url: "u" },
      { id: "c1", number: 1, mangaId: "m1", url: "u" },
    ];

    // Initialize with C2
    useReaderStoreV2.getState().initialize({
      mangaId: "m1",
      sourceId: "s1",
      chapterId: "c2",
      chapters,
    });

    // Simulate switching to C1
    useReaderStoreV2.getState().updateActiveChapter("c1", 0);

    const state = useReaderStoreV2.getState();
    expect(state.currentChapterIndex).toBe(1); // C1 is at index 1
  });

  it("emits scroll signal on seek", () => {
    // Setup state
    useReaderStoreV2.setState({ totalPages: 10 });

    useReaderStoreV2.getState().seekToPage(5);

    const state = useReaderStoreV2.getState();
    expect(state.isSeeking).toBe(true);
    expect(state.scrollSignal).toEqual({
      pageIndex: 5,
      animated: false,
      timestamp: expect.any(Number),
    });
  });

  it("prevents setCurrentPage jitter when seeking", () => {
    useReaderStoreV2.setState({ isSeeking: true, currentPage: 5 });

    // Try to set page to 6 while seeking
    useReaderStoreV2.getState().setCurrentPage(6);

    const state = useReaderStoreV2.getState();
    expect(state.currentPage).toBe(5); // Should not change
  });
});
