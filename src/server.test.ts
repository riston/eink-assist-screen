import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "./server.js";
import http from "http";
import type { BrowserManager } from "./imageHandler.js";

const TEST_PORT = 3001;
let server: http.Server;
let browserManager: BrowserManager;

beforeAll(() => {
  const created = createServer();
  server = created.server;
  browserManager = created.browserManager;
  server.listen(TEST_PORT);
});

afterAll(async () => {
  await browserManager.close();
  server.close();
});

function makeRequest(
  path: string,
  method: string = "GET"
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: TEST_PORT,
        path,
        method,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 0, data });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function makeRequestBinary(
  path: string,
  method: string = "GET"
): Promise<{ statusCode: number; data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: TEST_PORT,
        path,
        method,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            data: Buffer.concat(chunks),
            contentType: res.headers["content-type"] || "",
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

describe("HTTP Server", () => {
  it("should respond to GET request with query parameters", async () => {
    const response = await makeRequest("/?name=John&age=30");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.data);
    expect(json.message).toBe("GET request received");
    expect(json.parameters).toEqual({ name: "John", age: "30" });
    expect(json.path).toBe("/");
  });

  it("should handle multiple query parameters", async () => {
    const response = await makeRequest("/?foo=bar&count=42&active=true");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.data);
    expect(json.parameters).toEqual({
      foo: "bar",
      count: "42",
      active: "true",
    });
  });

  it("should handle different paths", async () => {
    const response = await makeRequest("/api/test?param=value");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.data);
    expect(json.path).toBe("/api/test");
    expect(json.parameters).toEqual({ param: "value" });
  });

  it("should handle GET request without parameters", async () => {
    const response = await makeRequest("/");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.data);
    expect(json.message).toBe("GET request received");
    expect(json.parameters).toEqual({});
    expect(json.path).toBe("/");
  });

  it("should return 405 for non-GET requests", async () => {
    const response = await makeRequest("/", "POST");
    expect(response.statusCode).toBe(405);

    const json = JSON.parse(response.data);
    expect(json.error).toBe("Method not allowed");
  });

  it("should return JSON content type", async () => {
    const response = await new Promise<{ contentType: string }>((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/",
          method: "GET",
        },
        (res) => {
          resolve({ contentType: res.headers["content-type"] || "" });
          res.resume();
        }
      );
      req.end();
    });

    expect(response.contentType).toBe("application/json");
  });

  it("should return configuration data on /config path", async () => {
    const response = await makeRequest("/config");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.data);
    expect(json).toHaveProperty("image");
    expect(json.image).toEqual({
      path: "/image",
      base_url: "http://192.168.0.156:8000",
    });
    expect(json).toHaveProperty("display");
    expect(json.display).toEqual({
      width: 800,
      height: 480,
      refresh_interval_sec: 300,
    });
  });

  it("should handle /config with query parameters", async () => {
    const response = await makeRequest("/config?verbose=true");
    expect(response.statusCode).toBe(200);

    const json = JSON.parse(response.data);
    expect(json).toHaveProperty("image");
    expect(json.image.path).toBe("/image");
  });

  it("should return 400 when /image is called without url parameter", async () => {
    const response = await makeRequest("/image");
    expect(response.statusCode).toBe(400);

    const json = JSON.parse(response.data);
    expect(json.error).toBe("Missing 'url' parameter");
  });

  it(
    "should render a screenshot for valid URL",
    async () => {
      const testUrl = "data:text/html,<h1>Test Page</h1>";
      const response = await makeRequestBinary(
        `/image?url=${encodeURIComponent(testUrl)}`
      );

      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe("image/png");
      expect(response.data.length).toBeGreaterThan(0);

      // Check PNG signature (first 8 bytes)
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(response.data.subarray(0, 8)).toEqual(pngSignature);
    },
    30000
  );

  it(
    "should accept custom width and height parameters",
    async () => {
      const testUrl = "data:text/html,<h1>Custom Size</h1>";
      const response = await makeRequestBinary(
        `/image?url=${encodeURIComponent(testUrl)}&width=1024&height=768`
      );

      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe("image/png");
      expect(response.data.length).toBeGreaterThan(0);
    },
    30000
  );

  it(
    "should support JPEG format",
    async () => {
      const testUrl = "data:text/html,<h1>JPEG Test</h1>";
      const response = await makeRequestBinary(
        `/image?url=${encodeURIComponent(testUrl)}&format=jpeg`
      );

      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe("image/jpeg");
      expect(response.data.length).toBeGreaterThan(0);

      // Check JPEG signature (FF D8 FF)
      expect(response.data[0]).toBe(0xff);
      expect(response.data[1]).toBe(0xd8);
      expect(response.data[2]).toBe(0xff);
    },
    30000
  );

  it(
    "should support WebP format",
    async () => {
      const testUrl = "data:text/html,<h1>WebP Test</h1>";
      const response = await makeRequestBinary(
        `/image?url=${encodeURIComponent(testUrl)}&format=webp`
      );

      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe("image/webp");
      expect(response.data.length).toBeGreaterThan(0);

      // Check WebP signature (RIFF...WEBP)
      expect(response.data.toString("ascii", 0, 4)).toBe("RIFF");
      expect(response.data.toString("ascii", 8, 12)).toBe("WEBP");
    },
    30000
  );

  it(
    "should accept quality parameter for JPEG",
    async () => {
      const testUrl = "data:text/html,<h1>Quality Test</h1>";
      const response = await makeRequestBinary(
        `/image?url=${encodeURIComponent(testUrl)}&format=jpeg&quality=50`
      );

      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe("image/jpeg");
      expect(response.data.length).toBeGreaterThan(0);
    },
    30000
  );

  it("should return 400 for invalid format", async () => {
    const testUrl = "data:text/html,<h1>Test</h1>";
    const response = await makeRequest(
      `/image?url=${encodeURIComponent(testUrl)}&format=invalid`
    );

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.data);
    expect(json.error).toBe("Invalid format parameter");
  });

  it("should return 400 for invalid quality", async () => {
    const testUrl = "data:text/html,<h1>Test</h1>";
    const response = await makeRequest(
      `/image?url=${encodeURIComponent(testUrl)}&format=jpeg&quality=150`
    );

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.data);
    expect(json.error).toBe("Invalid quality parameter");
  });

  it(
    "should support BMP format",
    async () => {
      const testUrl = "data:text/html,<h1>BMP Test</h1>";
      const response = await makeRequestBinary(
        `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
      );

      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe("image/bmp");
      expect(response.data.length).toBeGreaterThan(0);

      // Check BMP signature (BM)
      expect(response.data.toString("ascii", 0, 2)).toBe("BM");
    },
    30000
  );
});
