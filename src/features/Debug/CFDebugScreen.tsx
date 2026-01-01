import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Share from "react-native-share";
import { cfLogger } from "@/utils/cfDebugLogger";

export function CFDebugScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="py-2">
          <Text className="text-primary font-semibold">← Back</Text>
        </Pressable>
        <Text className="text-foreground font-bold text-lg">CF Debug Logs</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Actions */}
      <View className="flex-row gap-2 px-4 py-3 border-b border-border">
        <Pressable
          onPress={handleExport}
          disabled={isExporting}
          className="flex-1 bg-primary py-3 rounded-lg items-center"
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text className="text-black font-semibold">Export Logs</Text>
          )}
        </Pressable>

        <Pressable
          onPress={loadLogs}
          className="bg-surface border border-border py-3 px-4 rounded-lg"
        >
          <Text className="text-foreground font-semibold">Refresh</Text>
        </Pressable>

        <Pressable
          onPress={handleClear}
          className="bg-surface border border-border py-3 px-4 rounded-lg"
        >
          <Text className="text-destructive font-semibold">Clear</Text>
        </Pressable>
      </View>

      {/* Info */}
      <View className="px-4 py-2 bg-surface/50">
        <Text className="text-muted text-xs">
          Showing last {logs.length} entries • Auto-logged CF events
        </Text>
      </View>

      {/* Logs */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#888" />
          <Text className="text-muted mt-4">Loading logs...</Text>
        </View>
      ) : logs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center mb-2">📝 No logs yet</Text>
          <Text className="text-muted/70 text-center text-sm">
            CF debug logs will appear here when you interact with KissManga or
            other CF-protected sources
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-2">
          {logs.map((log, index) => {
            const isError = log.includes("✗") || log.includes("failed");
            const isSuccess = log.includes("✓") || log.includes("SUCCESS");

            return (
              <View
                key={index}
                className={`mb-2 p-3 rounded-lg border ${
                  isError
                    ? "bg-destructive/10 border-destructive/30"
                    : isSuccess
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-surface border-border"
                }`}
              >
                <Text
                  className={`text-xs font-mono ${
                    isError
                      ? "text-destructive"
                      : isSuccess
                      ? "text-green-500"
                      : "text-foreground/90"
                  }`}
                  selectable
                >
                  {log}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
