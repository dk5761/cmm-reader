import { View, Text } from "react-native";

export default function UpdatesScreen() {
  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Text className="text-white text-2xl font-bold">Updates</Text>
      <Text className="text-gray-400 mt-2">New chapter releases</Text>
    </View>
  );
}
