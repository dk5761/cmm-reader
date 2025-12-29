/**
 * HTTP types for network layer
 */

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface StoredCookies {
  cookies: Cookie[];
  cookieString: string;
  expiry: number;
  domain: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  method?: "GET" | "POST";
  body?: string;
}

export class CloudflareBypassException extends Error {
  constructor(
    message: string,
    public readonly attempts: number = 0,
    public readonly url: string = ""
  ) {
    super(message);
    this.name = "CloudflareBypassException";
  }
}

/**
 * Callback for triggering manual CF challenge modal
 * Returns a promise that resolves when user completes/cancels challenge
 */
export type ManualChallengeHandler = (
  url: string
) => Promise<{ success: boolean; cookies?: string }>;

/**
 * Pending request awaiting CF challenge resolution
 */
export interface CfChallengeRequest {
  url: string;
  config: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}
