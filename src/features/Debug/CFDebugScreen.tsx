import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import Share from "react-native-share";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { cfLogger } from "@/utils/cfDebugLogger";

// Compact Log Item for Terminal Feel
const LogItem = React.memo(({ item }: { item: string }) => {
  const isError =
    item.includes("✗") || item.includes("failed") || item.includes("Error");
  const isSuccess = item.includes("✓") || item.includes("SUCCESS");
  const isHeader = item.startsWith("[");

  // Colors
  const errorColor = "#ef4444";
  const successColor = "#22c55e";
  const textColor = "#e4e4e7"; // zinc-200
  const dimColor = "#a1a1aa"; // zinc-400

  return (
    <View className="mb-0.5">
      <Text
        style={{
          color: isError
            ? errorColor
            : isSuccess
            ? successColor
            : isHeader
            ? textColor
            : dimColor,
          fontFamily: "Menlo", // On iOS this looks like code
          fontSize: 11,
          lineHeight: 16,
        }}
        selectable
      >
        {item}
      </Text>
    </View>
  );
});

export function CFDebugScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Theme Colors - Default to dark mode values if var not found
  const bgColor = (useCSSVariable("--color-background") as string) || "#000000";
  const surfaceColor =
    (useCSSVariable("--color-surface") as string) || "#18181b";
  const primaryColor =
    (useCSSVariable("--color-primary") as string) || "#00d9ff";

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const recentLogs = await cfLogger.getRecentLogs(100);
      setLogs(recentLogs);
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const logFilePath = cfLogger.getLogFilePath();
      await Share.open({
        url: `file://${logFilePath}`,
        type: "text/plain",
        title: "Export CF Debug Logs",
      });
    } catch (error: any) {
      if (error?.message !== "User did not share") {
        Alert.alert("Export Failed", "Could not export logs");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Clear Logs",
      "Are you sure you want to clear all CF debug logs?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await cfLogger.clearLogs();
            await loadLogs();
          },
        },
      ]
    );
  };

  const handleTestLog = async () => {
    await cfLogger.log("Test", "Manual test log entry", {
      timestamp: Date.now(),
      message: "Verifying terminal UI style",
    });
    await loadLogs();
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <Stack.Screen
        options={{
          title: "CF Debug Logs",
          headerTitleStyle: { color: "#fff" },
          headerStyle: { backgroundColor: bgColor }, // Seamless header matching bg
          headerTintColor: "#fff",
          headerBackTitle: "Back",
          headerShadowVisible: false, // Remove hairline divider
        }}
      />

      {/* Toolbar Area */}
      <View
        style={{ backgroundColor: surfaceColor }}
        className="px-4 py-3 border-b border-white/5 flex-row gap-2"
      >
        <Pressable
          onPress={handleExport}
          disabled={isExporting || logs.length === 0}
          className="flex-1 h-9 rounded bg-primary/20 flex-row items-center justify-center gap-2 active:opacity-70"
          style={{ opacity: isExporting || logs.length === 0 ? 0.5 : 1 }}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <>
              <Ionicons name="share-outline" size={16} color={primaryColor} />
              <Text
                style={{ color: primaryColor }}
                className="font-semibold text-xs"
              >
                Export
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={loadLogs}
          className="w-9 h-9 rounded bg-white/5 items-center justify-center active:bg-white/10"
        >
          <Ionicons name="refresh" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={handleTestLog}
          className="w-9 h-9 rounded bg-white/5 items-center justify-center active:bg-white/10"
        >
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>

        <Pressable
          onPress={handleClear}
          disabled={logs.length === 0}
          className="w-9 h-9 rounded bg-white/5 items-center justify-center active:bg-white/10"
          style={{ opacity: logs.length === 0 ? 0.5 : 1 }}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </Pressable>
      </View>

      {/* Terminal View */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={primaryColor} />
          <Text className="text-zinc-500 mt-2 text-xs">Reading logs...</Text>
        </View>
      ) : logs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10 opacity-50">
          <Ionicons name="terminal-outline" size={48} color="#71717a" />
          <Text className="text-zinc-400 font-medium text-sm mt-4 text-center">
            No diagnostic logs available
          </Text>
        </View>
      ) : (
        <View className="flex-1 px-4 pt-4">
          <FlatList
            data={logs}
            renderItem={({ item }) => <LogItem item={item} />}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={{ paddingBottom: 40 }}
            initialNumToRender={50}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
          />
        </View>
      )}

      {/* Bottom Status Bar */}
      <View
        style={{ backgroundColor: surfaceColor }}
        className="px-4 py-2 flex-row justify-between items-center"
      >
        <Text className="text-zinc-500 text-[10px]">{logs.length} events</Text>
        <Text className="text-zinc-500 text-[10px] uppercase">
          CF Diagnostic Mode
        </Text>
      </View>
      <SafeAreaView
        edges={["bottom"]}
        style={{ backgroundColor: surfaceColor }}
      />
    </View>
  );
}
