/**
 * UpdateScreen - Blocks app while checking/downloading updates
 * Shows progress and forces user to update
 */

import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUpdateChecker, UpdateStatus } from "../hooks/useUpdateChecker";

export function UpdateScreen() {
  const { status, error, applyUpdate, skipUpdate } = useUpdateChecker();

  // Don't render if no blocking update
  if (status === "no-update" || status === "dev-mode") {
    return null;
  }

  return (
    <View className="absolute inset-0 bg-background items-center justify-center z-50">
      <View className="items-center px-8">
        {/* Icon */}
        <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-6">
          {status === "ready" ? (
            <Ionicons name="cloud-download" size={40} color="#00d9ff" />
          ) : status === "error" ? (
            <Ionicons name="warning" size={40} color="#ef4444" />
          ) : (
            <ActivityIndicator size="large" color="#00d9ff" />
          )}
        </View>

        {/* Status Text */}
        <Text className="text-foreground text-xl font-bold text-center mb-2">
          {status === "checking" && "Checking for updates..."}
          {status === "downloading" && "Downloading update..."}
          {status === "ready" && "Update Ready!"}
          {status === "error" && "Update Failed"}
        </Text>

        <Text className="text-muted text-center mb-8">
          {status === "checking" && "Please wait a moment"}
          {status === "downloading" && "This won't take long"}
          {status === "ready" && "Restart to apply the latest version"}
          {status === "error" && (error || "Something went wrong")}
        </Text>

        {/* Action Buttons */}
        {status === "ready" && (
          <Pressable
            onPress={applyUpdate}
            className="bg-primary px-8 py-3 rounded-lg active:opacity-80"
          >
            <Text className="text-black font-bold">Restart Now</Text>
          </Pressable>
        )}

        {status === "error" && (
          <Pressable
            onPress={skipUpdate}
            className="bg-surface border border-border px-8 py-3 rounded-lg active:opacity-80"
          >
            <Text className="text-foreground font-medium">Continue Anyway</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
