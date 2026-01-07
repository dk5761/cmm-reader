
import { Platform } from "react-native";
import { WebViewFetcherService } from "./WebViewFetcherService";
import { cookieJar } from "./CookieJar";
import { cfLogger } from "@/utils/cfDebugLogger";
import { logger } from "@/utils/logger";
import { CF_CONFIG } from "./config";

export interface SolveResult {
  html: string;
  cookies: string;
}

/**
 * Encapsulates logic for solving Cloudflare challenges via WebView.
 */
class CloudflareSolverClass {
  
  /**
   * Attempt to solve a CF challenge for the given URL.
   * 1. Launches hidden WebView (via WebViewFetcherService).
   * 2. Waits for page to load.
   * 3. Extracts cookies (native sync on iOS).
   * 4. Verifies clearance token.
   */
  async solve(url: string, attempt: number = 1): Promise<SolveResult> {
    const domain = new URL(url).hostname;
    const startTime = Date.now();

    logger.cf.log(`Solving challenge for ${domain} (Attempt ${attempt})`);

    // 1. Fetch HTML (this triggers the WebView navigation)
    // The timeout increases with attempts
    const timeout = 15000 + attempt * 5000;
    const html = await WebViewFetcherService.fetchHtml(url, timeout);

    // 2. Sync & Extract Cookies
    // On iOS, we must explicitly sync from WKWebView to Native
    if (Platform.OS === "ios") {
        await cookieJar.syncFromWebView(url);
    }
    
    // 3. Get the resulting cookie string
    const cookieString = await cookieJar.getCookieString(url);
    const hasClearance = cookieString.includes("cf_clearance");

    await cfLogger.log("CF Solver", "Solve completed", {
        domain,
        success: hasClearance,
        cookieLength: cookieString.length,
        duration: Date.now() - startTime
    });

    if (!hasClearance) {
        throw new Error(`Failed to obtain cf_clearance for ${domain}`);
    }

    return {
        html,
        cookies: cookieString
    };
  }
}

export const CloudflareSolver = new CloudflareSolverClass();
