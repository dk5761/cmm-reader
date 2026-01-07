
import "./firebaseMocks"; // Must be first
import { SyncService } from "../SyncService";
import { writeBatch } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SYNC_CONFIG } from "../config";

describe("SyncService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    // Reset private queue via a theoretical reset method or by relying on clearQueue
    return SyncService.clearQueue();
  });

  describe("Queue Management", () => {
    it("enqueues events and persists them", async () => {
      await SyncService.enqueue({
        type: "manga_added",
        entityId: "m1",
        data: { id: "m1", title: "Test" } as any,
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining("sync_queue"),
        expect.stringContaining("manga_added")
      );
      
      const queue = SyncService.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe("manga_added");
    });

    it("deduplicates events for same entity", async () => {
      await SyncService.enqueue({
        type: "manga_updated",
        entityId: "m1",
        data: { title: "Update 1" } as any,
      });

      await SyncService.enqueue({
        type: "manga_updated",
        entityId: "m1",
        data: { title: "Update 2" } as any,
      });

      const queue = SyncService.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].data).toEqual({ title: "Update 2" });
    });
  });

  describe("Batch Processing", () => {
    it("batches updates correctly", async () => {
      // Add multiple events
      await SyncService.enqueue({ type: "manga_added", entityId: "m1", data: { id: "m1" } as any });
      await SyncService.enqueue({ type: "manga_added", entityId: "m2", data: { id: "m2" } as any });
      await SyncService.enqueue({ type: "history_added", entityId: "h1", data: { id: "h1" } as any });

      // Trigger sync
      await SyncService.flush();

      // Verify batch creation
      expect(writeBatch).toHaveBeenCalled();
      
      const mockBatch = (writeBatch as jest.Mock).mock.results[0].value;
      
      // Should have setDoc calls for each event
      expect(mockBatch.set).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("handles large batches (mock limit)", async () => {
      // Mock batch size to 2 for testing
      const originalLimit = SYNC_CONFIG.BATCH_SIZE;
      (SYNC_CONFIG as any).BATCH_SIZE = 2;

      await SyncService.enqueue({ type: "manga_added", entityId: "m1", data: {} as any });
      await SyncService.enqueue({ type: "manga_added", entityId: "m2", data: {} as any });
      await SyncService.enqueue({ type: "manga_added", entityId: "m3", data: {} as any });

      await SyncService.flush();

      // Should create 2 batches (2 + 1 items)
      // Note: Implementation creates new batch AFTER hitting limit
      // or at end.
      
      // Let's verify commit calls
      const mockBatch = (writeBatch as jest.Mock).mock.results[0].value;
      // We expect commit to be called for the first batch, then a new batch created
      
      // In current impl:
      // Loop 1: op=1
      // Loop 2: op=2 -> commit, new batch, op=0
      // Loop 3: op=1
      // End: commit remaining
      
      // So we expect at least 2 commits total across all batch instances
      // But since we mock writeBatch to return the SAME object instance in our simple mock,
      // we just check commit call count.
      expect(mockBatch.commit).toHaveBeenCalledTimes(2);

      // Restore config
      (SYNC_CONFIG as any).BATCH_SIZE = originalLimit;
    });
  });
});
