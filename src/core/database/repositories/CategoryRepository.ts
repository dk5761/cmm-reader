import Realm from "realm";
import type { ICategoryRepository } from "./types";
import { CategorySchema, MangaSchema } from "../schema";

export class RealmCategoryRepository implements ICategoryRepository {
  constructor(private realm: Realm) {}

  getCategories(): CategorySchema[] {
    return Array.from(
      this.realm.objects(CategorySchema).sorted("order", false)
    );
  }

  async createCategory(name: string): Promise<void> {
    const categories = this.getCategories();
    // Auto-increment order
    const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 0;
    
    this.realm.write(() => {
      this.realm.create(CategorySchema, {
        id: crypto.randomUUID(),
        name,
        order: nextOrder,
        mangaIds: [],
      });
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const category = this.realm.objectForPrimaryKey(CategorySchema, id);
    if (!category) return;

    this.realm.write(() => {
      // Also remove this category from all mangas that have it
      // This is expensive if we have to iterate all mangas
      // Better: Iterate mangaIds in the category (if we had reverse link)
      // Since MangaSchema has `categories` list, we need to find mangas with this category
      const mangas = this.realm.objects(MangaSchema).filtered(`categories CONTAINS $0`, id);
      for (const manga of mangas) {
        const idx = manga.categories.indexOf(id);
        if (idx !== -1) manga.categories.splice(idx, 1);
      }
      this.realm.delete(category);
    });
  }

  async addMangaToCategory(categoryId: string, mangaId: string): Promise<void> {
    const category = this.realm.objectForPrimaryKey(CategorySchema, categoryId);
    const manga = this.realm.objectForPrimaryKey(MangaSchema, mangaId);
    
    if (!category || !manga) return;

    this.realm.write(() => {
      if (!category.mangaIds.includes(mangaId)) {
        category.mangaIds.push(mangaId);
      }
      if (!manga.categories.includes(categoryId)) {
        manga.categories.push(categoryId);
      }
    });
  }

  async removeMangaFromCategory(categoryId: string, mangaId: string): Promise<void> {
    const category = this.realm.objectForPrimaryKey(CategorySchema, categoryId);
    const manga = this.realm.objectForPrimaryKey(MangaSchema, mangaId);
    
    if (!category || !manga) return;

    this.realm.write(() => {
      const catIdx = category.mangaIds.indexOf(mangaId);
      if (catIdx !== -1) category.mangaIds.splice(catIdx, 1);

      const mangaIdx = manga.categories.indexOf(categoryId);
      if (mangaIdx !== -1) manga.categories.splice(mangaIdx, 1);
    });
  }

  async reorderCategories(categoryIds: string[]): Promise<void> {
    this.realm.write(() => {
      categoryIds.forEach((id, index) => {
        const cat = this.realm.objectForPrimaryKey(CategorySchema, id);
        if (cat) cat.order = index;
      });
    });
  }
}
