
import type { Chapter } from "@/sources";
import type { ViewerChapters, ReaderChapter } from "../types/reader.types";

/**
 * Pure function to calculate the new ViewerChapters when shifting to the next chapter.
 * 
 * Logic:
 * 1. Current Next -> becomes New Current
 * 2. Current Current -> becomes New Prev
 * 3. Calculate New Next from allChapters list
 */
export function shiftWindowNext(
  currentViewer: ViewerChapters,
  allChapters: Chapter[],
  currentIndex: number
): { 
  newViewer: ViewerChapters; 
  newIndex: number; 
} | null {
  const { currChapter, nextChapter } = currentViewer;

  if (!nextChapter || nextChapter.state !== "loaded") {
    return null;
  }

  // New Current is the old Next
  const newCurrChapter = nextChapter;
  
  // New Index (since chapters are usually reverse chronological, prev is higher index, next is lower)
  // But we trust the caller to verify indices. Here we just assume we moved to 'nextChapter'
  // We need to find the index of the new current chapter in allChapters
  const newIndex = allChapters.findIndex(c => c.id === newCurrChapter.chapter.id);
  
  if (newIndex === -1) return null;

  // New Previous is the old Current (kept loaded for back-scroll)
  const newPrevChapter: ReaderChapter = {
    ...currChapter,
  };

  // Calculate New Next
  // Note: allChapters is typically [Latest, ..., Oldest]
  // So "Next" chapter (chronologically newer) usually has a LOWER index? 
  // WAIT: ReaderStoreV2.ts logic says: 
  // prevChapter = currentChapterIndex < allChapters.length - 1 ? allChapters[currentIndex + 1]
  // nextChapter = currentChapterIndex > 0 ? allChapters[currentIndex - 1]
  
  // So "Next" means "Newer" chapter (lower index)
  
  const newNextChapter: ReaderChapter | null =
    newIndex > 0
      ? {
          chapter: allChapters[newIndex - 1],
          state: "wait",
          pages: [],
        }
      : null;

  return {
    newViewer: {
      prevChapter: newPrevChapter,
      currChapter: newCurrChapter,
      nextChapter: newNextChapter,
    },
    newIndex,
  };
}

/**
 * Pure function to calculate the new ViewerChapters when shifting to the previous chapter.
 * 
 * Logic:
 * 1. Current Prev -> becomes New Current
 * 2. Current Current -> becomes New Next
 * 3. Calculate New Prev from allChapters list
 */
export function shiftWindowPrev(
  currentViewer: ViewerChapters,
  allChapters: Chapter[],
  currentIndex: number
): { 
  newViewer: ViewerChapters; 
  newIndex: number; 
} | null {
  const { prevChapter, currChapter } = currentViewer;

  if (!prevChapter || prevChapter.state !== "loaded") {
    return null;
  }

  // New Current is the old Prev
  const newCurrChapter = prevChapter;

  const newIndex = allChapters.findIndex(c => c.id === newCurrChapter.chapter.id);
  if (newIndex === -1) return null;

  // New Next is the old Current
  const newNextChapter: ReaderChapter = {
    ...currChapter,
  };

  // Calculate New Prev (Older chapter, higher index)
  const newPrevChapter: ReaderChapter | null =
    newIndex < allChapters.length - 1
      ? {
          chapter: allChapters[newIndex + 1],
          state: "wait",
          pages: [],
        }
      : null;

  return {
    newViewer: {
      prevChapter: newPrevChapter,
      currChapter: newCurrChapter,
      nextChapter: newNextChapter,
    },
    newIndex,
  };
}
