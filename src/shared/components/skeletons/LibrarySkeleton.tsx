
import { View } from "react-native";
import { MangaCardSkeleton } from "./MangaCardSkeleton";

/**
 * Skeleton loader for the Library/Browse grid
 * Renders a grid of 6 MangaCardSkeletons
 */
export function LibraryGridSkeleton() {
  return (
    <View className="flex-row flex-wrap px-4 pt-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} className="w-1/2 p-2">
          <MangaCardSkeleton />
        </View>
      ))}
    </View>
  );
}
