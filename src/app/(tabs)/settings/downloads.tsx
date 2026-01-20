import { DownloadQueueScreen } from "@/features/Downloads/screens/DownloadQueueScreen";
import { Stack } from "expo-router";

export default function DownloadsPage() {
  return (
    <>
      <Stack.Screen options={{ title: "Download Queue" }} />
      <DownloadQueueScreen />
    </>
  );
}