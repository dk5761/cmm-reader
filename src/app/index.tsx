import { Redirect } from "expo-router";
import { useQuery } from "@realm/react";
import { MangaSchema } from "@/core/database";
import { useAuth } from "@/core/auth";

/**
 * Root index - decides where to redirect based on app state.
 * If user is logged in and has empty library, go directly to sync screen.
 * Otherwise, go to library.
 */
export default function Index() {
  const { user } = useAuth();
  const libraryManga = useQuery(MangaSchema, (collection) =>
    collection.filtered("inLibrary == true"),
  );

  // If user is logged in and library is empty, go to sync screen
  // This prevents showing empty library before sync completes
  if (user && libraryManga.length === 0) {
    return <Redirect href="/sync?action=startup" />;
  }

  return <Redirect href="/(tabs)/library" />;
}
