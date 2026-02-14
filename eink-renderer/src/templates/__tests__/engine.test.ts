import { describe, it, expect } from "vitest";
import { extractEntityIds, renderTemplate } from "../index.js";
import type { EntityState } from "../../integrations/homeassistant/index.js";

describe("templateEngine", () => {
  describe("extractEntityIds", () => {
    it("should extract entity IDs from simple placeholders", () => {
      const template = `
        <div>{{entities.sensor_temperature.state}}</div>
        <div>{{entities.sensor_humidity.state}}</div>
      `;

      const ids = extractEntityIds(template);

      expect(ids).toContain("sensor.temperature");
      expect(ids).toContain("sensor.humidity");
      expect(ids).toHaveLength(2);
    });

    it("should extract entity IDs from conditional blocks", () => {
      const template = `
        {{#if entities.binary_sensor_door.state_is_on}}
          <p>Door is open</p>
        {{/if}}
      `;

      const ids = extractEntityIds(template);

      expect(ids).toContain("binary_sensor.door");
      expect(ids).toHaveLength(1);
    });

    it("should extract entity IDs from nested properties", () => {
      const template = `
        <div>{{entities.sensor_temperature.attributes.unit_of_measurement}}</div>
      `;

      const ids = extractEntityIds(template);

      expect(ids).toContain("sensor.temperature");
    });

    it("should handle duplicate entity IDs", () => {
      const template = `
        <div>{{entities.sensor_temperature.state}}</div>
        <div>{{entities.sensor_temperature.attributes.friendly_name}}</div>
      `;

      const ids = extractEntityIds(template);

      expect(ids).toContain("sensor.temperature");
      expect(ids).toHaveLength(1);
    });

    it("should return empty array for template without entities", () => {
      const template = "<div>Hello World</div>";

      const ids = extractEntityIds(template);

      expect(ids).toEqual([]);
    });

    it("should handle entities with numbers and underscores in ID", () => {
      const template = `
        <div>{{entities.sensor_room_1_temperature.state}}</div>
        <div>{{entities.switch_light_2.state}}</div>
      `;

      const ids = extractEntityIds(template);

      expect(ids).toContain("sensor.room_1_temperature");
      expect(ids).toContain("switch.light_2");
    });
  });

  describe("renderTemplate", () => {
    it("should render simple template with entity data", () => {
      const template = "<div>Temperature: {{entities.sensor_temperature.state}}°C</div>";

      const entities = {
        sensor_temperature: {
          entity_id: "sensor.temperature",
          state: "22.5",
          attributes: {},
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      const result = renderTemplate(template, entities);

      expect(result).toContain("Temperature: 22.5°C");
    });

    it("should render template with attributes", () => {
      const template =
        "<div>{{entities.sensor_temperature.state}}{{entities.sensor_temperature.attributes.unit_of_measurement}}</div>";

      const entities = {
        sensor_temperature: {
          entity_id: "sensor.temperature",
          state: "22.5",
          attributes: { unit_of_measurement: "°C" },
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      const result = renderTemplate(template, entities);

      expect(result).toContain("22.5°C");
    });

    it("should handle conditional blocks with state_is_on helper", () => {
      const template = `
        {{#if entities.binary_sensor_door.state_is_on}}
          <p>Door is OPEN</p>
        {{else}}
          <p>Door is closed</p>
        {{/if}}
      `;

      const entities = {
        binary_sensor_door: {
          entity_id: "binary_sensor.door",
          state: "on",
          attributes: {},
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      const result = renderTemplate(template, entities);

      expect(result).toContain("Door is OPEN");
      expect(result).not.toContain("Door is closed");
    });

    it("should use formatNumber helper", () => {
      const template = "<div>{{formatNumber entities.sensor_temperature.state 1}}</div>";

      const entities = {
        sensor_temperature: {
          entity_id: "sensor.temperature",
          state: "22.567",
          attributes: {},
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      const result = renderTemplate(template, entities);

      expect(result).toContain("22.6");
    });

    it("should use round helper", () => {
      const template = "<div>{{round entities.sensor_temperature.state}}</div>";

      const entities = {
        sensor_temperature: {
          entity_id: "sensor.temperature",
          state: "22.7",
          attributes: {},
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      const result = renderTemplate(template, entities);

      expect(result).toContain("23");
    });

    it("should use math helpers", () => {
      const template = `
        <div>Add: {{add 5 3}}</div>
        <div>Subtract: {{subtract 10 4}}</div>
        <div>Multiply: {{multiply 6 2}}</div>
        <div>Divide: {{divide 20 4}}</div>
      `;

      const result = renderTemplate(template, {});

      expect(result).toContain("Add: 8");
      expect(result).toContain("Subtract: 6");
      expect(result).toContain("Multiply: 12");
      expect(result).toContain("Divide: 5");
    });

    it("should use string helpers", () => {
      const template = `
        <div>{{uppercase "hello"}}</div>
        <div>{{lowercase "WORLD"}}</div>
        <div>{{truncate "Very long text" 8}}</div>
      `;

      const result = renderTemplate(template, {});

      expect(result).toContain("HELLO");
      expect(result).toContain("world");
      expect(result).toContain("Very lon...");
    });

    it("should handle null entities gracefully", () => {
      const template = "<div>{{entities.sensor_missing.state}}</div>";

      const entities = {
        sensor_missing: null,
      };

      const result = renderTemplate(template, entities);

      // Should not crash, render empty or null
      expect(result).toBeTruthy();
    });

    it("should provide state_number helper property", () => {
      const template = "<div>{{entities.sensor_temperature.state_number}}</div>";

      const entities = {
        sensor_temperature: {
          entity_id: "sensor.temperature",
          state: "22.5",
          attributes: {},
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      const result = renderTemplate(template, entities);

      expect(result).toContain("22.5");
    });

    it("should provide timestamp and now in context", () => {
      const template = "<div>{{now}}</div><div>{{timestamp}}</div>";

      const result = renderTemplate(template, {});

      // Should contain ISO date string and unix timestamp
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result).toMatch(/\d{13}/); // Unix timestamp
    });

    it("should throw error on invalid template syntax", () => {
      const template = "{{#if unclosed";

      expect(() => renderTemplate(template, {})).toThrow(/Template rendering failed/);
    });
  });
});
