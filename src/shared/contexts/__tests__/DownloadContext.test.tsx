
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { DownloadProvider, useDownloadManager, DownloadStatus } from "../DownloadContext";
import { useRepositories } from "@/core/database/repositories";
import { getSource } from "@/sources";
import * as FileSystem from "expo-file-system/legacy";
import { MockRealm } from "@/core/database/repositories/__tests__/MockRealm";

// Mock dependencies
jest.mock("@/core/database/repositories", () => ({
  useRepositories: jest.fn(),
}));

jest.mock("@/sources", () => ({
  getSource: jest.fn(),
}));

jest.mock("@realm/react", () => ({
  useRealm: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///test/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

describe("DownloadManager", () => {
  let mockRealm: MockRealm;
  let mockChapterRepo: any;
  let mockMangaRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRealm = new MockRealm();
    
    mockChapterRepo = {
      getChapter: jest.fn(),
    };
    
    mockMangaRepo = {
      // Mock manga repo if needed
    };

    (useRepositories as jest.Mock).mockReturnValue({
      chapter: mockChapterRepo,
      manga: mockMangaRepo,
    });

    const { useRealm } = require("@realm/react");
    useRealm.mockReturnValue(mockRealm);

    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 200 });
  });

  it("queues a download", async () => {
    const chapter = { id: "c1", url: "u1", number: 1, mangaId: "m1" };
    const realmChapter = { id: "c1", downloadStatus: 0 };
    
    mockChapterRepo.getChapter.mockReturnValue(realmChapter);

    const { result } = renderHook(() => useDownloadManager(), {
      wrapper: DownloadProvider,
    });

    await act(async () => {
      result.current.queueDownload(chapter as any, "m1", "s1");
    });

    // Verify status update in Realm
    // Since MockRealm.write executes immediately:
    expect(realmChapter.downloadStatus).toBe(DownloadStatus.QUEUED);
  });

  it("processes the queue", async () => {
    // Setup queued chapter in Realm
    const chapter = { 
      id: "c1", 
      url: "chapter-url", 
      downloadStatus: DownloadStatus.QUEUED,
      downloadTotal: 0,
      downloadedCount: 0 
    };
    
    const manga = {
      id: "m1",
      sourceId: "s1",
      chapters: [chapter],
    };

    // Inject into MockRealm
    mockRealm.create("Manga", manga);

    // Mock Source
    (getSource as jest.Mock).mockReturnValue({
      getPageList: jest.fn().mockResolvedValue([
        { index: 0, imageUrl: "img1" },
        { index: 1, imageUrl: "img2" },
      ]),
      getImageHeaders: jest.fn().mockReturnValue({}),
    });

    const { result } = renderHook(() => useDownloadManager(), {
      wrapper: DownloadProvider,
    });

    // Wait for processing loop to pick it up
    // This is tricky with `setTimeout` loop in implementation. 
    // We might need to advance timers or rely on waitFor.
    
    // Trigger processQueue manually or wait for effect
    // Effect runs on mount.
    
    await waitFor(() => {
        // Check if status changed to DOWNLOADING or DOWNLOADED
        // Note: Our MockRealm updates references in place
        return chapter.downloadStatus === DownloadStatus.DOWNLOADED;
    }, { timeout: 2000 });

    expect(chapter.downloadStatus).toBe(DownloadStatus.DOWNLOADED);
    expect(chapter.downloadTotal).toBe(2);
    expect(chapter.downloadedCount).toBe(2);
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
  });
});
