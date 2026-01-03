import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, useColorScheme } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSyncManager } from "@/core/sync";

/**
 * Post-login sync screen
 * Downloads cloud data and merges into local Realm
 */
export default function SyncScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: "login" | "logout" }>();

  const { downloadAndMerge, clearLocalData, clearSyncQueue, uploadAll } =
    useSyncManager();
  const [status, setStatus] = useState("Preparing...");
  const [progress, setProgress] = useState({ manga: 0, history: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performSync = async () => {
      try {
        if (action === "logout") {
          // Logout: flush pending sync, then clear local data
          setStatus("Uploading pending changes...");
          await uploadAll();
          setStatus("Clearing local data...");
          await clearLocalData();
          await clearSyncQueue();
          setStatus("Complete!");
          router.replace("/sign-in");
          return;
        }

        // Login: download from cloud and merge
        setStatus("Downloading your library...");
        const result = await downloadAndMerge();
        setProgress(result);
        setStatus("Sync complete!");

        // Brief pause to show completion
        await new Promise((r) => setTimeout(r, 1000));
        router.replace("/(tabs)/library");
      } catch (e) {
        console.error("[SyncScreen] Error:", e);
        setError((e as Error).message);
      }
    };

    performSync();
  }, [action]);

  return (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: isDark ? "#0a0a0f" : "#ffffff" }}
    >
      <ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />

      <Text
        className="text-xl font-semibold mt-6"
        style={{ color: isDark ? "#fff" : "#000" }}
      >
        {status}
      </Text>

      {progress.manga > 0 && (
        <Text
          className="text-base mt-2 opacity-60"
          style={{ color: isDark ? "#fff" : "#000" }}
        >
          {progress.manga} manga, {progress.history} history entries
        </Text>
      )}

      {error && (
        <View className="mt-4 bg-red-500/20 px-4 py-3 rounded-lg">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      <Text
        className="text-sm mt-8 opacity-40"
        style={{ color: isDark ? "#fff" : "#000" }}
      >
        Please don't close the app
      </Text>
    </View>
  );
}
