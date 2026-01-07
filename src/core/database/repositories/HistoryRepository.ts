import Realm from "realm";
import type { IHistoryRepository } from "./types";
import { ReadingHistorySchema } from "../schema";

export class RealmHistoryRepository implements IHistoryRepository {
  constructor(private realm: Realm) {}

  getHistory(): ReadingHistorySchema[] {
    return Array.from(
      this.realm.objects(ReadingHistorySchema).sorted("timestamp", true)
    );
  }

  async addToHistory(entry: Omit<ReadingHistorySchema, "id">): Promise<void> {
    const id = `${entry.mangaId}_${entry.chapterId}`;
    
    this.realm.write(() => {
      this.realm.create(
        ReadingHistorySchema,
        {
          id,
          ...entry,
          timestamp: Date.now(),
        },
        Realm.UpdateMode.Modified
      );
    });
  }

  async removeFromHistory(historyId: string): Promise<void> {
    const entry = this.realm.objectForPrimaryKey(ReadingHistorySchema, historyId);
    if (!entry) return;

    this.realm.write(() => {
      this.realm.delete(entry);
    });
  }

  async clearHistory(): Promise<void> {
    const all = this.realm.objects(ReadingHistorySchema);
    this.realm.write(() => {
      this.realm.delete(all);
    });
  }

  getLastRead(mangaId: string): ReadingHistorySchema | null {
    const entries = this.realm
      .objects(ReadingHistorySchema)
      .filtered("mangaId == $0", mangaId)
      .sorted("timestamp", true);
      
    return entries.length > 0 ? entries[0] : null;
  }
}
