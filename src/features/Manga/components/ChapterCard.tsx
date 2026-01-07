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
import { DownloadStatus } from "@/shared/contexts/DownloadContext";
import { useRef } from "react";

type ChapterCardProps = {
  chapter: Chapter;
  isRead?: boolean;
  lastPage?: number;
  downloadStatus?: DownloadStatus;
  onPress?: () => void;
  onMarkAsRead?: () => void;
  onMarkAsUnread?: () => void;
  onMarkPreviousAsRead?: () => void;
  onMarkPreviousAsUnread?: () => void;
  onDownload?: () => void;
  onCancelDownload?: () => void;
};

export function ChapterCard({
  chapter,
  isRead = false,
  lastPage,
  downloadStatus = DownloadStatus.NONE,
  onPress,
  onMarkAsRead,
  onMarkAsUnread,
  onMarkPreviousAsRead,
  onMarkPreviousAsUnread,
  onDownload,
  onCancelDownload,
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

  const handleDownloadPress = () => {
    if (downloadStatus === DownloadStatus.NONE) {
      onDownload?.();
    } else if (
      downloadStatus === DownloadStatus.DOWNLOADING ||
      downloadStatus === DownloadStatus.QUEUED
    ) {
      onCancelDownload?.();
    }
  };

  // Render download icon based on status
  const renderDownloadIcon = () => {
    switch (downloadStatus) {
      case DownloadStatus.DOWNLOADED:
        return (
          <View className="bg-primary rounded-full p-1">
            <Ionicons name="checkmark" size={14} color="#000" />
          </View>
        );
      case DownloadStatus.DOWNLOADING:
        return (
          <View className="border-2 border-primary rounded-full w-6 h-6 border-t-transparent animate-spin" />
        );
      case DownloadStatus.QUEUED:
        return (
          <View className="border border-primary rounded-full p-1">
            <Ionicons name="time-outline" size={14} color={primary} />
          </View>
        );
      case DownloadStatus.ERROR:
        return (
          <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
        );
      default:
        return (
          <Ionicons name="download-outline" size={24} color="#71717a" />
        );
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
        className="flex-row items-center px-4 py-3 bg-background border-b border-border/20"
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
          <View className="flex-1 pr-4">
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
          
          <View className="flex-row items-center gap-3">
            {isRead && (
              <View className="bg-surface px-2 py-0.5 rounded border border-border">
                <Text style={{ color: primary, fontSize: 10, fontWeight: "600" }}>
                  READ
                </Text>
              </View>
            )}
            
            {/* Download Button */}
            <Pressable
              onPress={handleDownloadPress}
              className="p-2 -mr-2"
              hitSlop={8}
            >
              {renderDownloadIcon()}
            </Pressable>
          </View>
        </RNAnimated.View>
      </Pressable>
    </Swipeable>
  );
}
