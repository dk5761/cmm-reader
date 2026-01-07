import { DEBUG, DebugCategory } from "@/core/config/debug";

/**
 * Create a namespaced logger that respects debug flags
 */
function createLogger(category: DebugCategory, prefix: string) {
  const isEnabled = () => DEBUG[category];

  return {
    log: (msg: string, data?: object) => {
      if (isEnabled()) {
        if (data !== undefined) {
          console.log(`[${prefix}] ${msg}`, data);
        } else {
          console.log(`[${prefix}] ${msg}`);
        }
      }
    },
    warn: (msg: string, data?: object) => {
      if (isEnabled()) {
        if (data !== undefined) {
          console.warn(`[${prefix}] ${msg}`, data);
        } else {
          console.warn(`[${prefix}] ${msg}`);
        }
      }
    },
    error: (msg: string, data?: object) => {
      // Errors always log regardless of debug flag
      if (data !== undefined) {
        console.error(`[${prefix}] ${msg}`, data);
      } else {
        console.error(`[${prefix}] ${msg}`);
      }
    },
  };
}

/**
 * Centralized logger with namespaced categories
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.cf.log('Challenge detected', { url });
 *   logger.sync.warn('Queue full');
 *   logger.reader.error('Failed to load chapter', { error });
 */
export const logger = {
  cf: createLogger("CF", "CF"),
  sync: createLogger("SYNC", "Sync"),
  reader: createLogger("READER", "Reader"),
  http: createLogger("HTTP", "HTTP"),
  manga: createLogger("MANGA", "Manga"),
};
