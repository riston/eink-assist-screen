import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Weather icons cache
const weatherIcons: Record<string, string> = {};

// UI icons cache
const uiIcons: Record<string, string> = {};

/**
 * Load all weather icons from the weather directory
 * Called once at startup
 */
export function loadWeatherIcons(): void {
  const weatherDir = join(__dirname, "weather");

  try {
    const files = readdirSync(weatherDir);

    for (const file of files) {
      if (file.endsWith(".svg")) {
        const iconName = basename(file, ".svg");
        const filePath = join(weatherDir, file);
        const content = readFileSync(filePath, "utf-8").trim();
        weatherIcons[iconName] = content;
      }
    }

    console.log(`[Icons] Loaded ${Object.keys(weatherIcons).length} weather icons`);
  } catch (error) {
    console.error("[Icons] Failed to load weather icons:", error);
  }
}

/**
 * Load all UI icons from the ui directory
 * Called once at startup
 */
export function loadUiIcons(): void {
  const uiDir = join(__dirname, "ui");

  try {
    const files = readdirSync(uiDir);

    for (const file of files) {
      if (file.endsWith(".svg")) {
        const iconName = basename(file, ".svg");
        const filePath = join(uiDir, file);
        const content = readFileSync(filePath, "utf-8").trim();
        uiIcons[iconName] = content;
      }
    }

    console.log(`[Icons] Loaded ${Object.keys(uiIcons).length} UI icons`);
  } catch (error) {
    console.error("[Icons] Failed to load UI icons:", error);
  }
}

/**
 * Get a weather icon by condition name
 * @param condition Weather condition (e.g., "sunny", "cloudy", "rainy")
 * @returns SVG markup string or empty string if not found
 */
export function getWeatherIcon(condition: string | undefined): string {
  if (!condition) {
    return weatherIcons["cloudy"] ?? "";
  }

  const normalizedCondition = condition.toLowerCase();
  return weatherIcons[normalizedCondition] ?? weatherIcons["cloudy"] ?? "";
}

/**
 * Get a UI icon by name
 * @param name Icon name (e.g., "play", "pause", "volume-high")
 * @returns SVG markup string or empty string if not found
 */
export function getUiIcon(name: string | undefined): string {
  if (!name) {
    return "";
  }

  const normalizedName = name.toLowerCase();
  return uiIcons[normalizedName] ?? "";
}

/**
 * Get all loaded weather icon names
 */
export function getLoadedWeatherIcons(): string[] {
  return Object.keys(weatherIcons);
}

/**
 * Get all loaded UI icon names
 */
export function getLoadedUiIcons(): string[] {
  return Object.keys(uiIcons);
}
