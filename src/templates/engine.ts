import Handlebars from "handlebars";
import type { EntityState, CalendarEvent } from "../integrations/homeassistant/types.js";
import { getEntityMappings } from "../config/index.js";

// Register custom Handlebars helpers
function registerHelpers() {
  // Format number with specific decimal places
  Handlebars.registerHelper("formatNumber", function (value: any, decimals: number = 2) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toFixed(decimals);
  });

  // Round to nearest integer
  Handlebars.registerHelper("round", function (value: any) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return Math.round(num);
  });

  // Check if state equals a value
  Handlebars.registerHelper("state_is", function (entity: any, targetState: string) {
    return entity?.state === targetState;
  });

  // Math operations
  Handlebars.registerHelper("add", function (a: any, b: any) {
    return parseFloat(a) + parseFloat(b);
  });

  Handlebars.registerHelper("subtract", function (a: any, b: any) {
    return parseFloat(a) - parseFloat(b);
  });

  Handlebars.registerHelper("multiply", function (a: any, b: any) {
    return parseFloat(a) * parseFloat(b);
  });

  Handlebars.registerHelper("divide", function (a: any, b: any) {
    return parseFloat(a) / parseFloat(b);
  });

  // String operations
  Handlebars.registerHelper("uppercase", function (value: string) {
    return value?.toString().toUpperCase() || "";
  });

  Handlebars.registerHelper("lowercase", function (value: string) {
    return value?.toString().toLowerCase() || "";
  });

  Handlebars.registerHelper("truncate", function (value: string, length: number) {
    const str = value?.toString() || "";
    return str.length > length ? str.substring(0, length) + "..." : str;
  });

  // Time formatting helper
  Handlebars.registerHelper("formatTime", function (isoString: string, format: string = "HH:MM") {
    if (!isoString) return "--:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "--:--";

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    if (format === "12h") {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    }

    return format === "HH:MM:SS" ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
  });

  // Date formatting helper
  Handlebars.registerHelper("formatDate", function (isoString: string, format: string = "MMM DD") {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekday = weekdays[date.getDay()];

    if (format === "MMM DD") {
      return `${month} ${day}`;
    } else if (format === "ddd MMM DD") {
      return `${weekday} ${month} ${day}`;
    }

    return `${month} ${day}`;
  });

  // Comparison helpers
  Handlebars.registerHelper("lt", function (a: any, b: any) {
    return parseFloat(a) < parseFloat(b);
  });

  Handlebars.registerHelper("gt", function (a: any, b: any) {
    return parseFloat(a) > parseFloat(b);
  });

  Handlebars.registerHelper("lte", function (a: any, b: any) {
    return parseFloat(a) <= parseFloat(b);
  });

  Handlebars.registerHelper("gte", function (a: any, b: any) {
    return parseFloat(a) >= parseFloat(b);
  });

  Handlebars.registerHelper("eq", function (a: any, b: any) {
    return a === b;
  });

  // Percentage conversion (0.0-1.0 to 0-100)
  Handlebars.registerHelper("percentage", function (value: any) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : Math.round(num * 100);
  });

  // Volume bar visualization
  Handlebars.registerHelper("volumeBar", function (volumeLevel: any, barLength: number = 10) {
    const level = parseFloat(volumeLevel);
    if (isNaN(level)) return '[──────────]';

    const filled = Math.round(level * barLength);
    const empty = barLength - filled;
    return '[' + '█'.repeat(filled) + '─'.repeat(empty) + ']';
  });

  // Capitalize first letter
  Handlebars.registerHelper("capitalize", function (str: string) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  });
}

// Initialize helpers on module load
registerHelpers();

/**
 * Extract entity IDs from a Handlebars template
 * Looks for {{entities.entity_id...}} patterns
 * @param templateHtml HTML template with Handlebars placeholders
 * @returns Array of unique entity IDs
 */
// Common Home Assistant domains that contain underscores
const MULTI_WORD_DOMAINS = [
  'binary_sensor',
  'device_tracker',
  'media_player',
  'remote_control',
  'climate_control',
  'cover_control',
];

