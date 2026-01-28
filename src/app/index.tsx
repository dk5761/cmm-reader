import { Redirect } from "expo-router";

/**
 * Root index - always redirect to library.
 */
export default function Index() {
  return <Redirect href="/(main)/(tabs)/library" />;
}
