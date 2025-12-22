import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

type TabBarConfig = {
  icons?: Record<string, keyof typeof Ionicons.glyphMap>;
  activeColor?: string;
  inactiveColor?: string;
};

const defaultIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  library: "book",
  browse: "compass-outline",
  updates: "time-outline",
  settings: "ellipsis-horizontal",
};

const defaultConfig: Required<TabBarConfig> = {
  icons: defaultIcons,
  activeColor: "#22d3ee",
  inactiveColor: "#94a3b8",
};

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  config = {},
}: BottomTabBarProps & { config?: TabBarConfig }) {
  const insets = useSafeAreaInsets();
  const mergedConfig = { ...defaultConfig, ...config };

  return (
    <View
      className="absolute left-6 right-6"
      style={{ bottom: insets.bottom + 16 }}
    >
      <View className="flex-row bg-slate-800 rounded-[8px] border border-slate-700 h-[70px] items-center px-2">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const color = isFocused
            ? mergedConfig.activeColor
            : mergedConfig.inactiveColor;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              className="flex-1 items-center justify-center py-2"
            >
              <Ionicons
                name={mergedConfig.icons[route.name] ?? "help-circle"}
                size={22}
                color={color}
              />
              <Text className="text-xs font-medium mt-1" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
