import { View, Text, Pressable } from "react-native";
import { Avatar } from "@/shared/components";

// Simplified source card type (not the full Extension type)
export type SourceCardData = {
  id: string;
  name: string;
  icon?: string;
  logo?: number; // require() returns number
  language?: string;
};

type SourceCardProps = {
  source: SourceCardData;
  onView?: () => void;
};

/**
 * Get acronym from source name (e.g., "KissManga.in" -> "KM")
 */
function getAcronym(name: string): string {
  const cleaned = name.replace(/\.(in|com|net|org)$/i, "");
  const words = cleaned.split(/[\s.]+/).filter(Boolean);

  if (words.length === 1) {
    const word = words[0];
    const caps = word.match(/[A-Z]/g);
    if (caps && caps.length >= 2) {
      return caps.slice(0, 2).join("");
    }
    return word.substring(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function SourceCard({ source, onView }: SourceCardProps) {
  const acronym = getAcronym(source.name);
  const hasImage = source.logo || source.icon;

  return (
    <View className="flex-row items-center px-4 py-3 gap-3">
      {/* Avatar with image or fallback */}
      <Avatar size="lg" shape="rounded">
        {hasImage && (
          <Avatar.Image
            source={source.logo ? source.logo : { uri: source.icon }}
          />
        )}
        <Avatar.Fallback>{acronym}</Avatar.Fallback>
      </Avatar>

      {/* Info */}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="text-foreground text-sm font-semibold"
            numberOfLines={1}
          >
            {source.name}
          </Text>
          {source.language && (
            <View className="bg-surface px-1.5 py-0.5 rounded">
              <Text className="text-muted text-[10px] font-medium">
                {source.language}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* View button */}
      <Pressable onPress={onView} className="px-5 py-2 rounded-lg bg-primary">
        <Text className="text-black text-xs font-semibold">Browse</Text>
      </Pressable>
    </View>
  );
}
