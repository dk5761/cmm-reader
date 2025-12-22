import { ScrollView, Pressable, Text, View } from "react-native";

type LibraryFilterProps<T extends string> = {
  filters: readonly T[];
  activeFilter: T;
  onFilterChange: (filter: T) => void;
};

export function LibraryFilter<T extends string>({
  filters,
  activeFilter,
  onFilterChange,
}: LibraryFilterProps<T>) {
  // We can use these if we want dynamic non-tailwind colors,
  // but className logic is easier for switching bg colors.

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        className="py-2"
      >
        {filters.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <Pressable
              key={filter}
              onPress={() => onFilterChange(filter)}
              className={`px-4 py-1.5 rounded-full border ${
                isActive
                  ? "bg-primary border-primary"
                  : "bg-card border-border-subtle"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isActive ? "text-black" : "text-muted"
                }`}
              >
                {filter}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
