/**
 * Parse various date formats into timestamps
 * Handles relative dates ("2 days ago") and absolute dates
 */
export function parseChapterDate(dateStr?: string): number {
  if (!dateStr) return 0;

  const trimmed = dateStr.trim().toLowerCase();
  const now = Date.now();

  // Handle ordinal format: "December 22nd 2022" or "January 1st 2023"
  const ordinalMatch = dateStr.match(
    /^([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)\s+(\d{4})$/i
  );
  if (ordinalMatch) {
    const [, month, day, year] = ordinalMatch;
    const monthMap: Record<string, number> = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
    };
    const monthIndex = monthMap[month.toLowerCase()];
    if (monthIndex !== undefined) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      return date.getTime();
    }
  }

  // Handle format: "Dec-20-2025 10:20" or "Jan-04-2026"
  const dashDateMatch = dateStr.match(
    /^([A-Z][a-z]{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?$/i
  );
  if (dashDateMatch) {
    const [, month, day, year, hour = "00", minute = "00"] = dashDateMatch;
    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const monthIndex = monthMap[month.toLowerCase()];
    if (monthIndex !== undefined) {
      const date = new Date(
        parseInt(year),
        monthIndex,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
      return date.getTime();
    }
  }

  // Handle numeric format: "1/3/2026" or "11/21/2025" (M/D/YYYY)
  const slashDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    const [, month, day, year] = slashDateMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.getTime();
  }

  // Try standard Date.parse first (handles ISO, RFC, etc.)
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) return parsed;

  // Handle relative dates
  const relativeMatch = trimmed.match(
    /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/
  );
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];

    const msPerUnit: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000, // Approximate
      year: 365 * 24 * 60 * 60 * 1000, // Approximate
    };

    const ms = msPerUnit[unit] || 0;
    return now - value * ms;
  }

  // Handle "just now", "today", "yesterday"
  if (trimmed.includes("just now") || trimmed === "now") {
    return now;
  }
  if (trimmed === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }
  if (trimmed === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday.getTime();
  }

  // Failed to parse
  console.warn(`[dateParser] Could not parse date: "${dateStr}"`);
  return 0;
}
