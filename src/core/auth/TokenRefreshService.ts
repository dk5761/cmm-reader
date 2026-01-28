/**
 * Token Refresh Service
 *
 * Manages automatic token refresh for Firebase JS SDK authentication.
 * Google ID tokens expire after 1 hour, so we need to refresh them periodically
 * using silent sign-in to maintain the user's session.
 *
 * This service:
 * - Monitors Firebase JS SDK auth state
 * - Triggers silent Google sign-in before token expiration (50 minutes)
 * - Handles background/foreground app state changes
 * - Provides manual refresh capability
 */

import { AppState, AppStateStatus } from "react-native";
import type { Unsubscribe } from "firebase/auth";
import { silentSignIn } from "./silentSignIn";

// Token refresh configuration
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour (Google ID token expiry)
const REFRESH_BEFORE_EXPIRY_MS = 10 * 60 * 1000; // Refresh 10 minutes before expiry
const REFRESH_INTERVAL_MS = TOKEN_EXPIRY_MS - REFRESH_BEFORE_EXPIRY_MS; // 50 minutes
const RETRY_DELAY_MS = 30 * 1000; // 30 seconds between retry attempts
const MAX_RETRIES = 3;

type TokenRefreshState = "idle" | "refreshing" | "error";

/**
 * Token Refresh Service
 * Singleton service for managing automatic token refresh
 */
class TokenRefreshServiceClass {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastRefreshTime: number | null = null;
  private refreshState: TokenRefreshState = "idle";
  private consecutiveFailures = 0;
  private authUnsubscribe: Unsubscribe | null = null;
  private isStarted = false;

  /**
   * Start the token refresh service
   * Begins monitoring auth state and scheduling refresh attempts
   */
  start(): void {
    if (this.isStarted) {
      console.log("[TokenRefreshService] Already started, skipping");
      return;
    }

    console.log("[TokenRefreshService] Starting token refresh service");
    this.isStarted = true;

    // Set up initial timer
    this.scheduleNextRefresh();

    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);

    // Clear error state on start
    this.refreshState = "idle";
    this.consecutiveFailures = 0;

    console.log("[TokenRefreshService] Token refresh service started");
  }

  /**
   * Stop the token refresh service
   * Cancels all timers and subscriptions
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    console.log("[TokenRefreshService] Stopping token refresh service");

    // Clear refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Remove auth state listener
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }

    this.isStarted = false;
    this.lastRefreshTime = null;
    this.refreshState = "idle";
    this.consecutiveFailures = 0;

    console.log("[TokenRefreshService] Token refresh service stopped");
  }

  /**
   * Force an immediate token refresh
   * Useful for manual refresh or retry after failure
   */
  async refreshNow(): Promise<boolean> {
    if (this.refreshState === "refreshing") {
      console.log("[TokenRefreshService] Already refreshing, skipping");
      return false;
    }

    console.log("[TokenRefreshService] Manual refresh requested");
    return this.performRefresh();
  }

  /**
   * Get current token refresh status
   */
  getStatus(): {
    state: TokenRefreshState;
    lastRefreshTime: number | null;
    consecutiveFailures: number;
    isStarted: boolean;
  } {
    return {
      state: this.refreshState,
      lastRefreshTime: this.lastRefreshTime,
      consecutiveFailures: this.consecutiveFailures,
      isStarted: this.isStarted,
    };
  }

  /**
   * Schedule the next token refresh
   */
  private scheduleNextRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Schedule next refresh
    this.refreshTimer = setInterval(() => {
      this.performRefresh();
    }, REFRESH_INTERVAL_MS);

    console.log(
      `[TokenRefreshService] Next refresh scheduled in ${REFRESH_INTERVAL_MS / 1000 / 60} minutes`
    );
  }

  /**
   * Handle app state changes
   * Refresh token when app comes to foreground
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === "active") {
      console.log("[TokenRefreshService] App came to foreground, checking if refresh needed");

      // Check if we need to refresh (been more than 50 minutes since last refresh)
      const now = Date.now();
      const timeSinceLastRefresh = this.lastRefreshTime ? now - this.lastRefreshTime : Infinity;

      if (timeSinceLastRefresh >= REFRESH_INTERVAL_MS) {
        console.log("[TokenRefreshService] Refresh overdue, triggering now");
        this.performRefresh();
      } else {
        const minutesUntilRefresh = Math.floor((REFRESH_INTERVAL_MS - timeSinceLastRefresh) / 1000 / 60);
        console.log(`[TokenRefreshService] Refresh not due yet (${minutesUntilRefresh} minutes remaining)`);
      }
    }
  };

  /**
   * Perform the token refresh
   */
  private async performRefresh(): Promise<boolean> {
    if (this.refreshState === "refreshing") {
      return false;
    }

    this.refreshState = "refreshing";
    console.log("[TokenRefreshService] Starting token refresh...");

    try {
      // Perform silent sign-in to get fresh token
      const success = await silentSignIn();

      if (success) {
        this.lastRefreshTime = Date.now();
        this.refreshState = "idle";
        this.consecutiveFailures = 0;

        console.log("[TokenRefreshService] Token refresh successful");
        return true;
      } else {
        throw new Error("Silent sign-in failed");
      }
    } catch (error) {
      this.consecutiveFailures++;
      this.refreshState = "error";

      console.error(
        `[TokenRefreshService] Token refresh failed (${this.consecutiveFailures}/${MAX_RETRIES}):`,
        error
      );

      // Schedule retry if haven't exceeded max retries
      if (this.consecutiveFailures < MAX_RETRIES) {
        console.log(`[TokenRefreshService] Scheduling retry in ${RETRY_DELAY_MS / 1000} seconds`);
        setTimeout(() => {
          this.performRefresh();
        }, RETRY_DELAY_MS);
      } else {
        console.error("[TokenRefreshService] Max retries exceeded, user may need to re-authenticate");
        // Reset state after a longer delay
        setTimeout(() => {
          this.consecutiveFailures = 0;
          this.refreshState = "idle";
        }, 5 * 60 * 1000); // 5 minutes
      }

      return false;
    }
  }
}

// Export singleton instance
export const TokenRefreshService = new TokenRefreshServiceClass();

// Export class for testing
export { TokenRefreshServiceClass };

// Export constants for testing
export const TOKEN_REFRESH_CONFIG = {
  TOKEN_EXPIRY_MS,
  REFRESH_BEFORE_EXPIRY_MS,
  REFRESH_INTERVAL_MS,
  RETRY_DELAY_MS,
  MAX_RETRIES,
} as const;
