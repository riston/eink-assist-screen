import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../index.js";
import http from "http";
import type { BrowserManager } from "../../rendering/index.js";

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
): Promise<{ statusCode: number; data: Buffer; contentType: string; contentLength: string }> {
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
            contentLength: res.headers["content-length"] || "",
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
    expect(json.image).toHaveProperty("path", "/image");
    expect(json.image).toHaveProperty("base_url");
    expect(json.image).toHaveProperty("parameters");
    expect(json.image.parameters).toHaveProperty("format", "bmp");
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

  describe("BMP Chunking", () => {
    it(
      "should return full BMP image without offset/limit parameters",
      async () => {
        const testUrl = "data:text/html,<h1>Full BMP</h1>";
        const response = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
        );

        expect(response.statusCode).toBe(200);
        expect(response.contentType).toBe("image/bmp");

        // Verify Content-Length matches actual data length
        expect(response.contentLength).toBe(response.data.length.toString());

        // Verify BMP signature
        expect(response.data.toString("ascii", 0, 2)).toBe("BM");

        // Verify it's a 1-bit BMP by checking the bits per pixel field (offset 28-29)
        const bitsPerPixel = response.data.readUInt16LE(28);
        expect(bitsPerPixel).toBe(1);
      },
      30000
    );

    it(
      "should return correct chunk with offset parameter",
      async () => {
        const testUrl = "data:text/html,<h1>Chunk Test</h1>";

        // First, get the full image to compare against
        const fullResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
        );

        // Request a chunk starting at byte 1000
        const offset = 1000;
        const chunkResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&offset=${offset}`
        );

        expect(chunkResponse.statusCode).toBe(200);

        // Verify chunk is smaller than full image
        expect(chunkResponse.data.length).toBe(fullResponse.data.length - offset);

        // Verify Content-Length header is correct
        expect(chunkResponse.contentLength).toBe(chunkResponse.data.length.toString());

        // Verify the chunk data matches the corresponding part of the full image
        expect(chunkResponse.data).toEqual(fullResponse.data.subarray(offset));
      },
      30000
    );

    it(
      "should return correct chunk with offset and limit parameters",
      async () => {
        const testUrl = "data:text/html,<h1>Limited Chunk</h1>";

        // First, get the full image
        const fullResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
        );

        // Request a specific chunk
        const offset = 500;
        const limit = 2000;
        const chunkResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&offset=${offset}&limit=${limit}`
        );

        expect(chunkResponse.statusCode).toBe(200);

        // Verify chunk size is exactly the limit
        expect(chunkResponse.data.length).toBe(limit);

        // Verify Content-Length header is correct
        expect(chunkResponse.contentLength).toBe(limit.toString());

        // Verify the chunk data matches the corresponding part of the full image
        expect(chunkResponse.data).toEqual(fullResponse.data.subarray(offset, offset + limit));
      },
      30000
    );

    it(
      "should handle limit exceeding remaining data",
      async () => {
        const testUrl = "data:text/html,<h1>Overflow Test</h1>";

        // Get full image
        const fullResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
        );

        // Request a chunk with limit larger than remaining data
        const offset = fullResponse.data.length - 100;
        const limit = 500; // Only 100 bytes remain
        const chunkResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&offset=${offset}&limit=${limit}`
        );

        expect(chunkResponse.statusCode).toBe(200);

        // Should only return the remaining 100 bytes
        expect(chunkResponse.data.length).toBe(100);

        // Verify Content-Length matches actual returned data
        expect(chunkResponse.contentLength).toBe("100");

        // Verify the data matches
        expect(chunkResponse.data).toEqual(fullResponse.data.subarray(offset));
      },
      30000
    );

    it(
      "should return multiple consecutive chunks that reconstruct full image",
      async () => {
        const testUrl = "data:text/html,<h1>Multi-chunk Test</h1>";

        // Get full image
        const fullResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
        );

        // Fetch image in 6KB chunks (typical for e-ink displays)
        const chunkSize = 6000;
        const chunks: Buffer[] = [];
        let offset = 0;

        while (offset < fullResponse.data.length) {
          const chunkResponse = await makeRequestBinary(
            `/image?url=${encodeURIComponent(testUrl)}&format=bmp&offset=${offset}&limit=${chunkSize}`
          );

          expect(chunkResponse.statusCode).toBe(200);
          chunks.push(chunkResponse.data);

          // Verify Content-Length is correct
          expect(chunkResponse.contentLength).toBe(chunkResponse.data.length.toString());

          offset += chunkSize;
        }

        // Reconstruct the full image from chunks
        const reconstructed = Buffer.concat(chunks);

        // Verify reconstructed image matches original
        expect(reconstructed).toEqual(fullResponse.data);

        // Verify BMP signature is intact
        expect(reconstructed.toString("ascii", 0, 2)).toBe("BM");
      },
      30000
    );

    it(
      "should handle offset at start (offset=0)",
      async () => {
        const testUrl = "data:text/html,<h1>Zero Offset</h1>";

        const fullResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp`
        );

        const limit = 1000;
        const chunkResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&offset=0&limit=${limit}`
        );

        expect(chunkResponse.statusCode).toBe(200);
        expect(chunkResponse.data.length).toBe(limit);
        expect(chunkResponse.contentLength).toBe(limit.toString());

        // Should start with BMP signature
        expect(chunkResponse.data.toString("ascii", 0, 2)).toBe("BM");
        expect(chunkResponse.data).toEqual(fullResponse.data.subarray(0, limit));
      },
      30000
    );

    it(
      "should verify BMP 1-bit format structure",
      async () => {
        const testUrl = "data:text/html,<h1>BMP Structure</h1>";
        const response = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&width=800&height=480`
        );

        expect(response.statusCode).toBe(200);

        // BMP File Header checks (14 bytes)
        expect(response.data.toString("ascii", 0, 2)).toBe("BM"); // Signature

        const fileSize = response.data.readUInt32LE(2);
        expect(fileSize).toBe(response.data.length);

        const pixelDataOffset = response.data.readUInt32LE(10);
        expect(pixelDataOffset).toBe(62); // 14 (file header) + 40 (DIB header) + 8 (palette)

        // DIB Header checks (40 bytes for BITMAPINFOHEADER)
        const headerSize = response.data.readUInt32LE(14);
        expect(headerSize).toBe(40);

        const width = response.data.readInt32LE(18);
        expect(width).toBe(800);

        const height = response.data.readInt32LE(22);
        expect(height).toBe(-480); // Negative height = top-down BMP

        const planes = response.data.readUInt16LE(26);
        expect(planes).toBe(1);

        const bitsPerPixel = response.data.readUInt16LE(28);
        expect(bitsPerPixel).toBe(1); // 1-bit monochrome

        const compression = response.data.readUInt32LE(30);
        expect(compression).toBe(0); // No compression

        const colorsInPalette = response.data.readUInt32LE(46);
        expect(colorsInPalette).toBe(2); // 2 colors (black and white)

        // Color Palette checks (8 bytes total: 2 colors × 4 bytes each)
        // First color (black): B=0, G=0, R=0, Reserved=0
        expect(response.data[54]).toBe(0);
        expect(response.data[55]).toBe(0);
        expect(response.data[56]).toBe(0);
        expect(response.data[57]).toBe(0);

        // Second color (white): B=255, G=255, R=255, Reserved=0
        expect(response.data[58]).toBe(255);
        expect(response.data[59]).toBe(255);
        expect(response.data[60]).toBe(255);
        expect(response.data[61]).toBe(0);

        // Verify file size is appropriate for 1-bit 800x480 image
        // Expected: 62 (headers) + (100 bytes per row × 480 rows) = 48062 bytes
        // (800 pixels / 8 bits per byte = 100 bytes, rounded up to multiple of 4)
        expect(response.data.length).toBe(48062);
      },
      30000
    );

    it(
      "should apply threshold parameter correctly in BMP generation",
      async () => {
        const testUrl = "data:text/html,<div style='background:gray'>Test</div>";

        // Get BMP with low threshold (more pixels should be white)
        const lowThresholdResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&threshold=50`
        );

        // Get BMP with high threshold (more pixels should be black)
        const highThresholdResponse = await makeRequestBinary(
          `/image?url=${encodeURIComponent(testUrl)}&format=bmp&threshold=200`
        );

        expect(lowThresholdResponse.statusCode).toBe(200);
        expect(highThresholdResponse.statusCode).toBe(200);

        // Both should be same size (1-bit BMP)
        expect(lowThresholdResponse.data.length).toBe(highThresholdResponse.data.length);

        // But the pixel data should be different (after header)
        const pixelDataOffset = 62;
        expect(lowThresholdResponse.data.subarray(pixelDataOffset)).not.toEqual(
          highThresholdResponse.data.subarray(pixelDataOffset)
        );
      },
      30000
    );
  });
});
