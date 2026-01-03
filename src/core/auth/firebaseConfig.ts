import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Web Client ID from Firebase Console
const WEB_CLIENT_ID =
  "448954263976-95qoqgcqueorfk3nlo63uesh79i9ejbs.apps.googleusercontent.com";

/**
 * Configure Google Sign-in on app startup.
 * Call this once in the root layout.
 */
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
  });
}
