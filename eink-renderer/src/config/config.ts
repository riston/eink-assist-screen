import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface HAConfig {
  accessToken: string;
  homeAssistantUrl: string;
  cacheTtlDefault: number;
  cacheMaxSize: number;
}

let cachedConfig: HAConfig | null = null;

/**
 * Load Home Assistant configuration from environment variables or options.json
 * Following Home Assistant addon pattern
 */
export async function loadConfig(): Promise<HAConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  let config: Partial<HAConfig> = {};

  // Try to load from Home Assistant addon options file
  const optionsPath = "/data/options.json";
  if (existsSync(optionsPath)) {
    try {
      const optionsContent = await readFile(optionsPath, "utf-8");
      const options = JSON.parse(optionsContent);
      config = {
        accessToken: options.access_token || "",
        homeAssistantUrl: options.home_assistant_url || "http://homeassistant:8123",
        cacheTtlDefault: options.cache_ttl_default || 300,
        cacheMaxSize: options.cache_max_size || 50,
      };

      // Forward active_template to env so constants.ts picks it up
      if (options.active_template && !process.env.ACTIVE_TEMPLATE) {
        process.env.ACTIVE_TEMPLATE = options.active_template;
      }
    } catch (error) {
      console.warn("Failed to load /data/options.json:", error);
    }
  }

  // Fallback to environment variables (useful for development)
  if (!config.accessToken) {
    config = {
      accessToken: process.env.HA_ACCESS_TOKEN || process.env.HASSIO_TOKEN || "",
      homeAssistantUrl:
        process.env.HA_URL || process.env.HOMEASSISTANT_URL || "http://homeassistant:8123",
      cacheTtlDefault: parseInt(process.env.CACHE_TTL_DEFAULT || "300", 10),
      cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE || "50", 10),
    };
  }

  // Validate required fields
  if (!config.accessToken) {
    throw new Error(
      "Home Assistant access token not configured. " +
        "Please set access_token in addon configuration or HA_ACCESS_TOKEN environment variable."
    );
  }

  if (!config.homeAssistantUrl) {
    throw new Error("Home Assistant URL not configured.");
  }

  // Ensure URL doesn't have trailing slash
  config.homeAssistantUrl = config.homeAssistantUrl.replace(/\/$/, "");

  cachedConfig = config as HAConfig;
  return cachedConfig;
}

/**
 * Get cached config (throws if not loaded yet)
 */
export function getConfig(): HAConfig {
  if (!cachedConfig) {
    throw new Error("Configuration not loaded. Call loadConfig() first.");
  }
  return cachedConfig;
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfig(): void {
  cachedConfig = null;
}
