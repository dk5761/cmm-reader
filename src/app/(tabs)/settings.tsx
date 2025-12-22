import { View, Text } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Text className="text-white text-2xl font-bold">Settings</Text>
      <Text className="text-gray-400 mt-2">App preferences</Text>
    </View>
  );
}
