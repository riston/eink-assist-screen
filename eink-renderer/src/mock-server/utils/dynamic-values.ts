/**
 * Utility functions for generating dynamic values in the mock server.
 * Handles timestamp generation and date offset resolution.
 */

/**
 * Generate ISO timestamp with optional offset in seconds
 */
export function generateTimestamp(offsetSeconds: number = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

/**
 * Parse offset string like "+1d", "+2d 14:00" and return ISO datetime
 * @param offset - Offset string like "+0d", "+1d 14:00", "+3d"
 * @param addMinutes - Additional minutes to add (for generating end times)
 */
export function resolveEventTime(offset: string, addMinutes: number = 0): string {
  const now = new Date();

  // Parse day offset: +0d, +1d, etc.
  const dayMatch = offset.match(/\+(\d+)d/);
  const days = dayMatch && dayMatch[1] ? parseInt(dayMatch[1], 10) : 0;

  // Parse time: 09:00, 14:30, etc.
  const timeMatch = offset.match(/(\d{2}):(\d{2})/);

  const result = new Date(now);
  result.setDate(result.getDate() + days);

  if (timeMatch && timeMatch[1] && timeMatch[2]) {
    result.setHours(parseInt(timeMatch[1], 10));
    result.setMinutes(parseInt(timeMatch[2], 10) + addMinutes);
    result.setSeconds(0);
    result.setMilliseconds(0);
  } else {
    // All-day event, just use the date at midnight
    result.setHours(0, 0, 0, 0);
  }

  return result.toISOString();
}

/**
 * Resolve a single date offset string to ISO format
 */
function resolveDateOffset(offset: string): string {
  const now = new Date();

  // Day offset: +0d, +1d, etc.
  const dayMatch = offset.match(/^\+(\d+)d$/);
  if (dayMatch && dayMatch[1]) {
    const days = parseInt(dayMatch[1], 10);
    const result = new Date(now);
    result.setDate(result.getDate() + days);
    const dateStr = result.toISOString().split("T")[0];
    return dateStr ?? offset; // Return date only for forecast
  }

  // Hour offset: +6h, +12h, etc.
  const hourMatch = offset.match(/^\+(\d+)h$/);
  if (hourMatch && hourMatch[1]) {
    const hours = parseInt(hourMatch[1], 10);
    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  return offset;
}

/**
 * Recursively resolve date offsets in an object.
 * Converts strings like "+0d", "+1d", "+6h" to actual ISO dates.
 */
export function resolveDateOffsets(obj: unknown): unknown {
  if (typeof obj === "string" && obj.match(/^\+\d+[dh]$/)) {
    return resolveDateOffset(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveDateOffsets(item));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = resolveDateOffsets(value);
    }
    return result;
  }

  return obj;
}

/**
 * Generate a unique event UID based on calendar ID, date, and index
 */
export function generateEventUid(calendarId: string, index: number): string {
  const date = new Date().toISOString().split("T")[0];
  return `${calendarId}-${date}-${index}@mock-ha`;
}
