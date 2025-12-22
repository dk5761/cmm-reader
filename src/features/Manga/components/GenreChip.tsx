import { View, Text } from "react-native";

type GenreChipProps = {
  genre: string;
};

export function GenreChip({ genre }: GenreChipProps) {
  return (
    <View className="px-3 py-1 rounded-full border border-primary bg-primary/10">
      <Text className="text-primary text-[10px] font-bold uppercase tracking-wide">
        {genre}
      </Text>
    </View>
  );
}
