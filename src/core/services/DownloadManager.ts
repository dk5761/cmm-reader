
import * as FileSystem from "expo-file-system/legacy";
import { Chapter, Page } from "@/sources";
import { useRepositories } from "@/core/database/repositories";
import { RealmMangaRepository } from "@/core/database/repositories/MangaRepository";
import { RealmChapterRepository } from "@/core/database/repositories/ChapterRepository";
import { getSource } from "@/sources";
import { logger } from "@/utils/logger";
import { Platform } from "react-native";

// Download Status Enum (matches Schema)
export enum DownloadStatus {
  NONE = 0,
  QUEUED = 1,
  DOWNLOADING = 2,
  DOWNLOADED = 3,
  ERROR = 4,
}

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

type DownloadTask = {
  chapter: Chapter;
  mangaId: string;
  sourceId: string;
};

class DownloadManagerClass {
  private isProcessing = false;
  private queue: DownloadTask[] = [];
  
  // Repositories (injected or accessed via singleton pattern if needed, but here we might need to pass realm instance)
  // For simplicity in a singleton service, we might need a way to access Realm outside React components.
  // Ideally, this service is initialized with Realm, or we use a global Realm instance helper if available.
  // Since we don't have a global Realm accessor easily without React, we might need to rely on the UI triggering processing, 
  // or pass the repositories when calling methods.
  
  // ACTUALLY: We can't use `useRepositories` (a hook) inside a class. 
  // We need to pass the repo or Realm instance. 
  // OR, we make this a Hook-based Context (`DownloadProvider`) which is very React-friendly.
  // Given we want background-ish behavior, a Context at the root (`_layout.tsx`) is the best "Mihon-way" for React Native.
  
  // Let's switch strategy slightly: Create `DownloadProvider` context that holds the logic.
}
