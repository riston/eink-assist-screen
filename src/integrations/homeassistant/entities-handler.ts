import { IncomingMessage, ServerResponse } from "node:http";
import { loadTemplate, templateExists, listTemplates } from "../../templates/index.js";
import { extractEntityIds, extractCalendarIds } from "../../templates/index.js";
import { getMultipleStates, getCalendarEvents } from "./client.js";
import { getEntityMappings } from "../../config/index.js";
import type { CalendarEvent } from "./types.js";

interface EntitiesResult {
  success: true;
  template: string;
  entities_count: number;
  entities: Record<string, any>;
  calendars_count: number;
  calendars: Record<string, CalendarEvent[]>;
  fetched_at: string;
}

interface ErrorResult {
  error: string;
  message: string;
  details?: any;
}

/**
 * Fetch multiple calendars in parallel
 * @param calendarIds Array of calendar entity IDs with config
 * @returns Record of calendar events by normalized calendar ID
 */
async function getMultipleCalendars(
  calendarIds: Array<{ id: string; daysAhead: number; limit: number }>
): Promise<Record<string, CalendarEvent[]>> {
  const now = new Date();

  const promises = calendarIds.map(async ({ id, daysAhead, limit }) => {
    const start = now.toISOString();
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    const events = await getCalendarEvents(id, start, end);
    const normalizedKey = id.replace(/\./g, "_");

    return {
      key: normalizedKey,
      events: events.slice(0, limit),
    };
  });

  const results = await Promise.all(promises);

  const record: Record<string, CalendarEvent[]> = {};
  for (const { key, events } of results) {
    record[key] = events;
  }

  return record;
}

/**
 * Prepare calendar data with semantic name support
 * Makes calendar data accessible via both normalized IDs and semantic names
 */
function prepareCalendarData(
  calendars: Record<string, CalendarEvent[]>
): Record<string, CalendarEvent[]> {
  const prepared: Record<string, CalendarEvent[]> = {};
  const mappings = getEntityMappings();

  // Create reverse mapping (normalized entity_id -> semantic names)
  const reverseMap: Record<string, string[]> = {};
  for (const [semantic, entityId] of Object.entries(mappings)) {
    const normalized = entityId.replace(/\./g, "_");
    if (!reverseMap[normalized]) {
      reverseMap[normalized] = [];
    }
    reverseMap[normalized].push(semantic);
  }

  for (const [key, events] of Object.entries(calendars)) {
    // Add under normalized calendar ID
    prepared[key] = events;

    // Also add under semantic names
    if (reverseMap[key]) {
      for (const semanticName of reverseMap[key]) {
        prepared[semanticName] = events;
      }
    }
  }

  return prepared;
}

/**
 * Handle /ha/entities requests
 * Fetches entity data for a given template and returns it as JSON
 */
export async function handleEntities(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Validate template parameter
    const templateName = params.template;
    if (!templateName) {
      sendError(res, 400, "missing_parameter", "Missing required parameter: template", {
        required: ["template"],
        optional: [],
      });
      return;
    }

    // Check if template exists
    if (!templateExists(templateName)) {
      const availableTemplates = await listTemplates();
      sendError(res, 404, "template_not_found", `Template not found: ${templateName}`, {
        available_templates: availableTemplates,
      });
      return;
    }

    console.log(`[Entities] Fetching entities for template: ${templateName}`);

    // Load template from disk
    const templateHtml = await loadTemplate(templateName);

    // Extract entity IDs from template
    const entityIds = extractEntityIds(templateHtml);

    // Extract calendar IDs from template
    const calendarIds = extractCalendarIds(templateHtml);

    console.log(`[Entities] Found ${entityIds.length} entities and ${calendarIds.length} calendars in template`);

    // Fetch entity states and calendar events from Home Assistant in parallel
    const [entities, calendars] = await Promise.all([
      getMultipleStates(entityIds),
      calendarIds.length > 0
        ? getMultipleCalendars(calendarIds)
        : Promise.resolve({} as Record<string, CalendarEvent[]>),
    ]);

    // Check for missing entities
    const missingEntities = Object.entries(entities)
      .filter(([_, state]) => state === null)
      .map(([id, _]) => id);

    if (missingEntities.length > 0) {
      console.warn(`[Entities] Missing entities: ${missingEntities.join(", ")}`);
    }

    // Check for calendars with no events
    const emptyCalendars = Object.entries(calendars)
      .filter(([_, events]) => events.length === 0)
      .map(([id, _]) => id);

    if (emptyCalendars.length > 0) {
      console.warn(`[Entities] No upcoming events for calendars: ${emptyCalendars.join(", ")}`);
    }

    // Prepare calendar data with semantic name support
    const preparedCalendars = prepareCalendarData(calendars);

    // Send response
    const result: EntitiesResult = {
      success: true,
      template: templateName,
      entities_count: entityIds.length,
      entities: entities,
      calendars_count: calendarIds.length,
      calendars: preparedCalendars,
      fetched_at: new Date().toISOString(),
    };

    sendJson(res, 200, result);
  } catch (error) {
    console.error("Error in /ha/entities handler:", error);

    const err = error as any;

    // Categorize errors
    if (err.message?.includes("Home Assistant is unreachable")) {
      sendError(res, 503, "ha_unreachable", err.message);
    } else if (err.message?.includes("Invalid Home Assistant access token")) {
      sendError(res, 401, "ha_auth_failed", err.message, {
        hint: "Check access_token in addon configuration",
      });
    } else if (err.message?.includes("Failed to read template")) {
      sendError(res, 500, "template_read_error", err.message);
    } else {
      sendError(res, 500, "internal_error", `Unexpected error: ${err.message}`);
    }
  }
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 */
function sendError(
  res: ServerResponse,
  statusCode: number,
  error: string,
  message: string,
  details?: any
): void {
  const errorResponse: ErrorResult = {
    error,
    message,
    ...(details && { details }),
  };

  sendJson(res, statusCode, errorResponse);
}
