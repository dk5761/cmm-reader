import { ReactNode } from "react";
import { View } from "react-native";

type HeaderLeftProps = {
  children: ReactNode;
  className?: string;
};

export function HeaderLeft({ children, className }: HeaderLeftProps) {
  return (
    <View className={`flex-row items-center min-w-12 ${className ?? ""}`}>
      {children}
    </View>
  );
}
