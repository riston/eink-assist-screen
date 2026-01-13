import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { getConfig } from "../../config/index.js";
import type { EntityState } from "./types.js";

export type { EntityState };

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
    if ((error as any).statusCode === 404) {
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
 * Make HTTP/HTTPS request to Home Assistant API
 */
function makeRequest(url: string, accessToken: string, timeout: number = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const request = urlObj.protocol === "https:" ? httpsRequest : httpRequest;

    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout,
    };

    const req = request(url, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${(error as Error).message}`));
          }
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          reject(
            Object.assign(new Error("Invalid Home Assistant access token"), {
              statusCode: res.statusCode,
            })
          );
        } else if (res.statusCode === 404) {
          reject(Object.assign(new Error("Entity not found"), { statusCode: 404 }));
        } else {
          reject(
            Object.assign(
              new Error(`Home Assistant API error: ${res.statusCode} ${res.statusMessage}`),
              { statusCode: res.statusCode }
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(
        Object.assign(new Error(`Home Assistant is unreachable: ${error.message}`), {
          originalError: error,
        })
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request to Home Assistant timed out after ${timeout}ms`));
    });

    req.end();
  });
}
