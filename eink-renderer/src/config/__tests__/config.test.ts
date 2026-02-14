import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, getConfig, clearConfig } from "../index.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// Mock fs modules
vi.mock("node:fs/promises");
vi.mock("node:fs");

describe("config", () => {
  beforeEach(() => {
    clearConfig();
    vi.resetAllMocks();
    // Clear environment variables
    delete process.env.HA_ACCESS_TOKEN;
    delete process.env.HASSIO_TOKEN;
    delete process.env.HA_URL;
    delete process.env.HOMEASSISTANT_URL;
    delete process.env.CACHE_TTL_DEFAULT;
    delete process.env.CACHE_MAX_SIZE;
  });

  afterEach(() => {
    clearConfig();
  });

  describe("loadConfig", () => {
    it("should load config from options.json when it exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token-from-file",
          home_assistant_url: "http://ha.local:8123",
          cache_ttl_default: 600,
          cache_max_size: 100,
        })
      );

      const config = await loadConfig();

      expect(config).toEqual({
        accessToken: "test-token-from-file",
        homeAssistantUrl: "http://ha.local:8123",
        cacheTtlDefault: 600,
        cacheMaxSize: 100,
      });
      expect(existsSync).toHaveBeenCalledWith("/data/options.json");
      expect(readFile).toHaveBeenCalledWith("/data/options.json", "utf-8");
    });

    it("should remove trailing slash from homeAssistantUrl", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          home_assistant_url: "http://ha.local:8123/",
        })
      );

      const config = await loadConfig();

      expect(config.homeAssistantUrl).toBe("http://ha.local:8123");
    });

    it("should fall back to environment variables when options.json doesn't exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.HA_ACCESS_TOKEN = "test-token-from-env";
      process.env.HA_URL = "http://env.ha.local:8123";
      process.env.CACHE_TTL_DEFAULT = "450";
      process.env.CACHE_MAX_SIZE = "75";

      const config = await loadConfig();

      expect(config).toEqual({
        accessToken: "test-token-from-env",
        homeAssistantUrl: "http://env.ha.local:8123",
        cacheTtlDefault: 450,
        cacheMaxSize: 75,
      });
    });

    it("should use HASSIO_TOKEN as fallback for access token", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.HASSIO_TOKEN = "hassio-token";
      process.env.HA_URL = "http://ha.local:8123";

      const config = await loadConfig();

      expect(config.accessToken).toBe("hassio-token");
    });

    it("should use default values for optional parameters", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.HA_ACCESS_TOKEN = "test-token";

      const config = await loadConfig();

      expect(config.cacheTtlDefault).toBe(300);
      expect(config.cacheMaxSize).toBe(50);
      expect(config.homeAssistantUrl).toBe("http://homeassistant:8123");
    });

    it("should throw error when access token is missing", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(loadConfig()).rejects.toThrow(
        /Home Assistant access token not configured/
      );
    });

    it("should cache config after first load", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.HA_ACCESS_TOKEN = "test-token";

      const config1 = await loadConfig();
      const config2 = await loadConfig();

      expect(config1).toBe(config2);
      expect(existsSync).toHaveBeenCalledTimes(1); // Only called once
    });

    it("should handle malformed options.json gracefully", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue("invalid json{");
      process.env.HA_ACCESS_TOKEN = "fallback-token";

      const config = await loadConfig();

      expect(config.accessToken).toBe("fallback-token");
    });
  });

  describe("getConfig", () => {
    it("should return cached config", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.HA_ACCESS_TOKEN = "test-token";

      await loadConfig();
      const config = getConfig();

      expect(config.accessToken).toBe("test-token");
    });

    it("should throw error if config not loaded yet", () => {
      expect(() => getConfig()).toThrow(/Configuration not loaded/);
    });
  });

  describe("clearConfig", () => {
    it("should clear cached config", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.HA_ACCESS_TOKEN = "test-token";

      await loadConfig();
      clearConfig();

      expect(() => getConfig()).toThrow(/Configuration not loaded/);
    });
  });
});
