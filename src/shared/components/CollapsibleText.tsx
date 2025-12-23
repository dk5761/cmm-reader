import { useState, useCallback } from "react";
import { Text, Pressable, View, TextProps } from "react-native";
import { useCSSVariable } from "uniwind";

interface CollapsibleTextProps extends TextProps {
  text: string;
  numberOfLines?: number;
}

export function CollapsibleText({
  text,
  numberOfLines = 3,
  className,
  ...props
}: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Simple length check as a fallback if onTextLayout is flaky
  // Approx 100 chars per line? Adjust as needed.
  const isLikelyTruncated = text.length > numberOfLines * 50;

  const onTextLayout = useCallback(
    (e: any) => {
      if (e.nativeEvent.lines.length > numberOfLines) {
        setIsTruncated(true);
      }
    },
    [numberOfLines]
  );

  // If text is short, just render it simply
  if (!text) return null;

  const showButton = isTruncated || expanded || isLikelyTruncated;

  return (
    <View className="w-full">
      <Text
        className={`text-muted text-xs leading-5 ${className}`}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={onTextLayout}
        {...props}
      >
        {text}
      </Text>

      {showButton && (
        <Pressable
          onPress={toggleExpanded}
          className="mt-1 self-start active:opacity-70"
          hitSlop={8}
        >
          <Text className="text-primary text-xs font-bold uppercase tracking-wider">
            {expanded ? "Show Less" : "Show More"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
