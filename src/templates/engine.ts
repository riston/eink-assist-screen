import Handlebars from "handlebars";
import type { EntityState } from "../integrations/homeassistant/index.js";

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
  for (const match of matches) {
    const normalizedId = match[1];
    if (!normalizedId) continue;

    // Try to intelligently convert normalized ID to entity ID
    // Check if it starts with a known multi-word domain
    let entityId = normalizedId;
    for (const domain of MULTI_WORD_DOMAINS) {
      const domainNormalized = domain.replace(/\./g, '_');
      if (normalizedId.startsWith(domainNormalized + '_')) {
        // Found a match: binary_sensor_door -> binary_sensor.door
        entityId = domain + '.' + normalizedId.substring(domainNormalized.length + 1);
        break;
      }
    }

    // If no multi-word domain matched, assume single-word domain
    if (entityId === normalizedId) {
      // sensor_temperature_sensor -> sensor.temperature_sensor
      entityId = normalizedId.replace(/_/, '.');
    }

    entityIds.add(entityId);
  }

  return Array.from(entityIds);
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
 * Render a Handlebars template with entity data
 * @param templateHtml HTML template with Handlebars placeholders
 * @param entities Entity states indexed by normalized entity ID (underscores instead of dots)
 * @returns Rendered HTML
 */
export function renderTemplate(
  templateHtml: string,
  entities: Record<string, EntityState | null>
): string {
  try {
    const template = Handlebars.compile(templateHtml);

    const data = {
      entities: prepareEntityData(entities),
      now: new Date().toISOString(),
      timestamp: Date.now(),
    };

    return template(data);
  } catch (error) {
    throw new Error(`Template rendering failed: ${(error as Error).message}`);
  }
}
