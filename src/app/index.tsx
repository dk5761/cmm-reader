import { Redirect } from "expo-router";

/**
 * Root index - redirects to library screen.
 */
export default function Index() {
  return <Redirect href="/(tabs)/library" />;
}
