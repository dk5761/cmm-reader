import { toast } from "sonner-native";
import { CloudflareBypassException } from "../types";

/**
 * Check if error is a Cloudflare bypass exception
 */
export function isCfError(error: unknown): boolean {
  if (!error) return false;

  // Best: Check if it's actually a CloudflareBypassException instance
  if (error instanceof CloudflareBypassException) {
    return true;
  }

  // Fallback: Check error name (for serialized errors)
  if (typeof error === "object" && error !== null) {
    const err = error as { name?: string; message?: string };
    if (err.name === "CloudflareBypassException") {
      return true;
    }
    // Check message for CF-specific errors
    if (
      err.message?.includes("CF bypass failed") ||
      err.message?.includes("CF solve timeout")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Handle Cloudflare error with toast notification
 * Shows error message with retry button
 */
export function handleCfError(
  error: any,
  onRetry: () => void,
  sourceName: string = "this source"
) {
  if (!isCfError(error)) return false;

  console.log(`[CF Error Handler] Showing CF error toast for ${sourceName}`);

  toast.error(`Failed to connect to ${sourceName}`, {
    description: "Cloudflare verification needed. Please try again.",
    action: {
      label: "Retry",
      onClick: () => {
        console.log(`[CF Error Handler] Retry clicked for ${sourceName}`);
        toast.dismiss();
        onRetry();
      },
    },
    duration: Infinity, // Stay until user interacts
  });

  return true;
}

/**
 * Dismiss all CF error toasts
 */
export function dismissCfErrors() {
  toast.dismiss();
}
