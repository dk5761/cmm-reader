
import { RealmMangaRepository } from "../MangaRepository";
import { RealmChapterRepository } from "../ChapterRepository";
import { RealmHistoryRepository } from "../HistoryRepository";
import { RealmCategoryRepository } from "../CategoryRepository";
import { MockRealm } from "./MockRealm";
import { MangaSchema } from "../../schema";
import type { MangaDetails, Chapter } from "@/sources";

describe("Repositories", () => {
  let realm: MockRealm;
  let mangaRepo: RealmMangaRepository;
  let chapterRepo: RealmChapterRepository;
  let historyRepo: RealmHistoryRepository;
  let categoryRepo: RealmCategoryRepository;

  beforeEach(() => {
    realm = new MockRealm();
    mangaRepo = new RealmMangaRepository(realm as any);
    chapterRepo = new RealmChapterRepository(realm as any);
    historyRepo = new RealmHistoryRepository(realm as any);
    categoryRepo = new RealmCategoryRepository(realm as any);
  });

  describe("MangaRepository", () => {
    const mockManga: MangaDetails = {
      id: "test-manga",
      sourceId: "asurascans",
      title: "Test Manga",
      url: "http://test.com",
      cover: "http://test.com/cover.jpg",
      genres: ["Action", "Adventure"],
    };

    it("adds manga to library", async () => {
      await mangaRepo.addManga(mockManga, true);
      
      const compoundId = `${mockManga.sourceId}_${mockManga.id}`;
      const stored = mangaRepo.getManga(compoundId);
      expect(stored).not.toBeNull();
      expect(stored?.title).toBe(mockManga.title);
      expect(stored?.inLibrary).toBe(true);
    });

    it("removes manga from library but keeps record", async () => {
      await mangaRepo.addManga(mockManga, true);
      const compoundId = `${mockManga.sourceId}_${mockManga.id}`;
      await mangaRepo.removeFromLibrary(compoundId);
      
      const stored = mangaRepo.getManga(compoundId);
      expect(stored).not.toBeNull();
      expect(stored?.inLibrary).toBe(false);
    });
  });

  describe("ChapterRepository", () => {
    const mangaId = "asurascans_test-manga"; // Use compound ID
    const rawMangaId = "test-manga";
    const sourceId = "asurascans";
    const chapters: Chapter[] = [
      { id: "ch1", number: 1, url: "u1", mangaId }, // Chapter still has raw mangaId refernece potentially, but repo doesn't care about chapter.mangaId property much, it embeds them.
      { id: "ch2", number: 2, url: "u2", mangaId },
    ];

    it("saves chapters and maintains order", async () => {
      // First create the manga
      await mangaRepo.addManga({ id: rawMangaId, title: "Test", url: "u", sourceId: sourceId, cover: "" }, true);
      
      await chapterRepo.saveChapters(mangaId, chapters);
      
      const stored = chapterRepo.getChapters(mangaId);
      expect(stored).toHaveLength(2);
      expect(stored[0].id).toBe("ch1");
    });

    it("does not trigger write if chapters are identical (diff check)", async () => {
      await mangaRepo.addManga({ id: rawMangaId, title: "Test", url: "u", sourceId: sourceId, cover: "" }, true);
      await chapterRepo.saveChapters(mangaId, chapters);
      
      const writeSpy = jest.spyOn(realm, 'write');
      
      // Save same chapters again
      await chapterRepo.saveChapters(mangaId, chapters);
      
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("marks chapter as read", async () => {
      await mangaRepo.addManga({ id: rawMangaId, title: "Test", url: "u", sourceId: sourceId, cover: "" }, true);
      await chapterRepo.saveChapters(mangaId, chapters);
      
      await chapterRepo.markAsRead("ch1", true);
      
      const chapter = chapterRepo.getChapter("ch1");
      expect(chapter?.isRead).toBe(true);
    });
  });

  describe("HistoryRepository", () => {
    it("adds entry to history", async () => {
      const entry = {
        mangaId: "m1",
        mangaTitle: "Manga 1",
        chapterId: "c1",
        chapterNumber: 1,
        chapterUrl: "u1",
        pageReached: 5,
        sourceId: "s1",
        timestamp: Date.now(),
      };

      await historyRepo.addToHistory(entry as any);
      
      const history = historyRepo.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].mangaId).toBe("m1");
    });
  });

  describe("CategoryRepository", () => {
    it("creates and deletes categories", async () => {
      await categoryRepo.createCategory("Action");
      
      let categories = categoryRepo.getCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe("Action");

      const catId = categories[0].id;
      await categoryRepo.deleteCategory(catId);
      
      categories = categoryRepo.getCategories();
      expect(categories).toHaveLength(0);
    });
  });
});
