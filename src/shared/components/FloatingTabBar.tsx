import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

type TabBarConfig = {
  icons?: Record<string, keyof typeof Ionicons.glyphMap>;
  activeColor?: string;
  inactiveColor?: string;
  backgroundColor?: string;
  borderColor?: string;
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
  backgroundColor: "#1e293b",
  borderColor: "#334155",
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
      style={{
        position: "absolute",
        bottom: insets.bottom + 16,
        left: 24,
        right: 24,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: mergedConfig.backgroundColor,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: mergedConfig.borderColor,
          height: 70,
          alignItems: "center",
          paddingHorizontal: 8,
        }}
      >
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
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 8,
              }}
            >
              <Ionicons
                name={mergedConfig.icons[route.name] ?? "help-circle"}
                size={22}
                color={color}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  marginTop: 4,
                  color,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
