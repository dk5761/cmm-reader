/**
 * Centralized debug flags
 * Toggle logging for different subsystems without code changes
 *
 * In development (__DEV__), all logging is enabled by default.
 * In production, set EXPO_PUBLIC_DEBUG_* env vars to enable specific logs.
 */
export const DEBUG = {
  CF: __DEV__ || process.env.EXPO_PUBLIC_DEBUG_CF === "true",
  SYNC: __DEV__ || process.env.EXPO_PUBLIC_DEBUG_SYNC === "true",
  READER: __DEV__ || process.env.EXPO_PUBLIC_DEBUG_READER === "true",
  HTTP: __DEV__ || process.env.EXPO_PUBLIC_DEBUG_HTTP === "true",
  MANGA: __DEV__ || process.env.EXPO_PUBLIC_DEBUG_MANGA === "true",
} as const;

export type DebugCategory = keyof typeof DEBUG;
