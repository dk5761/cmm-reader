import { View, Text } from "react-native";

export default function LibraryScreen() {
  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Text className="text-white text-2xl font-bold">Library</Text>
      <Text className="text-gray-400 mt-2">Your manga collection</Text>
    </View>
  );
}
