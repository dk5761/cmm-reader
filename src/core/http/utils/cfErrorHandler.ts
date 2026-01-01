import { toast } from "sonner-native";

/**
 * Check if error is a Cloudflare bypass exception
 */
export function isCfError(error: any): boolean {
  if (!error) return false;

  return (
    error?.name === "CloudflareBypassException" ||
    error?.message?.includes("CF bypass failed") ||
    error?.message?.includes("Cloudflare")
  );
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
