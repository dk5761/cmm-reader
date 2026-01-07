
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { DownloadStatus } from "@/shared/contexts/DownloadContext";

type DownloadQueueItemProps = {
  chapterTitle: string;
  mangaTitle: string;
  status: DownloadStatus;
  progress: number;
  total: number;
  onCancel: () => void;
};

export function DownloadQueueItem({
  chapterTitle,
  mangaTitle,
  status,
  progress,
  total,
  onCancel,
}: DownloadQueueItemProps) {
  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-border">
      <View className="flex-1 pr-4">
        <Text className="text-foreground font-medium" numberOfLines={1}>
          {mangaTitle}
        </Text>
        <Text className="text-muted text-xs mt-1" numberOfLines={1}>
          {chapterTitle}
        </Text>
        
        {/* Progress Bar */}
        <View className="flex-row items-center mt-2 gap-2">
          <View className="h-1 flex-1 bg-surface rounded-full overflow-hidden">
            <View 
              className="h-full bg-primary" 
              style={{ width: `${percent}%` }} 
            />
          </View>
          <Text className="text-xs text-muted font-mono w-10 text-right">
            {percent}%
          </Text>
        </View>
        
        <Text className="text-xs text-muted mt-1">
          {status === DownloadStatus.DOWNLOADING ? "Downloading..." : 
           status === DownloadStatus.QUEUED ? "Queued" : 
           status === DownloadStatus.ERROR ? "Error" : "Paused"}
           {" "}({progress}/{total})
        </Text>
      </View>

      <Pressable onPress={onCancel} className="p-2">
        <Ionicons name="close-circle-outline" size={24} color={foreground} />
      </Pressable>
    </View>
  );
}
