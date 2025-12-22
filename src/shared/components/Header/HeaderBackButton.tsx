import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type HeaderBackButtonProps = {
  tintColor?: string;
  onPress?: () => void;
};

export function HeaderBackButton({
  tintColor = "#fff",
  onPress,
}: HeaderBackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      className="p-2 -ml-2 active:opacity-60"
    >
      <Ionicons name="chevron-back" size={24} color={tintColor} />
    </Pressable>
  );
}
