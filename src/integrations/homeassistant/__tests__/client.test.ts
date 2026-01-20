import { describe, it, expect, beforeEach, vi } from "vitest";
import { getEntityState, getMultipleStates } from "../index.js";
import { getConfig } from "../../../config/index.js";

// Mock config module
vi.mock("../../../config/index.js");

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createMockResponse(status: number, data: unknown, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    redirected: false,
    type: "basic",
    url: "",
    clone: () => createMockResponse(status, data, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
  } as Response;
}

describe("haClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock config
    vi.mocked(getConfig).mockReturnValue({
      accessToken: "test-token",
      homeAssistantUrl: "http://homeassistant:8123",
      cacheTtlDefault: 300,
      cacheMaxSize: 50,
    });
  });

  describe("getEntityState", () => {
    it("should fetch entity state successfully", async () => {
      const mockState = {
        entity_id: "sensor.temperature",
        state: "22.5",
        attributes: {
          unit_of_measurement: "°C",
          friendly_name: "Temperature",
        },
        last_changed: "2026-01-11T12:00:00Z",
        last_updated: "2026-01-11T12:00:00Z",
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(200, mockState));

      const result = await getEntityState("sensor.temperature");

      expect(result).toEqual(mockState);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://homeassistant:8123/api/states/sensor.temperature",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should return null for 404 entity not found", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(404, {}, "Not Found"));

      const result = await getEntityState("sensor.nonexistent");

      expect(result).toBeNull();
    });

    it("should throw error for 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(401, {}, "Unauthorized"));

      await expect(getEntityState("sensor.temperature")).rejects.toThrow(
        /Invalid Home Assistant access token/
      );
    });

    it("should throw error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      await expect(getEntityState("sensor.temperature")).rejects.toThrow(
        /Home Assistant is unreachable/
      );
    });

    it("should handle invalid JSON response", async () => {
      const badResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
        headers: new Headers(),
      } as Response;

      mockFetch.mockResolvedValueOnce(badResponse);

      await expect(getEntityState("sensor.temperature")).rejects.toThrow();
    });
  });

  describe("getMultipleStates", () => {
    it("should fetch multiple entities in parallel", async () => {
      const mockStates = {
        "sensor.temperature": {
          entity_id: "sensor.temperature",
          state: "22.5",
          attributes: { unit_of_measurement: "°C" },
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
        "sensor.humidity": {
          entity_id: "sensor.humidity",
          state: "65",
          attributes: { unit_of_measurement: "%" },
          last_changed: "2026-01-11T12:00:00Z",
          last_updated: "2026-01-11T12:00:00Z",
        },
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("sensor.temperature")) {
          return Promise.resolve(createMockResponse(200, mockStates["sensor.temperature"]));
        }
        if (url.includes("sensor.humidity")) {
          return Promise.resolve(createMockResponse(200, mockStates["sensor.humidity"]));
        }
        return Promise.resolve(createMockResponse(404, {}));
      });

      const result = await getMultipleStates(["sensor.temperature", "sensor.humidity"]);

      expect(result).toEqual({
        sensor_temperature: mockStates["sensor.temperature"],
        sensor_humidity: mockStates["sensor.humidity"],
      });
    });

    it("should normalize entity IDs (replace dots with underscores)", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, {
        entity_id: "binary_sensor.door",
        state: "on",
        attributes: {},
        last_changed: "2026-01-11T12:00:00Z",
        last_updated: "2026-01-11T12:00:00Z",
      }));

      const result = await getMultipleStates(["binary_sensor.door"]);

      expect(result).toHaveProperty("binary_sensor_door");
      expect(result.binary_sensor_door?.entity_id).toBe("binary_sensor.door");
    });

    it("should handle mix of found and not found entities", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("sensor.temperature")) {
          return Promise.resolve(createMockResponse(200, {
            entity_id: "sensor.temperature",
            state: "22.5",
            attributes: {},
            last_changed: "2026-01-11T12:00:00Z",
            last_updated: "2026-01-11T12:00:00Z",
          }));
        }
        return Promise.resolve(createMockResponse(404, {}));
      });

      const result = await getMultipleStates(["sensor.temperature", "sensor.nonexistent"]);

      expect(result.sensor_temperature).toBeTruthy();
      expect(result.sensor_nonexistent).toBeNull();
    });
  });
});
