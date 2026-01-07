
import { View } from "react-native";
import { MangaCardSkeleton } from "./MangaCardSkeleton";

/**
 * Skeleton loader for the Library/Browse grid.
 * Matches the 'LibraryGrid' layout exactly:
 * - 16px horizontal padding
 * - 12px gap between columns
 */
export function LibraryGridSkeleton() {
  return (
    <View className="flex-row flex-wrap px-4 pt-2" style={{ paddingHorizontal: 16 }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View 
          key={index} 
          className="w-1/2" 
          style={{ 
            padding: 6, // Total 12px gap between items (6+6)
          }}
        >
          <MangaCardSkeleton />
        </View>
      ))}
    </View>
  );
}
