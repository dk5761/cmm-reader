
import { toCloudManga, toCloudCategory, importFromCloud, setSyncingFromCloud } from "../RealmSyncBridge";
import { MockRealm } from "../../database/repositories/__tests__/MockRealm";
import { SyncService } from "../SyncService";

// Mock database index to avoid JSX parsing issues in logic tests
jest.mock("@/core/database", () => ({
  MangaSchema: class { static schema: any = { name: "Manga" }; },
  ReadingHistorySchema: class { static schema: any = { name: "ReadingHistory" }; },
  CategorySchema: class { static schema: any = { name: "Category" }; },
}));

// Mock SyncService to avoid side effects
jest.mock("../SyncService", () => ({
  SyncService: {
    enqueue: jest.fn(),
  },
}));

describe("RealmSyncBridge", () => {
  let realm: MockRealm;

  beforeEach(() => {
    realm = new MockRealm();
    jest.clearAllMocks();
    setSyncingFromCloud(false);
  });

  describe("toCloudManga Mapping", () => {
    it("converts Realm Manga to POJO correctly", () => {
      const realmManga = {
        id: "m1",
        sourceId: "s1",
        inLibrary: true,
        title: "Manga 1",
        url: "u1",
        addedAt: 100,
        genres: ["Action"],
        chapters: [
          { id: "c1", number: 1, isRead: true, lastPageRead: 10 }
        ],
        progress: {
          lastChapterId: "c1",
          lastPage: 5,
          timestamp: 200,
        },
        categories: ["cat1"],
      };

      const cloudManga = (toCloudManga as any)(realmManga);

      expect(cloudManga.id).toBe("m1");
      expect(cloudManga.genres).toEqual(["Action"]);
      expect(cloudManga.categories).toEqual(["cat1"]);
      expect(cloudManga.chapters[0].isRead).toBe(true);
      expect(cloudManga.progress.lastChapterId).toBe("c1");
    });
  });

  describe("importFromCloud", () => {
    it("merges progress using Math.max", () => {
      // Local setup: Ch1 read 5 pages
      const localManga = {
        id: "m1",
        chapters: [{ id: "c1", number: 1, isRead: false, lastPageRead: 5 }]
      };
      realm.create("Manga", localManga);

      // Cloud data: Ch1 read 10 pages
      const cloudData = {
        manga: [{
          id: "m1",
          sourceId: "s1",
          inLibrary: true,
          title: "Manga 1",
          url: "u1",
          chapters: [{ id: "c1", number: 1, isRead: true, lastPageRead: 10 }]
        }],
        history: []
      };

      importFromCloud(realm as any, cloudData as any);

      const updated = realm.objectForPrimaryKey("Manga", "m1");
      expect(updated.chapters[0].isRead).toBe(true);
      expect(updated.chapters[0].lastPageRead).toBe(10);
    });
  });
});
