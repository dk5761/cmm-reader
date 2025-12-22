import { ReactNode } from "react";
import { View } from "react-native";

type HeaderRightProps = {
  children: ReactNode;
  className?: string;
};

export function HeaderRight({ children, className }: HeaderRightProps) {
  return (
    <View
      className={`flex-row items-center justify-end min-w-12 gap-2 ${
        className ?? ""
      }`}
    >
      {children}
    </View>
  );
}
