import { View, Text, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

export type DownloadOption = "all" | "unread";

type DownloadSheetProps = {
  visible: boolean;
  onSelect: (option: DownloadOption) => void;
  onClose: () => void;
};

export function DownloadSheet({
  visible,
  onSelect,
  onClose,
}: DownloadSheetProps) {
  const foregroundColor = useCSSVariable("--color-foreground");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          className="bg-surface rounded-t-2xl"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-muted/50 rounded-full" />
          </View>

          {/* Title */}
          <Text className="text-foreground text-lg font-bold px-4 pb-3">
            Download
          </Text>

          {/* Options */}
          <View className="pb-6">
            <Pressable
              onPress={() => {
                onSelect("all");
                onClose();
              }}
              className="flex-row items-center px-4 py-4 active:bg-background/50"
            >
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-primary/10">
                <Ionicons name="download-outline" size={22} color="#00d9ff" />
              </View>
              <Text className="flex-1 text-foreground font-medium">
                Download all
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onSelect("unread");
                onClose();
              }}
              className="flex-row items-center px-4 py-4 active:bg-background/50"
            >
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-primary/10">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color="#00d9ff"
                />
              </View>
              <Text className="flex-1 text-foreground font-medium">
                Download unread
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
