
import { View } from "react-native";
import { Skeleton } from "../Skeleton";

/**
 * Skeleton loader for a single Manga Card
 * Mimics the aspect ratio and layout of the real MangaCard
 */
export function MangaCardSkeleton() {
  return (
    <View className="w-full mb-4">
      {/* Cover Image */}
      <Skeleton
        width="100%"
        style={{ aspectRatio: 2 / 3 }}
        borderRadius={12}
        className="mb-2"
      />
      
      {/* Title Lines */}
      <Skeleton width="90%" height={12} borderRadius={4} className="mb-1" />
      <Skeleton width="60%" height={12} borderRadius={4} />
    </View>
  );
}
