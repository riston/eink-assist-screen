/**
 * Handler for GET /api/states/{entityId}
 * Returns entity state in Home Assistant format
 */

import type { ServerResponse } from "node:http";
import type { MockData } from "../data/mock-loader.js";
import {
  generateTimestamp,
  resolveDateOffsets,
} from "../utils/dynamic-values.js";

export function handleStates(
  entityId: string,
  mockData: MockData,
  res: ServerResponse
): void {
  const entity = mockData.entities[entityId];

  if (!entity) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: `Entity not found: ${entityId}` }));
    return;
  }

  const now = new Date().toISOString();

  // Resolve any date offsets in attributes (e.g., forecast datetimes, sun times)
  const resolvedAttributes = resolveDateOffsets(entity.attributes);

  const response = {
    entity_id: entityId,
    state: entity.state,
    attributes: resolvedAttributes,
    last_changed: generateTimestamp(-300), // 5 minutes ago
    last_updated: now,
  };

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(response, null, 2));
}
