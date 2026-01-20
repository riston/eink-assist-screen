import { describe, it, expect, beforeEach, vi } from "vitest";
import { getEntityState, getMultipleStates } from "../index.js";
import { request as httpsRequest } from "node:https";
import { request as httpRequest, ClientRequest, IncomingMessage } from "node:http";
import { getConfig } from "../../../config/index.js";
import { EventEmitter } from "node:events";

// Mock modules
vi.mock("node:https");
vi.mock("node:http");
vi.mock("../../../config/index.js");

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

  function mockHttpRequest(statusCode: number, responseData: unknown, isHttps = false) {
    const mockResponse = Object.assign(new EventEmitter(), {
      statusCode,
      statusMessage: "OK",
    }) as IncomingMessage;

    const mockRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      destroy: vi.fn(),
    }) as unknown as ClientRequest;

    if (isHttps) {
      vi.mocked(httpsRequest).mockImplementation((url, options, callback) => {
        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            mockResponse.emit("data", JSON.stringify(responseData));
            mockResponse.emit("end");
          }, 0);
        }, 0);
        return mockRequest;
      });
    } else {
      vi.mocked(httpRequest).mockImplementation((url, options, callback) => {
        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            mockResponse.emit("data", JSON.stringify(responseData));
            mockResponse.emit("end");
          }, 0);
        }, 0);
        return mockRequest;
      });
    }
  }

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

      mockHttpRequest(200, mockState);

      const result = await getEntityState("sensor.temperature");

      expect(result).toEqual(mockState);
      expect(httpRequest).toHaveBeenCalledWith(
        "http://homeassistant:8123/api/states/sensor.temperature",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
        expect.any(Function)
      );
    });

    it("should return null for 404 entity not found", async () => {
      const mockRequest = new EventEmitter() as any;
      mockRequest.end = vi.fn();
      mockRequest.destroy = vi.fn();

      const mockResponse = new EventEmitter() as any;
      mockResponse.statusCode = 404;
      mockResponse.statusMessage = "Not Found";

      vi.mocked(httpRequest).mockImplementation((url, options, callback) => {
        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            mockResponse.emit("data", "");
            mockResponse.emit("end");
          }, 0);
        }, 0);
        return mockRequest;
      });

      const result = await getEntityState("sensor.nonexistent");

      expect(result).toBeNull();
    });

    it("should throw error for 401 unauthorized", async () => {
      const mockRequest = new EventEmitter() as any;
      mockRequest.end = vi.fn();
      mockRequest.destroy = vi.fn();

      const mockResponse = new EventEmitter() as any;
      mockResponse.statusCode = 401;
      mockResponse.statusMessage = "Unauthorized";

      vi.mocked(httpRequest).mockImplementation((url, options, callback) => {
        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            mockResponse.emit("data", "");
            mockResponse.emit("end");
          }, 0);
        }, 0);
        return mockRequest;
      });

      await expect(getEntityState("sensor.temperature")).rejects.toThrow(
        /Invalid Home Assistant access token/
      );
    });

    it("should throw error on network failure", async () => {
      const mockRequest = new EventEmitter() as any;
      mockRequest.end = vi.fn();
      mockRequest.destroy = vi.fn();

      vi.mocked(httpRequest).mockImplementation(() => {
        setTimeout(() => {
          mockRequest.emit("error", new Error("ECONNREFUSED"));
        }, 0);
        return mockRequest;
      });

      await expect(getEntityState("sensor.temperature")).rejects.toThrow(
        /Home Assistant is unreachable/
      );
    });

    it("should handle invalid JSON response", async () => {
      const mockResponse = new EventEmitter() as any;
      mockResponse.statusCode = 200;

      const mockRequest = new EventEmitter() as any;
      mockRequest.end = vi.fn();
      mockRequest.destroy = vi.fn();

      vi.mocked(httpRequest).mockImplementation((url, options, callback) => {
        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            mockResponse.emit("data", "invalid json{");
            mockResponse.emit("end");
          }, 0);
        }, 0);
        return mockRequest;
      });

      await expect(getEntityState("sensor.temperature")).rejects.toThrow(
        /Failed to parse JSON response/
      );
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

      vi.mocked(httpRequest).mockImplementation((url, options, callback) => {
        const mockResponse = new EventEmitter() as any;
        mockResponse.statusCode = 200;

        const mockReq = new EventEmitter() as any;
        mockReq.end = vi.fn();
        mockReq.destroy = vi.fn();

        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            const urlStr = typeof url === "string" ? url : url.toString();
            if (urlStr.includes("sensor.temperature")) {
              mockResponse.emit("data", JSON.stringify(mockStates["sensor.temperature"]));
            } else if (urlStr.includes("sensor.humidity")) {
              mockResponse.emit("data", JSON.stringify(mockStates["sensor.humidity"]));
            }
            mockResponse.emit("end");
          }, 0);
        }, 0);

        return mockReq;
      });

      const result = await getMultipleStates(["sensor.temperature", "sensor.humidity"]);

      expect(result).toEqual({
        sensor_temperature: mockStates["sensor.temperature"],
        sensor_humidity: mockStates["sensor.humidity"],
      });
    });

    it("should normalize entity IDs (replace dots with underscores)", async () => {
      mockHttpRequest(200, {
        entity_id: "binary_sensor.door",
        state: "on",
        attributes: {},
        last_changed: "2026-01-11T12:00:00Z",
        last_updated: "2026-01-11T12:00:00Z",
      });

      const result = await getMultipleStates(["binary_sensor.door"]);

      expect(result).toHaveProperty("binary_sensor_door");
      expect(result.binary_sensor_door?.entity_id).toBe("binary_sensor.door");
    });

    it("should handle mix of found and not found entities", async () => {
      let callCount = 0;
      vi.mocked(httpRequest).mockImplementation((url, options, callback) => {
        const mockResponse = new EventEmitter() as any;
        const mockReq = new EventEmitter() as any;
        mockReq.end = vi.fn();
        mockReq.destroy = vi.fn();

        setTimeout(() => {
          callback!(mockResponse);
          setTimeout(() => {
            if (callCount === 0) {
              mockResponse.statusCode = 200;
              mockResponse.emit(
                "data",
                JSON.stringify({
                  entity_id: "sensor.temperature",
                  state: "22.5",
                  attributes: {},
                  last_changed: "2026-01-11T12:00:00Z",
                  last_updated: "2026-01-11T12:00:00Z",
                })
              );
            } else {
              mockResponse.statusCode = 404;
            }
            mockResponse.emit("end");
            callCount++;
          }, 0);
        }, 0);

        return mockReq;
      });

      const result = await getMultipleStates(["sensor.temperature", "sensor.nonexistent"]);

      expect(result.sensor_temperature).toBeTruthy();
      expect(result.sensor_nonexistent).toBeNull();
    });
  });
});
