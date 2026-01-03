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
    const isSignIn = segments[0] === "sign-in";
    const isPublic = isSignIn; // Add other public routes here if needed

    if (!user && !isPublic) {
      // Not signed in and trying to access protected route -> redirect to sign-in
      router.replace("/sign-in");
    } else if (user && isSignIn) {
      // Signed in and visiting sign-in -> redirect to home
      router.replace("/(tabs)/library");
    }
  }, [user, loading, segments]);

  // Show nothing while loading auth state
  if (loading) return null;

  return <>{children}</>;
}
