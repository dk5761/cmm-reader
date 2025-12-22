import { createContext, useContext, ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from "react-native-reanimated";

type HeaderContextType = {
  animated?: SharedValue<number>;
};

const HeaderContext = createContext<HeaderContextType>({});

export function useHeaderContext() {
  return useContext(HeaderContext);
}

type HeaderProps = {
  children: ReactNode;
  animated?: SharedValue<number>;
  className?: string;
};

function HeaderRoot({ children, animated, className }: HeaderProps) {
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    if (!animated) return {};

    return {
      opacity: interpolate(animated.value, [0, 100], [0, 1], "clamp"),
      backgroundColor: `rgba(0, 0, 0, ${interpolate(
        animated.value,
        [0, 100],
        [0, 0.9],
        "clamp"
      )})`,
    };
  });

  const Container = animated ? Animated.View : View;

  return (
    <HeaderContext.Provider value={{ animated }}>
      <Container
        className={`flex-row items-center px-4 pb-3 ${className ?? ""}`}
        style={[
          {
            paddingTop: insets.top,
            minHeight: insets.top + 56,
          },
          animated ? animatedStyle : {},
        ]}
      >
        {children}
      </Container>
    </HeaderContext.Provider>
  );
}

export { HeaderRoot };
