/**
 * Reader configuration
 */
export const READER_CONFIG = {
  /** Delay after seeking before resuming scroll tracking (ms) */
  SEEK_DEBOUNCE_MS: 500,

  /** Preload configuration */
  PRELOAD: {
    /** Number of pages to preload ahead of the current page */
    AHEAD_COUNT: 4,
    /** Number of pages to keep in the 'active' prefetch set before clearing */
    WINDOW_SIZE: 15,
  }
} as const;
