import {
  View,
  Text,
  Pressable,
  Animated as RNAnimated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { triggerHaptic } from "@/utils/haptics";
import type { Chapter } from "@/sources";
import { useRef } from "react";

type ChapterCardProps = {
  chapter: Chapter;
  isRead?: boolean;
  lastPage?: number;
  onPress?: () => void;
  onMarkAsRead?: () => void;
  onMarkAsUnread?: () => void;
  onMarkPreviousAsRead?: () => void;
  onMarkPreviousAsUnread?: () => void;
};

export function ChapterCard({
  chapter,
  isRead = false,
  lastPage,
  onPress,
  onMarkAsRead,
  onMarkAsUnread,
  onMarkPreviousAsRead,
  onMarkPreviousAsUnread,
}: ChapterCardProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const opacityAnim = useRef(new RNAnimated.Value(1)).current;

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

  const handleMarkPreviousAsUnread = () => {
    closeSwipeable();
    onMarkPreviousAsUnread?.();
  };

  const renderRightActions = (
    progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-225, 0],
      outputRange: [0, 225],
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
            Read ↓
          </Text>
        </RectButton>

        {/* Mark all previous as unread */}
        <RectButton
          style={{
            width: 75,
            backgroundColor: "#ef4444",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleMarkPreviousAsUnread}
        >
          <Ionicons name="close-circle-outline" size={22} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10, marginTop: 4 }}>
            Unread ↓
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
        onPressIn={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
          RNAnimated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          RNAnimated.timing(opacityAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }}
        className="flex-row items-center px-4 py-3 bg-background"
      >
        <RNAnimated.View
          className="flex-row items-center flex-1"
          style={{
            opacity: isRead
              ? opacityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 0.5],
                })
              : opacityAnim,
          }}
        >
          <View className="flex-1">
            <Text className="text-foreground text-sm font-medium">
              Chapter {chapter.number}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-muted text-xs">
                {chapter.date || "Unknown date"}
              </Text>
              {lastPage !== undefined && lastPage > 0 && !isRead && (
                <>
                  <Text className="text-muted text-xs mx-1">•</Text>
                  <Text className="text-primary/80 text-xs font-medium">
                    Page {lastPage + 1}
                  </Text>
                </>
              )}
            </View>
          </View>
          {isRead && (
            <View className="bg-primary/20 px-2 py-0.5 rounded">
              <Text style={{ color: primary, fontSize: 10, fontWeight: "600" }}>
                READ
              </Text>
            </View>
          )}
        </RNAnimated.View>
      </Pressable>
    </Swipeable>
  );
}
