/**
 * Reader V3 Constants
 * Centralized magic numbers for manga reader
 */

export const READER = {
  // Placeholder height when dimensions unknown (80% of screen height)
  PLACEHOLDER_HEIGHT_RATIO: 0.8,

  // Animation durations (ms)
  OVERLAY_FADE_DURATION: 200,
  IMAGE_TRANSITION_DURATION: 200,

  // Slider dimensions
  SLIDER_HEIGHT: 40,
  SLIDER_TOUCH_SLOP: 10,

  // Chapter divider
  CHAPTER_DIVIDER_PADDING_Y: 24,

  // FlashList/Scrolling
  SCROLL_END_REACHED_THRESHOLD: 0.5,
  SCROLL_EVENT_THROTTLE: 100,

  // Page visibility tracking (for marking as read)
  PAGE_READ_THRESHOLD_RATIO: 1.0,

  // Cache
  DIMENSION_CACHE_MAX_SIZE: 500,
  DIMENSION_CACHE_TTL_MS: 1000 * 60 * 30, // 30 minutes
} as const;
