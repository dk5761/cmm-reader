import { View, Text, Pressable, Animated as RNAnimated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import type { Chapter } from "@/sources";
import { useRef } from "react";

type ChapterCardProps = {
  chapter: Chapter;
  isRead?: boolean;
  onPress?: () => void;
  onMarkAsRead?: () => void;
  onMarkAsUnread?: () => void;
  onMarkPreviousAsRead?: () => void;
};

export function ChapterCard({
  chapter,
  isRead = false,
  onPress,
  onMarkAsRead,
  onMarkAsUnread,
  onMarkPreviousAsRead,
}: ChapterCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  const handleMarkAsRead = () => {
    closeSwipeable();
    if (isRead) {
      onMarkAsUnread?.();
    } else {
      onMarkAsRead?.();
    }
  };

  const handleMarkPreviousAsRead = () => {
    closeSwipeable();
    onMarkPreviousAsRead?.();
  };

  const renderRightActions = (
    progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-150, 0],
      outputRange: [0, 150],
      extrapolate: "clamp",
    });

    return (
      <RNAnimated.View
        style={{
          flexDirection: "row",
          transform: [{ translateX }],
        }}
      >
        {/* Mark this chapter as read/unread */}
        <RectButton
          style={{
            width: 75,
            backgroundColor: isRead ? "#f59e0b" : "#22c55e",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleMarkAsRead}
        >
          <Ionicons
            name={isRead ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#fff"
          />
          <Text style={{ color: "#fff", fontSize: 10, marginTop: 4 }}>
            {isRead ? "Unread" : "Read"}
          </Text>
        </RectButton>

        {/* Mark all previous as read */}
        <RectButton
          style={{
            width: 75,
            backgroundColor: "#3b82f6",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleMarkPreviousAsRead}
        >
          <Ionicons name="checkmark-done-outline" size={22} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10, marginTop: 4 }}>
            Below
          </Text>
        </RectButton>
      </RNAnimated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 py-3 bg-background"
        style={{ opacity: isRead ? 0.5 : 1 }}
      >
        <View className="flex-1">
          <Text className="text-foreground text-sm font-medium">
            Chapter {chapter.number}
          </Text>
          <Text className="text-muted text-xs mt-0.5">
            {chapter.date || "Unknown date"}
          </Text>
        </View>
        {isRead && (
          <View className="bg-primary/20 px-2 py-0.5 rounded">
            <Text style={{ color: primary, fontSize: 10, fontWeight: "600" }}>
              READ
            </Text>
          </View>
        )}
      </Pressable>
    </Swipeable>
  );
}
