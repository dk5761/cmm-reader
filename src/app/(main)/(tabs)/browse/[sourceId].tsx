import { useLayoutEffect } from "react";
import { useNavigation } from "expo-router";
import { SourceBrowseScreen } from "@/features/Browse";
import { getSource } from "@/sources";
import { useLocalSearchParams } from "expo-router";

export default function SourceBrowseRoute() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const source = getSource(sourceId || "");
    if (source?.name) {
      navigation.setOptions({ title: source.name });
    }
  }, [sourceId, navigation]);

  return <SourceBrowseScreen />;
}
