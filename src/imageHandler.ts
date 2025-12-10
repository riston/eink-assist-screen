import http from "http";
import { URL } from "url";
import puppeteer, { Browser } from "puppeteer";
import { Jimp } from "jimp";
import { encode as encodeBmp } from "bmp-ts";

export interface BrowserManager {
  getBrowser: () => Promise<Browser>;
  close: () => Promise<void>;
}

export function createBrowserManager(): BrowserManager {
  let browserInstance: Browser | null = null;

  return {
    getBrowser: async () => {
      if (!browserInstance || !browserInstance.connected) {
        browserInstance = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }
      return browserInstance;
    },
    close: async () => {
      if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
      }
    },
  };
}

export function createImageRequestHandler(browserManager: BrowserManager) {
  return async (
    url: URL,
    params: Record<string, string>,
    res: http.ServerResponse
  ) => {
  const targetUrl = params.url;

  if (!targetUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing 'url' parameter" }));
    return;
  }

  const format = (params.format || "png").toLowerCase();
  const validFormats = ["png", "jpeg", "webp", "bmp"];

  if (!validFormats.includes(format)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Invalid format parameter",
        message: `Format must be one of: ${validFormats.join(", ")}`,
      })
    );
    return;
  }

  const quality = params.quality ? parseInt(params.quality) : undefined;
  if (quality !== undefined && (quality < 0 || quality > 100)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Invalid quality parameter",
        message: "Quality must be between 0 and 100",
      })
    );
    return;
  }

  const threshold = params.threshold ? parseInt(params.threshold) : 128;
  if (threshold < 0 || threshold > 255) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Invalid threshold parameter",
        message: "Threshold must be between 0 and 255",
      })
    );
    return;
  }

  try {
    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    try {
      const width = parseInt(params.width || "800");
      const height = parseInt(params.height || "480");
      await page.setViewport({ width, height });

      await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 10000 });

      let finalImage: Buffer | Uint8Array;

      if (format === "bmp") {
        // For BMP, take PNG screenshot and convert to monochrome
        const pngScreenshot = await page.screenshot({
          type: "png",
          fullPage: false,
        });

        // Read PNG and apply monochrome conversion
        const image = await Jimp.read(Buffer.from(pngScreenshot));

        // Apply threshold to convert to monochrome
        const { width, height, data } = image.bitmap;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx] ?? 0;
            const g = data[idx + 1] ?? 0;
            const b = data[idx + 2] ?? 0;

            // Calculate luminance
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            // Apply threshold
            const value = luminance >= threshold ? 255 : 0;

            // Set all RGB channels to same value (grayscale)
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
          }
        }

        // Use Jimp's built-in BMP export
        finalImage = await image.getBuffer("image/bmp");
      } else {
        // For other formats, use Puppeteer's native support
        const screenshotOptions: {
          type: "png" | "jpeg" | "webp";
          fullPage: boolean;
          quality?: number;
        } = {
          type: format as "png" | "jpeg" | "webp",
          fullPage: false,
        };

        if (format !== "png" && quality !== undefined) {
          screenshotOptions.quality = quality;
        }

        finalImage = await page.screenshot(screenshotOptions);
      }

      const contentTypeMap: Record<string, string> = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
        bmp: "image/bmp",
      };

      res.writeHead(200, { "Content-Type": contentTypeMap[format] });
      res.end(finalImage);
    } finally {
      // Always close the page after use, but keep the browser running
      await page.close();
    }
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Failed to render screenshot",
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }
  };
}
