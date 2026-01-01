import RNFS from "react-native-fs";
import { Platform } from "react-native";

/**
 * CF Debug Logger - File-based logging for Cloudflare flow debugging
 * Logs all CF events, cookie operations, and timings to a file
 */
class CFDebugLogger {
  private logFile: string;
  private maxLogSize = 5 * 1024 * 1024; // 5MB max
  private isEnabled = true;

  constructor() {
    const timestamp = new Date().toISOString().split("T")[0];
    this.logFile = `${RNFS.DocumentDirectoryPath}/cf-debug-${timestamp}.log`;
    this.initialize();
  }

  private async initialize() {
    try {
      const exists = await RNFS.exists(this.logFile);
      if (!exists) {
        await RNFS.writeFile(this.logFile, this.getHeader(), "utf8");
        // Add a test log entry
        await this.log("System", "Logger initialized", {
          platform: Platform.OS,
          version: Platform.Version,
        });
      }
    } catch (error) {
      console.error("[CFDebugLogger] Init failed:", error);
    }
  }

  private getHeader(): string {
    return `=== CF Debug Log ===
App: Manga Reader
Platform: ${Platform.OS} ${Platform.Version}
Started: ${new Date().toISOString()}
===================

`;
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 23);
  }

  /**
   * Main logging method
   */
  async log(tag: string, message: string, context?: any) {
    if (!this.isEnabled) return;

    try {
      const timestamp = this.formatTimestamp();
      let logEntry = `[${timestamp}] [${tag}] ${message}\n`;

      if (context) {
        logEntry += this.formatContext(context);
      }

      logEntry += "\n";

      await RNFS.appendFile(this.logFile, logEntry, "utf8");

      // Also log to console for dev
      if (__DEV__) {
        console.log(`[CF Debug] [${tag}] ${message}`, context || "");
      }
    } catch (error) {
      console.error("[CFDebugLogger] Write failed:", error);
    }
  }

  private formatContext(context: any): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || value === null) {
        lines.push(`  ${key}: ${value}`);
      } else if (typeof value === "object") {
        lines.push(
          `  ${key}: ${JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")}`
        );
      } else if (typeof value === "string" && value.length > 100) {
        lines.push(
          `  ${key}: ${value.substring(0, 100)}... (${value.length} chars)`
        );
      } else {
        lines.push(`  ${key}: ${value}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Log cookie extraction with full details
   */
  async logCookieExtraction(
    source: "iOS-Native" | "Android-WebView",
    url: string,
    result: {
      success: boolean;
      cookieString?: string;
      cookies?: Array<{ name: string; value: string }>;
      error?: string;
      durationMs?: number;
    }
  ) {
    const context: any = {
      source,
      url: url.substring(0, 60),
      success: result.success,
      durationMs: result.durationMs,
    };

    if (result.cookieString) {
      context.cookieLength = result.cookieString.length;
      context.hasCfClearance = result.cookieString.includes("cf_clearance");

      // Extract just cf_clearance value for debugging
      const cfMatch = result.cookieString.match(/cf_clearance=([^;]+)/);
      if (cfMatch) {
        context.cfClearanceValue = cfMatch[1].substring(0, 20) + "...";
      }

      // Count total cookies
      context.cookieCount = (result.cookieString.match(/=/g) || []).length;
    }

    if (result.cookies) {
      context.cookiesArray = result.cookies.map((c) => ({
        name: c.name,
        valueLength: c.value.length,
        valuePreview: c.value.substring(0, 20) + "...",
      }));
    }

    if (result.error) {
      context.error = result.error;
    }

    await this.log(
      "Cookie Extraction",
      result.success ? "✓ Success" : "✗ Failed",
      context
    );
  }

  /**
   * Log cookie sync with timing
   */
  async logCookieSync(
    operation: "toNative" | "toCache" | "fromCache",
    domain: string,
    result: {
      success: boolean;
      cookieLength?: number;
      durationMs: number;
      error?: string;
    }
  ) {
    await this.log(
      "Cookie Sync",
      `${operation} ${result.success ? "✓" : "✗"}`,
      {
        domain,
        durationMs: result.durationMs,
        cookieLength: result.cookieLength,
        error: result.error,
      }
    );
  }

  /**
   * Log CF challenge state changes
   */
  async logChallengeState(
    state:
      | "detected"
      | "modal-opened"
      | "modal-closed"
      | "completed"
      | "failed"
      | "cancelled",
    details?: any
  ) {
    await this.log("CF Challenge", `State: ${state}`, details);
  }

  /**
   * Log HTTP request/response for CF flows
   */
  async logHttpRequest(
    method: string,
    url: string,
    result: {
      status?: number;
      isCfChallenge?: boolean;
      hasCookies?: boolean;
      durationMs?: number;
      error?: string;
    }
  ) {
    await this.log("HTTP Request", `${method} ${result.status || "ERR"}`, {
      url: url.substring(0, 80),
      ...result,
    });
  }

  /**
   * Get all logs as string
   */
  async getLogs(): Promise<string> {
    try {
      const exists = await RNFS.exists(this.logFile);
      if (!exists) return "No logs yet";

      return await RNFS.readFile(this.logFile, "utf8");
    } catch (error) {
      return `Error reading logs: ${error}`;
    }
  }

  /**
   * Get last N log entries
   */
  async getRecentLogs(count: number = 50): Promise<string[]> {
    try {
      const logs = await this.getLogs();
      const lines = logs
        .split("\n")
        .filter((l) => l.trim().length > 0) // Get all non-empty lines
        .filter((l) => l.startsWith("[") || l.startsWith("  ")); // Log lines or context lines

      return lines.slice(-count);
    } catch {
      return [];
    }
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    try {
      await RNFS.writeFile(this.logFile, this.getHeader(), "utf8");
      await this.log("System", "Logs cleared");
    } catch (error) {
      console.error("[CFDebugLogger] Clear failed:", error);
    }
  }

  /**
   * Get log file path for sharing
   */
  getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * Check file size and rotate if needed
   */
  async checkRotation() {
    try {
      const stat = await RNFS.stat(this.logFile);
      const fileSize =
        typeof stat.size === "string" ? parseInt(stat.size) : stat.size;
      if (fileSize > this.maxLogSize) {
        const oldFile = this.logFile.replace(".log", ".old.log");
        await RNFS.moveFile(this.logFile, oldFile);
        await this.initialize();
        await this.log("System", "Log rotated", { oldFile });
      }
    } catch (error) {
      console.error("[CFDebugLogger] Rotation check failed:", error);
    }
  }
}

// Singleton instance
export const cfLogger = new CFDebugLogger();
