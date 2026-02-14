/**
 * Mock data loader - loads and validates mock-data.json
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface MockEntityData {
  state: string;
  attributes: Record<string, unknown>;
}

export interface MockCalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start_offset: string;
  end_offset?: string;
  all_day?: boolean;
}

export interface MockCalendarData {
  events: MockCalendarEvent[];
}

export interface MockData {
  version: string;
  description?: string;
  entities: Record<string, MockEntityData>;
  calendars: Record<string, MockCalendarData>;
}

/**
 * Load mock data from configuration file.
 * Searches in multiple locations for flexibility.
 */
export function loadMockData(): MockData {
  const paths = [
    resolve(process.cwd(), "config/mock-data.json"),
    resolve(process.cwd(), "../config/mock-data.json"),
    "/data/mock-data.json",
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        const data = JSON.parse(content) as MockData;

        console.log(`Loaded mock data from ${path}`);
        console.log(`  Entities: ${Object.keys(data.entities).length}`);
        console.log(`  Calendars: ${Object.keys(data.calendars).length}`);

        return data;
      } catch (error) {
        console.error(`Failed to load mock data from ${path}:`, error);
      }
    }
  }

  throw new Error(
    "Mock data file not found. Create config/mock-data.json with entity definitions."
  );
}
