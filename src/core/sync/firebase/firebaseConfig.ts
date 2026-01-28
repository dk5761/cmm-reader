/**
 * Firebase Configuration
 *
 * Firebase configuration for the Firebase JS SDK.
 * Used by the sync system for Firestore and Authentication.
 *
 * Get these values from Firebase Console:
 * 1. Go to https://console.firebase.google.com
 * 2. Select your project (or create one)
 * 3. Click the gear icon → Project settings
 * 4. Scroll down to "Your apps" → Web app
 * 5. Copy the firebaseConfig object
 */

/**
 * Firebase configuration for JS SDK
 * UPDATE THIS WITH YOUR FIREBASE CONFIG
 */
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

/**
 * Validate that all required config fields are present
 */
export function validateFirebaseConfig(): boolean {
  const requiredFields: (keyof typeof firebaseConfig)[] = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];

  for (const field of requiredFields) {
    const value = firebaseConfig[field];
    if (!value || value === `YOUR_${field.toUpperCase()}`) {
      console.error(`[FirebaseConfig] Missing or invalid field: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Check if Firebase config is properly set up
 */
export function isFirebaseConfigured(): boolean {
  return validateFirebaseConfig();
}

/**
 * Get the Firebase web app configuration
 * This would be loaded from environment variables in a production app
 */
export function getFirebaseConfig() {
  if (!isFirebaseConfigured()) {
    console.warn("[FirebaseConfig] Firebase config is not properly configured");
    console.warn("[FirebaseConfig] Please update src/core/sync/firebase/firebaseConfig.ts with your Firebase credentials");
  }

  return firebaseConfig;
}
