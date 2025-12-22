import { useState, useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { LibraryFilter, LibraryGrid } from "../components";
import { EmptyState } from "@/shared/components";
import { LIBRARY_FILTERS, MOCK_LIBRARY_DATA } from "../data/mockData";

export function LibraryScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("All");

  // Filter manga based on active filter
  const filteredManga = useMemo(() => {
    if (activeFilter === "All") return MOCK_LIBRARY_DATA;

    const statusMap: Record<string, string> = {
      Reading: "reading",
      Completed: "completed",
      "Plan to Read": "plan_to_read",
      "On Hold": "on_hold",
      Dropped: "dropped",
    };

    return MOCK_LIBRARY_DATA.filter(
      (manga) => manga.readingStatus === statusMap[activeFilter]
    );
  }, [activeFilter]);

  const handleMangaPress = (id: string) => {
    router.push(`/manga/${id}`);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Grid with filters as list header */}
      <LibraryGrid
        manga={filteredManga}
        onMangaPress={handleMangaPress}
        ListHeaderComponent={
          <View className="pb-4">
            <LibraryFilter
              filters={LIBRARY_FILTERS}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </View>
        }
      />

      {/* Empty State Overlay */}
      {filteredManga.length === 0 && (
        <View className="absolute inset-x-0 top-1/3">
          <EmptyState
            icon="book-outline"
            title="No manga found"
            description={`No titles in "${activeFilter}"`}
          />
        </View>
      )}
    </View>
  );
}
