import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/shared/contexts/AuthContext";
import { useState } from "react";

export default function LoginScreen() {
    const insets = useSafeAreaInsets();
    const { signInWithGoogle } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (err) {
            setError((err as Error).message || "Failed to sign in");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View
            className="flex-1"
            style={{ backgroundColor: "#0a0a0f" }}
        >
            {/* Main Content */}
            <View
                className="flex-1 justify-between"
                style={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 40 }}
            >
                {/* Header Section */}
                <View className="items-center px-8">
                    {/* App Icon */}
                    <View
                        className="w-28 h-28 rounded-[32px] items-center justify-center mb-8"
                        style={{
                            backgroundColor: "rgba(0, 217, 255, 0.15)",
                            borderWidth: 1,
                            borderColor: "rgba(0, 217, 255, 0.3)",
                        }}
                    >
                        <Ionicons name="book" size={56} color="#00d9ff" />
                    </View>

                    {/* Title */}
                    <Text
                        className="text-4xl font-bold mb-4 text-center"
                        style={{ color: "#ffffff" }}
                    >
                        Manga Reader
                    </Text>
                    <Text
                        className="text-center text-lg leading-7 px-4"
                        style={{ color: "#9ca3af" }}
                    >
                        Your personal manga library{"\n"}synced across all devices
                    </Text>
                </View>

                {/* Features Section */}
                <View className="px-8 py-8">
                    <View className="flex-row items-center mb-5">
                        <View
                            className="w-11 h-11 rounded-xl items-center justify-center mr-4"
                            style={{ backgroundColor: "rgba(0, 217, 255, 0.12)" }}
                        >
                            <Ionicons name="library" size={22} color="#00d9ff" />
                        </View>
                        <View className="flex-1">
                            <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 15 }}>
                                Organize Your Library
                            </Text>
                            <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                                Track reading progress automatically
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center mb-5">
                        <View
                            className="w-11 h-11 rounded-xl items-center justify-center mr-4"
                            style={{ backgroundColor: "rgba(255, 107, 107, 0.12)" }}
                        >
                            <Ionicons name="cloud" size={22} color="#ff6b6b" />
                        </View>
                        <View className="flex-1">
                            <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 15 }}>
                                Cloud Sync
                            </Text>
                            <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                                Backup and restore your data
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        <View
                            className="w-11 h-11 rounded-xl items-center justify-center mr-4"
                            style={{ backgroundColor: "rgba(147, 112, 219, 0.12)" }}
                        >
                            <Ionicons name="flash" size={22} color="#9370db" />
                        </View>
                        <View className="flex-1">
                            <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 15 }}>
                                Multiple Sources
                            </Text>
                            <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                                Read from your favorite sites
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Login Section */}
                <View className="px-8">
                    {/* Error Message */}
                    {error && (
                        <View
                            className="rounded-2xl p-4 mb-4"
                            style={{ backgroundColor: "rgba(239, 68, 68, 0.15)" }}
                        >
                            <Text style={{ color: "#f87171", textAlign: "center" }}>{error}</Text>
                        </View>
                    )}

                    {/* Google Sign In Button */}
                    <Pressable
                        onPress={handleGoogleSignIn}
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        <View
                            className="flex-row items-center justify-center py-4 px-6 rounded-2xl"
                            style={{ backgroundColor: "#ffffff" }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#1f2937" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="logo-google" size={22} color="#4285F4" />
                                    <Text
                                        className="ml-3"
                                        style={{ color: "#1f2937", fontWeight: "600", fontSize: 17 }}
                                    >
                                        Continue with Google
                                    </Text>
                                </>
                            )}
                        </View>
                    </Pressable>

                    {/* Terms */}
                    <Text
                        className="text-center mt-6 px-4"
                        style={{ color: "#4b5563", fontSize: 12 }}
                    >
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </Text>
                </View>
            </View>
        </View>
    );
}
