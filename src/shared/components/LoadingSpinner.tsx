import { View, ActivityIndicator } from "react-native";

type LoadingSpinnerProps = {
  size?: "small" | "large";
  color?: string;
  fullScreen?: boolean;
};

export function LoadingSpinner({
  size = "large",
  color = "#6366f1",
  fullScreen = false,
}: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }

  return <ActivityIndicator size={size} color={color} />;
}
