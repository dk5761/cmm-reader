import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "./AuthContext";

type AuthGuardProps = {
  children: React.ReactNode;
};

/**
 * Component that protects routes by redirecting unauthenticated users to sign-in.
 * Should be placed inside AuthProvider.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inMainGroup = segments[0] === "(main)";
    const inDebugGroup = segments[0] === "(debug)";

    // Check if user is on sign-in or sync screen (within auth group)
    const isSignIn = segments.at(1) === "sign-in";
    const isSync = segments.at(1) === "sync";
    const isPublic = inAuthGroup || inDebugGroup; // Auth and debug groups are public

    if (!user && !isPublic) {
      // Not signed in and trying to access protected route -> redirect to sign-in
      router.replace("/(auth)/sign-in");
    } else if (user && isSignIn) {
      // Signed in and visiting sign-in -> redirect to library
      router.replace("/(main)/(tabs)/library");
    }
  }, [user, loading, segments]);

  // Show nothing while loading auth state
  if (loading) return null;

  return <>{children}</>;
}
