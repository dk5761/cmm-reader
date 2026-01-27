import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

type SearchBarProps = {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
};

export function SearchBar({
  placeholder = "Search...",
  value,
  onChangeText,
  onSubmitEditing,
}: SearchBarProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const placeholderColor =
    typeof mutedColor === "string" ? mutedColor : "#71717a";

  return (
    <View className="flex-row items-center bg-surface rounded-full px-4 py-1 gap-2  h-12">
      <Ionicons name="search" size={20} color={placeholderColor} />
      <TextInput
        className="flex-1 text-foreground text-base h-full"
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        textAlignVertical="center"
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"

        style={{ includeFontPadding: false, paddingBottom: 6 }} // Android text alignment fix
      />
    </View>
  );
}
