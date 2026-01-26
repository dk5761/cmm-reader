import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/core/auth";
import { router } from "expo-router";

/**
 * Sign-in screen with Google authentication.
 */
export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { signInWithGoogle, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace("/(main)/(tabs)/library");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [signInWithGoogle]);

  return (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: isDark ? "#0a0a0f" : "#ffffff" }}
    >
      {/* Logo/Title */}
      <View className="items-center mb-12">
        <Ionicons
          name="book-outline"
          size={80}
          color={isDark ? "#fff" : "#000"}
        />
        <Text
          className="text-3xl font-bold mt-4"
          style={{ color: isDark ? "#fff" : "#000" }}
        >
          Manga Reader
        </Text>
        <Text
          className="text-base mt-2 opacity-60"
          style={{ color: isDark ? "#fff" : "#000" }}
        >
          Sign in to access your library
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View className="bg-red-500/20 px-4 py-3 rounded-lg mb-6 w-full">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      {/* Google Sign-in Button */}
      <Pressable
        onPress={handleGoogleSignIn}
        disabled={loading}
        className="flex-row items-center justify-center bg-white rounded-lg px-6 py-4 w-full active:opacity-80"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          <>
            <View className="w-6 h-6 mr-3">
              {/* Google "G" icon approximation */}
              <Text style={{ fontSize: 20, color: "#4285F4" }}>G</Text>
            </View>
            <Text className="text-base font-semibold text-gray-800">
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
