/**
 * Handler for GET /api/calendars/{entityId}
 * Returns calendar events in Home Assistant format
 */

import type { ServerResponse } from "node:http";
import type { MockData } from "../data/mock-loader.js";
import {
  resolveEventTime,
  generateEventUid,
} from "../utils/dynamic-values.js";

export function handleCalendars(
  entityId: string,
  start: string,
  end: string,
  mockData: MockData,
  res: ServerResponse
): void {
  const calendar = mockData.calendars[entityId];

  if (!calendar) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: `Calendar not found: ${entityId}` }));
    return;
  }

  const startDate = start ? new Date(start) : new Date();
  const endDate = end
    ? new Date(end)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days ahead

  const events = calendar.events
    .map((event, index) => {
      const startTime = resolveEventTime(event.start_offset);
      const endTime = event.end_offset
        ? resolveEventTime(event.end_offset)
        : resolveEventTime(event.start_offset, 60); // Default 1 hour duration

      return {
        start: event.all_day
          ? { date: startTime.split("T")[0] }
          : { dateTime: startTime },
        end: event.all_day
          ? { date: endTime.split("T")[0] }
          : { dateTime: endTime },
        summary: event.summary,
        description: event.description || "",
        location: event.location || "",
        uid: generateEventUid(entityId, index),
      };
    })
    .filter((event) => {
      // Filter events within the requested range
      const eventStart = new Date(
        event.start.dateTime || event.start.date || ""
      );
      return eventStart >= startDate && eventStart <= endDate;
    });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(events, null, 2));
}
