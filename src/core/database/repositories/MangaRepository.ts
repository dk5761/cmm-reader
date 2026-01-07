import Realm from "realm";
import type { IMangaRepository } from "./types";
import { MangaSchema } from "../schema";
import type { MangaDetails } from "@/sources";

export class RealmMangaRepository implements IMangaRepository {
  constructor(private realm: Realm) {}

  getManga(id: string): MangaSchema | null {
    return this.realm.objectForPrimaryKey(MangaSchema, id);
  }

  getAllManga(): MangaSchema[] {
    return Array.from(this.realm.objects(MangaSchema));
  }

  getLibraryManga(): MangaSchema[] {
    return Array.from(this.realm.objects(MangaSchema).filtered("inLibrary == true SORT(title ASC)"));
  }

  async addManga(manga: MangaDetails, inLibrary = false): Promise<void> {
    const existing = this.getManga(manga.id);
    this.realm.write(() => {
      if (existing) {
        // Update existing
        existing.title = manga.title;
        existing.cover = manga.cover;
        existing.author = manga.author;
        existing.artist = manga.artist;
        existing.description = manga.description;
        existing.status = manga.status;
        if (inLibrary && !existing.inLibrary) {
          existing.inLibrary = true;
          existing.addedAt = Date.now();
        }
        // Update genres
        if (manga.genres) {
          existing.genres = manga.genres as unknown as Realm.List<string>;
        }
      } else {
        // Create new
        this.realm.create(MangaSchema, {
          ...manga,
          inLibrary,
          addedAt: Date.now(),
          genres: manga.genres || [],
          chapters: [],
          categories: [],
        });
      }
    });
  }

  async updateManga(id: string, updates: Partial<MangaSchema>): Promise<void> {
    const manga = this.getManga(id);
    if (!manga) return;

    this.realm.write(() => {
      Object.assign(manga, updates);
      manga.lastUpdated = Date.now();
    });
  }

  async removeFromLibrary(id: string): Promise<void> {
    const manga = this.getManga(id);
    if (!manga) return;

    this.realm.write(() => {
      manga.inLibrary = false;
      manga.categories = [] as unknown as Realm.List<string>;
    });
  }

  isInLibrary(id: string): boolean {
    const manga = this.getManga(id);
    return manga?.inLibrary ?? false;
  }

  search(query: string): MangaSchema[] {
    return Array.from(
      this.realm
        .objects(MangaSchema)
        .filtered("title CONTAINS[c] $0", query)
    );
  }
}
