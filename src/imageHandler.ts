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
        // For BMP, take PNG screenshot and convert to 1-bit monochrome
        const pngScreenshot = await page.screenshot({
          type: "png",
          fullPage: false,
        });

      // Convert PNG to monochrome using jimp
      const image = await Jimp.read(Buffer.from(pngScreenshot));

      // Convert to grayscale and apply dithering for monochrome
      image.greyscale();
      image.dither();

      const imageWidth = image.bitmap.width;
      const imageHeight = image.bitmap.height;

      // Convert to 1-bit bitmap data
      // Each row must be padded to a multiple of 4 bytes
      const bytesPerRow = Math.ceil(imageWidth / 8);
      const paddedBytesPerRow = Math.ceil(bytesPerRow / 4) * 4;
      const bitmapData = Buffer.alloc(paddedBytesPerRow * imageHeight);

      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          const idx = (y * imageWidth + x) * 4;
          const grayscale = image.bitmap.data[idx] ?? 0; // Red channel (same as green/blue in grayscale)

          // Threshold at 128 to determine black or white
          const bit = grayscale < 128 ? 1 : 0;

          const byteIndex = y * paddedBytesPerRow + Math.floor(x / 8);
          const bitPosition = 7 - (x % 8);

          if (bit && bitmapData[byteIndex] !== undefined) {
            bitmapData[byteIndex] |= (1 << bitPosition);
          }
        }
      }

      // Encode as 1-bit BMP with 2-color palette
      const bmpEncoder = encodeBmp({
        width: imageWidth,
        height: imageHeight,
        data: bitmapData,
        bitPP: 1,
        palette: [
          { red: 255, green: 255, blue: 255, quad: 0 }, // White
          { red: 0, green: 0, blue: 0, quad: 0 },       // Black
        ],
      });

        finalImage = bmpEncoder.data;
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
