
import { View } from "react-native";
import { Skeleton } from "../Skeleton";

/**
 * Skeleton loader for a single Manga Card.
 * Matches the 'MangaCard' layout exactly:
 * - 2/3 aspect ratio
 * - Title and subtitle skeletons inside the card at the bottom
 */
export function MangaCardSkeleton() {
  return (
    <View 
      className="w-full aspect-2/3 rounded-xl overflow-hidden bg-zinc-800/50"
      style={{ borderRadius: 12 }}
    >
      {/* Background fill */}
      <Skeleton
        width="100%"
        height="100%"
        borderRadius={0}
      />
      
      {/* Overlay content (bottom) */}
      <View className="absolute bottom-0 left-0 right-0 p-3">
        {/* Title Line 1 */}
        <Skeleton width="85%" height={12} borderRadius={4} className="mb-1.5" />
        {/* Title Line 2 or Subtitle */}
        <Skeleton width="50%" height={10} borderRadius={4} />
      </View>
    </View>
  );
}
