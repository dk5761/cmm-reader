import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
};

export function EmptyState({
  icon = "book-outline",
  title,
  description,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Ionicons name={icon} size={64} color="#3f3f46" />
      <Text className="text-zinc-400 text-lg font-semibold mt-4 text-center">
        {title}
      </Text>
      {description && (
        <Text className="text-zinc-500 text-sm mt-2 text-center">
          {description}
        </Text>
      )}
    </View>
  );
}
