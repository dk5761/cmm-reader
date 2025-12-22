import { ReactNode } from "react";
import { Text, View } from "react-native";

type HeaderTitleProps = {
  children: ReactNode;
  className?: string;
};

export function HeaderTitle({ children, className }: HeaderTitleProps) {
  const isString = typeof children === "string";

  return (
    <View className="flex-1 items-center justify-center">
      {isString ? (
        <Text
          className={`text-white text-lg font-semibold ${className ?? ""}`}
          numberOfLines={1}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
