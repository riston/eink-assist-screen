/**
 * Home Assistant entity state interface
 */
export interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

/**
 * Home Assistant calendar event interface
 */
export interface CalendarEvent {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  summary: string;
  description?: string;
  location?: string;
  uid: string;
}
