import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { MangaCard } from "@/shared/components";
import type { LibraryManga } from "../data/mockData";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LibraryGridProps = {
  manga: LibraryManga[];
  onMangaPress: (id: string) => void;
  numColumns?: number;
  ListHeaderComponent?: React.ReactElement;
};

export function LibraryGrid({
  manga,
  onMangaPress,
  numColumns = 2,
  ListHeaderComponent,
}: LibraryGridProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 w-full">
      <FlashList
        data={manga}
        numColumns={numColumns}
        // estimatedItemSize={280}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100, // Extra padding for tab bar
        }}
        renderItem={({ item }) => {
          // Calculate progress percentage
          const progress =
            item.totalChapters && item.currentChapter
              ? Math.round((item.currentChapter / item.totalChapters) * 100)
              : undefined;

          return (
            <View className="flex-1 p-2">
              <MangaCard
                id={item.id}
                title={item.title}
                coverUrl={item.cover}
                localCoverUrl={item.localCover}
                sourceId={item.sourceId}
                onPress={() => onMangaPress(item.id)}
                badge={
                  item.unreadCount && item.unreadCount > 0
                    ? `${item.unreadCount} NEW`
                    : item.readingStatus === "completed"
                    ? "COMPLETED"
                    : undefined
                }
                progress={progress}
                subtitle={
                  item.currentChapter 
                    ? `Ch. ${item.currentChapter}${item.lastPage ? ` (P. ${item.lastPage + 1})` : ""}` 
                    : undefined
                }
              />
            </View>
          );
        }}
      />
    </View>
  );
}
