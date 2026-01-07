/**
 * Get headers required for loading images from a specific source.
 * Uses the source's getImageHeaders() method if available.
 */

import { getSource } from "@/sources";
import { USER_AGENT } from "../http/userAgent";

/**
 * Get headers for downloading images from a source.
 * Falls back to basic headers if source not found.
 */
export function getSourceHeaders(sourceId: string): Record<string, string> {
  const source = getSource(sourceId);

  if (source) {
    return source.getImageHeaders();
  }

  // Fallback headers if source not found
  return {
    "User-Agent": USER_AGENT,
  };
}
