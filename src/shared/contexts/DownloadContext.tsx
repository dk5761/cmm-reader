
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { useRepositories } from "@/core/database/repositories";
import { getSource } from "@/sources";
import { logger } from "@/utils/logger";
import { Chapter } from "@/sources";
import { useRealm } from "@realm/react";
import { MangaSchema } from "@/core/database";

export enum DownloadStatus {
  NONE = 0,
  QUEUED = 1,
  DOWNLOADING = 2,
  DOWNLOADED = 3,
  ERROR = 4,
}

type DownloadContextType = {
  queueDownload: (chapter: Chapter, mangaId: string, sourceId: string) => void;
  cancelDownload: (chapterId: string) => void;
  pauseDownloads: () => void;
  resumeDownloads: () => void;
  isDownloading: boolean;
  currentDownload: string | null; // Chapter ID
};

const DownloadContext = createContext<DownloadContextType | null>(null);

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const { chapter: chapterRepo, manga: mangaRepo } = useRepositories();
  const realm = useRealm();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const isPausedRef = useRef(false);
  
  // Ensure downloads directory exists
  useEffect(() => {
    (async () => {
      const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
      }
    })();
  }, []);

  // Queue Processing Loop
  const processQueue = useCallback(async () => {
    if (isProcessing || isPausedRef.current) return;
    
    // Find next queued chapter
    // We need to query Realm for chapters with status = QUEUED
    // Since chapters are embedded, we query Mangas that have such chapters
    // optimizing this query is tricky with embedded objects. 
    // "manga.chapters.downloadStatus == 1"
    
    const mangasWithQueued = realm.objects(MangaSchema).filtered("chapters.downloadStatus == $0", DownloadStatus.QUEUED);
    
    let targetChapter: { chapter: any, mangaId: string, sourceId: string } | null = null;
    
    // Find the first queued chapter (FIFO effectively, or by order)
    for (const manga of mangasWithQueued) {
      const queuedChapter = manga.chapters.find(c => c.downloadStatus === DownloadStatus.QUEUED);
      if (queuedChapter) {
        targetChapter = { 
          chapter: queuedChapter, 
          mangaId: manga.id, 
          sourceId: manga.sourceId 
        };
        break;
      }
    }

    if (!targetChapter) {
      setIsProcessing(false);
      setCurrentChapterId(null);
      return;
    }

    setIsProcessing(true);
    setCurrentChapterId(targetChapter.chapter.id);

    try {
      await downloadChapter(targetChapter.chapter, targetChapter.mangaId, targetChapter.sourceId);
    } catch (error) {
      logger.error("Download failed", { error, chapterId: targetChapter.chapter.id });
      // Mark as error
      realm.write(() => {
        targetChapter!.chapter.downloadStatus = DownloadStatus.ERROR;
      });
    } finally {
      setIsProcessing(false);
      // Loop
      setTimeout(processQueue, 500);
    }
  }, [isProcessing, realm]);

  // Trigger processing on mount and when queue changes (handled by effect below)
  useEffect(() => {
    processQueue();
  }, []);

  // The actual download logic
  const downloadChapter = async (chapterRealmObj: any, mangaId: string, sourceId: string) => {
    const chapterId = chapterRealmObj.id;
    const chapterDir = `${DOWNLOADS_DIR}${sourceId}/${mangaId}/${chapterId}/`;
    
    // 1. Set status to DOWNLOADING
    realm.write(() => {
      chapterRealmObj.downloadStatus = DownloadStatus.DOWNLOADING;
    });

    // 2. Fetch pages
    const source = getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    
    // We need the chapter URL. chapterRealmObj has it.
    const pages = await source.getPageList(chapterRealmObj.url);
    
    // 3. Update total pages
    realm.write(() => {
      chapterRealmObj.downloadTotal = pages.length;
    });

    // 4. Create directory
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

    // 5. Download pages
    // Resume support: check which files already exist? 
    // Or check `downloadedCount`? We'll trust file system check for robustness.
    
    let downloaded = 0;
    
    for (const page of pages) {
      if (isPausedRef.current) break;

      const filename = `${page.index.toString().padStart(3, "0")}.jpg`; // Simple 001.jpg
      const fileUri = `${chapterDir}${filename}`;
      
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        downloaded++;
        continue; // Skip existing
      }

      // Download
      // TODO: Handle headers (referer)
      const headers = page.headers || source.getImageHeaders();
      await FileSystem.downloadAsync(page.imageUrl, fileUri, { headers });
      
      downloaded++;
      
      // Update progress
      realm.write(() => {
        chapterRealmObj.downloadedCount = downloaded;
      });
    }

    // 6. Finish
    if (!isPausedRef.current) {
        realm.write(() => {
            chapterRealmObj.downloadStatus = DownloadStatus.DOWNLOADED;
        });
        logger.log("Download complete", { chapterId });
    }
  };

  const queueDownload = useCallback((chapter: Chapter, mangaId: string, sourceId: string) => {
    const realmChapter = chapterRepo.getChapter(chapter.id);
    if (realmChapter) {
        realm.write(() => {
            realmChapter.downloadStatus = DownloadStatus.QUEUED;
        });
        // Trigger loop
        setTimeout(processQueue, 100);
    }
  }, [chapterRepo, realm, processQueue]);

  const cancelDownload = useCallback((chapterId: string) => {
    // TODO: Delete files and reset status
    const realmChapter = chapterRepo.getChapter(chapterId);
    if (realmChapter) {
        realm.write(() => {
            realmChapter.downloadStatus = DownloadStatus.NONE;
            realmChapter.downloadedCount = 0;
            realmChapter.downloadTotal = 0;
        });
        // Note: Actual file deletion should ideally happen here too
    }
  }, [chapterRepo, realm]);

  return (
    <DownloadContext.Provider value={{
      queueDownload,
      cancelDownload,
      pauseDownloads: () => { isPausedRef.current = true; },
      resumeDownloads: () => { isPausedRef.current = false; processQueue(); },
      isDownloading: isProcessing,
      currentDownload: currentChapterId
    }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloadManager() {
  const context = useContext(DownloadContext);
  if (!context) throw new Error("useDownloadManager must be used within DownloadProvider");
  return context;
}
