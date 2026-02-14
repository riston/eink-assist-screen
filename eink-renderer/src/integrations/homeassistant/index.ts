/**
 * Home Assistant integration module barrel export
 */

export { getEntityState, getMultipleStates, getCalendarEvents } from "./client.js";
export { handleRender } from "./handler.js";
export { handleEntities } from "./entities-handler.js";
export type { EntityState, CalendarEvent } from "./types.js";
