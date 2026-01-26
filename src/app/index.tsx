import { Redirect } from "expo-router";
import { useAuth } from "@/core/auth";

/**
 * Root index - decides where to redirect based on app state.
 * If user is logged in, go to library. Otherwise, go to sign-in.
 */
export default function Index() {
  const { user } = useAuth();

  // If not logged in, go to sign-in
  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Logged in users always go to library
  // Users can manually sync from Settings if needed
  return <Redirect href="/(main)/(tabs)/library" />;
}
