import { getConfig } from "../../config/index.js";
import type { EntityState, CalendarEvent } from "./types.js";

export type { EntityState, CalendarEvent };

interface ApiError extends Error {
  statusCode: number;
}

function createApiError(message: string, statusCode: number): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  return error;
}

/**
 * Fetch a single entity state from Home Assistant
 * @param entityId Entity ID (e.g., "sensor.temperature")
 * @returns Entity state or null if not found
 */
export async function getEntityState(entityId: string): Promise<EntityState | null> {
  const config = getConfig();
  const url = `${config.homeAssistantUrl}/api/states/${entityId}`;

  try {
    const response = await makeRequest(url, config.accessToken);
    return response as EntityState;
  } catch (error) {
    if ((error as ApiError).statusCode === 404) {
      return null; // Entity not found
    }
    throw error;
  }
}

/**
 * Fetch multiple entity states in parallel
 * @param entityIds Array of entity IDs
 * @returns Record of entity states by entity ID (normalized key without dots)
 */
export async function getMultipleStates(
  entityIds: string[]
): Promise<Record<string, EntityState | null>> {
  const promises = entityIds.map(async (id) => {
    const state = await getEntityState(id);
    // Normalize entity ID: sensor.temperature -> sensor_temperature
    const normalizedKey = id.replace(/\./g, "_");
    return { key: normalizedKey, state };
  });

  const results = await Promise.all(promises);

  const record: Record<string, EntityState | null> = {};
  for (const { key, state } of results) {
    record[key] = state;
  }

  return record;
}

/**
 * Fetch calendar events from Home Assistant
 * @param entityId Calendar entity ID (e.g., "calendar.risto_kalender")
 * @param start ISO datetime string for start of range
 * @param end ISO datetime string for end of range
 * @returns Array of calendar events
 */
export async function getCalendarEvents(
  entityId: string,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  const config = getConfig();

  // Use the full entity ID (including calendar. prefix) for the API call
  const url = `${config.homeAssistantUrl}/api/calendars/${entityId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

  console.log(`[Calendar] Fetching ${entityId} from ${start} to ${end}`);

  try {
    const response = await makeRequest(url, config.accessToken);
    const events = response as CalendarEvent[];
    console.log(`[Calendar] API returned ${events.length} events for ${entityId}`);
    if (events.length > 0) {
      const firstEvent = events[0];
      const eventTime = firstEvent?.start?.dateTime || firstEvent?.start?.date || 'unknown';
      console.log(`[Calendar] First event: "${firstEvent?.summary}" at ${eventTime}`);
    }
    return events;
  } catch (error) {
    if ((error as ApiError).statusCode === 404) {
      console.log(`[Calendar] Calendar not found: ${entityId}`);
      return []; // Calendar not found
    }
    console.error(`[Calendar] Error fetching ${entityId}:`, error);
    throw error;
  }
}

/**
 * Make HTTP request to Home Assistant API using fetch
 */
async function makeRequest(url: string, accessToken: string, timeout: number = 5000): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 401 || response.status === 403) {
      throw createApiError("Invalid Home Assistant access token", response.status);
    }

    if (response.status === 404) {
      throw createApiError("Entity not found", 404);
    }

    throw createApiError(
      `Home Assistant API error: ${response.status} ${response.statusText}`,
      response.status
    );
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to Home Assistant timed out after ${timeout}ms`);
    }

    if ((error as ApiError).statusCode) {
      throw error;
    }

    throw new Error(`Home Assistant is unreachable: ${(error as Error).message}`);
  }
}
