import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncStore } from "@/features/Library/stores/useSyncStore";
import { MangaSyncListItem } from "@/features/Library/components/MangaSyncListItem";
import { SyncDetailsModal } from "@/features/Library/components/SyncDetailsModal";
import { useBackup } from "@/core/backup";
import { useAppSettingsStore } from "@/shared/stores";
import { useAuth } from "@/core/auth";
import { useSyncManager } from "@/core/sync";

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
};

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  loading,
}: SettingItemProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      className="flex-row items-center px-4 py-4 active:bg-surface/50"
      style={{ opacity: loading ? 0.6 : 1 }}
    >
      <View className="w-10 h-10 bg-surface rounded-lg items-center justify-center mr-3">
        {loading ? (
          <ActivityIndicator size="small" color={muted} />
        ) : (
          <Ionicons name={icon} size={20} color={muted} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-foreground font-medium">{title}</Text>
        {subtitle && (
          <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

type ToggleSettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  warning?: boolean;
};

function ToggleSettingItem({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  warning,
}: ToggleSettingItemProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  return (
    <View className="flex-row items-center px-4 py-4">
      <View className="w-10 h-10 bg-surface rounded-lg items-center justify-center mr-3">
        <Ionicons
          name={icon}
          size={20}
          color={warning && value ? "#f59e0b" : muted}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-medium">{title}</Text>
          {warning && value && (
            <Ionicons name="warning" size={16} color="#f59e0b" />
          )}
        </View>
        {subtitle && (
          <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>
        )}
      </View>
      <Pressable onPress={() => onToggle(!value)} className="p-1" hitSlop={8}>
        <View
          className="w-12 h-7 rounded-full justify-center px-0.5"
          style={{
            backgroundColor: value ? primary : "#374151",
          }}
        >
          <View
            className="w-6 h-6 rounded-full bg-white"
            style={{
              transform: [{ translateX: value ? 20 : 0 }],
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function AccountSection() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await signOut();
            // AuthGuard will handle redirect
          } catch (e) {
            Alert.alert("Error", "Failed to sign out");
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <View>
      <View className="px-4 py-2 mb-2">
        <Text className="text-foreground font-medium">{user.email}</Text>
        <Text className="text-muted text-xs">Signed in with Google</Text>
      </View>
      <SettingItem
        icon="log-out-outline"
        title="Sign Out"
        onPress={handleSignOut}
        loading={loading}
      />
    </View>
  );
}

function SyncSection() {
  const { syncState, syncNow, uploadAll } = useSyncManager();
  const [syncing, setSyncing] = useState(false);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await syncNow();
      Alert.alert(
        "Sync Complete",
        "Your library has been synced to the cloud."
      );
    } catch (e) {
      Alert.alert("Sync Failed", (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleFullUpload = async () => {
    Alert.alert(
      "Full Upload",
      "This will upload your entire library to the cloud, replacing any existing data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload",
          onPress: async () => {
            setSyncing(true);
            try {
              await uploadAll();
              Alert.alert(
                "Upload Complete",
                "Your entire library has been uploaded."
              );
            } catch (e) {
              Alert.alert("Upload Failed", (e as Error).message);
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View>
      <SettingItem
        icon="cloud-upload-outline"
        title="Sync Now"
        subtitle={
          syncState.pendingChanges > 0
            ? `${syncState.pendingChanges} pending changes`
            : "Library is synced"
        }
        onPress={handleSyncNow}
        loading={syncing}
      />
      <SettingItem
        icon="refresh-outline"
        title="Full Upload"
        subtitle="Upload entire library to cloud"
        onPress={handleFullUpload}
        loading={syncing}
      />
    </View>
  );
}

function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { exportBackup, importBackup } = useBackup();

  const handleExport = async () => {
    setExporting(true);
    try {
      const success = await exportBackup();
      if (!success) {
        Alert.alert("Export Failed", "Unable to export backup file.");
      }
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    Alert.alert(
      "Restore Backup",
      "This will merge the backup with your existing library. Existing manga will be updated, new ones will be added.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            setImporting(true);
            try {
              const result = await importBackup();
              if (result.success && result.imported) {
                Alert.alert(
                  "Import Complete",
                  `Imported ${result.imported.manga} manga and ${result.imported.history} history entries.`
                );
              } else if (result.error && result.error !== "Cancelled") {
                Alert.alert("Import Failed", result.error);
              }
            } catch (e) {
              Alert.alert("Error", (e as Error).message);
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View>
      <SettingItem
        icon="cloud-upload-outline"
        title="Create Backup"
        subtitle="Export library to JSON file"
        onPress={handleExport}
        loading={exporting}
      />
      <SettingItem
        icon="cloud-download-outline"
        title="Restore Backup"
        subtitle="Import from backup file"
        onPress={handleImport}
        loading={importing}
      />
    </View>
  );
}

function SyncHistorySection() {
  const { lastSync, syncHistory, clearHistory } = useSyncStore();
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  if (!lastSync) {
    return (
      <View className="px-4 py-4">
        <Text className="text-muted text-sm">No sync history yet</Text>
      </View>
    );
  }

  const hasMangaUpdates =
    lastSync.mangaUpdates && lastSync.mangaUpdates.length > 0;

  return (
    <View>
      {/* Summary Header */}
      <View className="px-4 py-3 bg-surface/50">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-foreground font-medium">Last Sync</Text>
          <Text className="text-muted text-xs">
            {formatTimeAgo(lastSync.timestamp)}
          </Text>
        </View>

        <View className="flex-row gap-4">
          <View className="flex-1">
            <Text style={{ color: primary }} className="text-2xl font-bold">
              {lastSync.updated}
            </Text>
            <Text className="text-muted text-xs">manga updated</Text>
          </View>
          <View className="flex-1">
            <Text style={{ color: primary }} className="text-2xl font-bold">
              {lastSync.newChapters}
            </Text>
            <Text className="text-muted text-xs">new chapters</Text>
          </View>
        </View>
      </View>

      {/* Manga Updates List */}
      {hasMangaUpdates && (
        <View className="mt-2">
          <Text className="px-4 py-2 text-muted text-xs font-medium">
            UPDATED MANGA
          </Text>
          {lastSync.mangaUpdates.slice(0, 10).map((update) => (
            <MangaSyncListItem
              key={update.mangaId}
              update={update}
              onPress={() => setSelectedMangaId(update.mangaId)}
            />
          ))}
          {lastSync.mangaUpdates.length > 10 && (
            <Text className="px-4 py-2 text-muted text-xs text-center">
              +{lastSync.mangaUpdates.length - 10} more
            </Text>
          )}
        </View>
      )}

      {/* Failed */}
      {lastSync.failed.length > 0 && (
        <View className="px-4 py-3 mt-2 bg-red-500/10">
          <Text className="text-red-500 text-sm font-medium mb-1">
            ⚠️ {lastSync.failed.length} failed
          </Text>
          {lastSync.failed.slice(0, 3).map((f, i) => (
            <Text key={i} className="text-muted text-xs">
              • {f.mangaTitle}: {f.error}
            </Text>
          ))}
        </View>
      )}

      {/* Skipped Sources */}
      {lastSync.skippedSources.length > 0 && (
        <View className="px-4 py-3 mt-2 bg-yellow-500/10">
          <Text className="text-yellow-500 text-sm font-medium mb-1">
            ⏭️ {lastSync.skippedSources.length} sources skipped
          </Text>
          {lastSync.skippedSources.map((s, i) => (
            <Text key={i} className="text-muted text-xs">
              • {s} (session expired)
            </Text>
          ))}
        </View>
      )}

      {/* Clear History */}
      {syncHistory.length > 0 && (
        <Pressable onPress={clearHistory} className="py-3">
          <Text className="text-red-500 text-sm text-center">
            Clear sync history
          </Text>
        </Pressable>
      )}

      {/* Details Modal */}
      {selectedMangaId && (
        <SyncDetailsModal
          visible={selectedMangaId !== null}
          onClose={() => setSelectedMangaId(null)}
          mangaId={selectedMangaId}
          syncHistory={syncHistory}
        />
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showNsfwSources, toggleNsfwSources } = useAppSettingsStore();

  return (
    <View className="flex-1 bg-background">
      <View
        className="px-4 border-b border-border"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <Text className="text-foreground text-2xl font-bold">More</Text>
        <Text className="text-muted text-sm mt-1">Settings & preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Account Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Account
          </Text>
          <AccountSection />
        </View>

        {/* Cloud Sync Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Cloud Sync
          </Text>
          <SyncSection />
        </View>

        {/* Content Preferences Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Content Preferences
          </Text>
          <ToggleSettingItem
            icon="eye-off-outline"
            title="Show NSFW Sources"
            subtitle="Adult content sources (18+)"
            value={showNsfwSources}
            onToggle={toggleNsfwSources}
            warning
          />
        </View>

        {/* Backup & Restore Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Backup & Restore
          </Text>
          <BackupSection />
        </View>

        {/* Sync History Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Sync History
          </Text>
          <SyncHistorySection />
        </View>

        {/* Debug Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Developer
          </Text>
          <SettingItem
            icon="bug-outline"
            title="Debug Realm Database"
            subtitle="View all stored manga and chapters"
            onPress={() => router.push("/debug")}
          />
          <SettingItem
            icon="document-text-outline"
            title="CF Debug Logs"
            subtitle="View Cloudflare challenge logs"
            onPress={() => router.push("/debug/cf")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