export function extractEntityIds(templateHtml: string): string[] {
  // Match patterns like {{entities.sensor_temperature_sensor.state}}
  // or {{#if entities.binary_sensor_door.state_is_on}}
  // Captures the full normalized entity ID (domain_entityname with underscores)
  const regex = /\{\{[^}]*entities\.([a-z][a-z0-9_]*)/gi;
  const matches = templateHtml.matchAll(regex);

  const entityIds = new Set<string>();
  const mappings = getEntityMappings();

  for (const match of matches) {
    const nameOrNormalizedId = match[1];
    if (!nameOrNormalizedId) continue;

    // First, try to resolve as semantic name
    let entityId = mappings[nameOrNormalizedId];

    if (!entityId) {
      // Fallback: treat as normalized entity ID (backward compatibility)
      entityId = nameOrNormalizedId;

      // Apply existing normalization logic for multi-word domains
      for (const domain of MULTI_WORD_DOMAINS) {
        const domainNormalized = domain.replace(/\./g, "_");
        if (nameOrNormalizedId.startsWith(domainNormalized + "_")) {
          // Found a match: binary_sensor_door -> binary_sensor.door
          entityId =
            domain +
            "." +
            nameOrNormalizedId.substring(domainNormalized.length + 1);
          break;
        }
      }

      // If no multi-word domain matched, assume single-word domain
      if (entityId === nameOrNormalizedId) {
        // sensor_temperature_sensor -> sensor.temperature_sensor
        entityId = nameOrNormalizedId.replace(/_/, ".");
      }
    }

    entityIds.add(entityId);
  }

  return Array.from(entityIds);
}

/**
 * Extract calendar IDs from a Handlebars template
 * Looks for {{#each calendars.calendar_name}} patterns
 * @param templateHtml HTML template with Handlebars placeholders
 * @returns Array of calendar entity IDs with configuration
 */
export function extractCalendarIds(templateHtml: string): Array<{
  id: string;
  daysAhead: number;
  limit: number;
}> {
  // Match patterns like {{#each calendars.risto_kalender}}
  const regex = /\{\{#each calendars\.([a-z][a-z0-9_]*)/gi;
  const matches = templateHtml.matchAll(regex);

  const calendarIds = new Set<string>();
  const mappings = getEntityMappings();

  for (const match of matches) {
    const nameOrNormalizedId = match[1];
    if (!nameOrNormalizedId) continue;

    // Try to resolve as semantic name
    let entityId = mappings[nameOrNormalizedId];

    // Fallback: treat as normalized entity ID
    if (!entityId) {
      entityId = nameOrNormalizedId.replace(/_/, ".");
    }

    calendarIds.add(entityId);
  }

  // For now, return with default config (7 days, 3 events)
  // This could be extended to parse from template comments
  return Array.from(calendarIds).map(id => ({
    id,
    daysAhead: 7,
    limit: 3,
  }));
}

/**
 * Prepare calendar data for template rendering
 * Transform event structures to be template-friendly
 */
export function prepareCalendarData(calendars: Record<string, CalendarEvent[]>): Record<string, any> {
  const prepared: Record<string, any> = {};
  const mappings = getEntityMappings();

  console.log(`[Calendar] Preparing calendar data for ${Object.keys(calendars).length} calendars`);

  // Create reverse mapping for semantic names
  const reverseMap: Record<string, string[]> = {};
  for (const [semantic, entityId] of Object.entries(mappings)) {
    const normalized = entityId.replace(/\./g, "_");
    if (!reverseMap[normalized]) {
      reverseMap[normalized] = [];
    }
    reverseMap[normalized].push(semantic);
  }

  for (const [key, events] of Object.entries(calendars)) {
    console.log(`[Calendar] Processing ${key}: ${events.length} events`);

    const enrichedEvents = events.map(event => ({
      summary: event.summary,
      description: event.description || "",
      location: event.location || "",
      start_time: event.start.dateTime || event.start.date || "",
      end_time: event.end.dateTime || event.end.date || "",
      is_all_day: !event.start.dateTime, // If no dateTime, it's all-day
      uid: event.uid,
    }));

    // Add under normalized calendar ID
    prepared[key] = enrichedEvents;

    // Also add under semantic names
    if (reverseMap[key]) {
      for (const semanticName of reverseMap[key]) {
        console.log(`[Calendar] Also adding under semantic name: ${semanticName}`);
        prepared[semanticName] = enrichedEvents;
      }
    }
  }

  console.log(`[Calendar] Final prepared keys: ${Object.keys(prepared).join(", ")}`);
  return prepared;
}

/**
 * Prepare entity data for template rendering
 * Enriches entities with helper properties for easier template usage
 */
function prepareEntityData(entities: Record<string, EntityState | null>): Record<string, any> {
  const prepared: Record<string, any> = {};

  for (const [key, entity] of Object.entries(entities)) {
    if (!entity) {
      prepared[key] = null;
      continue;
    }

    prepared[key] = {
      ...entity,
      // Helper properties
      state_number: parseFloat(entity.state) || 0,
      state_is_on: entity.state === "on",
      state_is_off: entity.state === "off",
    };
  }

  return prepared;
}

/**
 * Prepare entity data for template rendering with semantic name support
 * Enriches entities with helper properties and makes them accessible via both
 * normalized entity IDs and semantic names
 */
function prepareEntityDataWithMappings(
  entities: Record<string, EntityState | null>
): Record<string, any> {
  const prepared: Record<string, any> = {};
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

  for (const [key, entity] of Object.entries(entities)) {
    if (!entity) {
      prepared[key] = null;

      // Also add null for semantic names
      if (reverseMap[key]) {
        for (const semanticName of reverseMap[key]) {
          prepared[semanticName] = null;
        }
      }
      continue;
    }

    const enrichedEntity = {
      ...entity,
      // Helper properties
      state_number: parseFloat(entity.state) || 0,
      state_is_on: entity.state === "on",
      state_is_off: entity.state === "off",
    };

    // Add under normalized entity ID (backward compatibility)
    prepared[key] = enrichedEntity;

    // Also add under semantic names
    if (reverseMap[key]) {
      for (const semanticName of reverseMap[key]) {
        prepared[semanticName] = enrichedEntity;
      }
    }
  }

  return prepared;
}

/**
 * Render a Handlebars template with entity data
 * @param templateHtml HTML template with Handlebars placeholders
 * @param entities Entity states indexed by normalized entity ID (underscores instead of dots)
 * @param calendars Optional calendar events indexed by normalized calendar ID
 * @returns Rendered HTML
 */
export function renderTemplate(
  templateHtml: string,
  entities: Record<string, EntityState | null>,
  calendars?: Record<string, CalendarEvent[]>
): string {
  try {
    const template = Handlebars.compile(templateHtml);

    const preparedCalendars = calendars ? prepareCalendarData(calendars) : {};
    console.log(`[Calendar] Rendering template with calendars:`, Object.keys(preparedCalendars));

    const data = {
      entities: prepareEntityDataWithMappings(entities),
      calendars: preparedCalendars,
      now: new Date().toISOString(),
      timestamp: Date.now(),
    };

    return template(data);
  } catch (error) {
    throw new Error(`Template rendering failed: ${(error as Error).message}`);
  }
}
