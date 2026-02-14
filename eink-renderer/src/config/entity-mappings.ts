import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface EntityMappingsConfig {
  version: string;
  mappings: Record<string, string>;
}

let cachedMappings: Record<string, string> | null = null;

/**
 * Load entity mappings from configuration file
 * Supports both /data/entity-mappings.json (production) and
 * ./config/entity-mappings.json (development)
 */
export async function loadEntityMappings(): Promise<Record<string, string>> {
  if (cachedMappings) {
    return cachedMappings;
  }

  const paths = ["/data/entity-mappings.json", "./config/entity-mappings.json"];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = await readFile(path, "utf-8");
        const config: EntityMappingsConfig = JSON.parse(content);

        // Validate structure
        if (!config.mappings || typeof config.mappings !== "object") {
          console.warn(
            `Invalid entity mappings in ${path}: missing or invalid 'mappings' field`
          );
          continue;
        }

        // Validate each mapping
        for (const [semantic, entityId] of Object.entries(config.mappings)) {
          if (!isValidSemanticName(semantic)) {
            console.warn(`Invalid semantic name: ${semantic}`);
          }
          if (!isValidEntityId(entityId)) {
            console.warn(
              `Invalid entity ID: ${entityId} for semantic name: ${semantic}`
            );
          }
        }

        cachedMappings = config.mappings;
        console.info(
          `Loaded ${Object.keys(config.mappings).length} entity mappings from ${path}`
        );
        return cachedMappings;
      } catch (error) {
        console.warn(`Failed to load entity mappings from ${path}:`, error);
      }
    }
  }

  // No mappings file found - use empty mappings (backward compatibility)
  console.info(
    "No entity mappings file found. Using direct entity IDs from templates."
  );
  cachedMappings = {};
  return cachedMappings;
}

/**
 * Get cached mappings (throws if not loaded yet)
 */
export function getEntityMappings(): Record<string, string> {
  if (cachedMappings === null) {
    throw new Error(
      "Entity mappings not loaded. Call loadEntityMappings() first."
    );
  }
  return cachedMappings;
}

/**
 * Resolve semantic name to actual HA entity ID
 * Returns the input if no mapping exists (backward compatibility)
 */
export function resolveEntityId(nameOrId: string): string {
  const mappings = getEntityMappings();
  return mappings[nameOrId] || nameOrId;
}

/**
 * Clear cached mappings (useful for testing)
 */
export function clearEntityMappings(): void {
  cachedMappings = null;
}

/**
 * Validate semantic name format
 */
function isValidSemanticName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * Validate Home Assistant entity ID format
 */
function isValidEntityId(entityId: string): boolean {
  return /^[a-z_]+\.[a-z0-9_]+$/.test(entityId);
}
