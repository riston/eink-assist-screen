import http from "http";
import { URL } from "url";
import puppeteer, { Browser } from "puppeteer";
import { Jimp } from "jimp";
import * as renderedCache from "../core/cache/index.js";
import { loadTemplate, templateExists } from "../templates/index.js";
import { extractEntityIds, extractCalendarIds, renderTemplate } from "../templates/index.js";
import { getMultipleStates, getCalendarEvents } from "../integrations/homeassistant/index.js";
import type { CalendarEvent } from "../integrations/homeassistant/index.js";
import { createBrowserManager, type BrowserManager } from "./browserManager.js";

/**
 * Fetch multiple calendars in parallel
 */
async function getMultipleCalendars(
  calendarIds: Array<{ id: string; daysAhead: number; limit: number }>
): Promise<Record<string, CalendarEvent[]>> {
  const now = new Date();

  const promises = calendarIds.map(async ({ id, daysAhead, limit }) => {
    const start = now.toISOString();
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    const events = await getCalendarEvents(id, start, end);
    const normalizedKey = id.replace(/\./g, "_");

    return {
      key: normalizedKey,
      events: events.slice(0, limit),
    };
  });

  const results = await Promise.all(promises);

  const record: Record<string, CalendarEvent[]> = {};
  for (const { key, events } of results) {
    record[key] = events;
  }

  return record;
}

interface ValidationResult {
  valid: boolean;
  error?: { code: number; message: string; details: string };
}

const VALID_FORMATS = ["png", "jpeg", "webp", "bmp"] as const;
type ImageFormat = typeof VALID_FORMATS[number];

function validateUrlOrTemplate(
  url: string | undefined,
  template: string | undefined
): ValidationResult {
  // Must have exactly one of url or template
  if (!url && !template) {
    return {
      valid: false,
      error: {
        code: 400,
        message: "Missing parameter",
        details: "Either 'url' or 'template' parameter is required",
      },
    };
  }

  if (url && template) {
    return {
      valid: false,
      error: {
        code: 400,
        message: "Conflicting parameters",
        details: "Cannot specify both 'url' and 'template' parameters",
      },
    };
  }

  return { valid: true };
}

function validateFormat(format: string | undefined): ValidationResult & { format?: ImageFormat } {
  const normalizedFormat = (format || "png").toLowerCase();

  if (!VALID_FORMATS.includes(normalizedFormat as ImageFormat)) {
    return {
      valid: false,
      error: {
        code: 400,
        message: "Invalid format parameter",
        details: `Format must be one of: ${VALID_FORMATS.join(", ")}`,
      },
    };
  }

  return { valid: true, format: normalizedFormat as ImageFormat };
}

function validateQuality(quality: string | undefined): ValidationResult & { quality?: number } {
  if (!quality) {
    return { valid: true };
  }

  const qualityValue = parseInt(quality);

  if (qualityValue < 0 || qualityValue > 100) {
    return {
      valid: false,
      error: {
        code: 400,
        message: "Invalid quality parameter",
        details: "Quality must be between 0 and 100",
      },
    };
  }

  return { valid: true, quality: qualityValue };
}

function validateThreshold(threshold: string | undefined): ValidationResult & { threshold?: number } {
  const thresholdValue = threshold ? parseInt(threshold) : 128;

  if (thresholdValue < 0 || thresholdValue > 255) {
    return {
      valid: false,
      error: {
        code: 400,
        message: "Invalid threshold parameter",
        details: "Threshold must be between 0 and 255",
      },
    };
  }

  return { valid: true, threshold: thresholdValue };
}

function sendError(res: http.ServerResponse, error: { code: number; message: string; details: string }): void {
  res.writeHead(error.code, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: error.message,
      message: error.details,
    })
  );
}

export function createImageRequestHandler(browserManager: BrowserManager) {
  return async (
    url: URL,
    params: Record<string, string>,
    res: http.ServerResponse
  ) => {
    // Validate all parameters
    const urlOrTemplateValidation = validateUrlOrTemplate(params.url, params.template);
    if (!urlOrTemplateValidation.valid) {
      sendError(res, urlOrTemplateValidation.error!);
      return;
    }

    const formatValidation = validateFormat(params.format);
    if (!formatValidation.valid) {
      sendError(res, formatValidation.error!);
      return;
    }

    const qualityValidation = validateQuality(params.quality);
    if (!qualityValidation.valid) {
      sendError(res, qualityValidation.error!);
      return;
    }

    const thresholdValidation = validateThreshold(params.threshold);
    if (!thresholdValidation.valid) {
      sendError(res, thresholdValidation.error!);
      return;
    }

    // Extract validated values
    const format = formatValidation.format!;
    const quality = qualityValidation.quality;
    const threshold = thresholdValidation.threshold!;

  try {
    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    try {
      const width = parseInt(params.width || "800");
      const height = parseInt(params.height || "480");
      await page.setViewport({ width, height });

      // Handle two modes: URL mode or Template mode
      if (params.template) {
        // Template mode: fetch rendered HTML from cache or render it
        const templateName = params.template;
        const cacheKey = `ha:${templateName}`;

        let html = renderedCache.get(cacheKey);

        if (!html) {
          // Auto-render: template not in cache, fetch and render now
          if (!templateExists(templateName)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Template not found",
                message: `Template '${templateName}' not found. Call /ha/render first or ensure template file exists.`,
              })
            );
            return;
          }

          // Load and render template
          const templateHtml = await loadTemplate(templateName);
          const entityIds = extractEntityIds(templateHtml);
          const calendarIds = extractCalendarIds(templateHtml);

          // Fetch entity states and calendar events in parallel
          const [entities, calendars] = await Promise.all([
            getMultipleStates(entityIds),
            calendarIds.length > 0
              ? getMultipleCalendars(calendarIds)
              : Promise.resolve({} as Record<string, CalendarEvent[]>),
          ]);

          html = renderTemplate(templateHtml, entities, calendars);

          // Cache it for future requests
          renderedCache.set(cacheKey, html, 300, {
            templateName,
            entitiesFetched: entityIds.length,
          });
        }

        // Use setContent instead of goto
        await page.setContent(html, { waitUntil: "networkidle2", timeout: 10000 });
      } else {
        // URL mode: use existing goto logic
        const targetUrl = params.url!;
        await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 10000 });
      }

      let finalImage: Buffer | Uint8Array;

      if (format === "bmp") {
        // For BMP, take PNG screenshot and convert to 1-bit monochrome
        const pngScreenshot = await page.screenshot({
          type: "png",
          fullPage: false,
        });

        // Read PNG and apply monochrome conversion
        const image = await Jimp.read(Buffer.from(pngScreenshot));
        const { width, height, data } = image.bitmap;

        // Calculate row size with padding (each row must be multiple of 4 bytes)
        const bytesPerRow = Math.ceil(width / 8);
        const paddedBytesPerRow = Math.ceil(bytesPerRow / 4) * 4;
        const pixelDataSize = paddedBytesPerRow * height;

        // BMP file structure sizes
        const fileHeaderSize = 14;
        const infoHeaderSize = 40;
        const colorTableSize = 8; // 2 colors * 4 bytes each
        const pixelDataOffset = fileHeaderSize + infoHeaderSize + colorTableSize;
        const fileSize = pixelDataOffset + pixelDataSize;

        // Create buffer for entire BMP file
        const bmpBuffer = Buffer.alloc(fileSize);
        let offset = 0;

        // Write BMP File Header (14 bytes)
        bmpBuffer.write('BM', offset); offset += 2; // Signature
        bmpBuffer.writeUInt32LE(fileSize, offset); offset += 4; // File size
        bmpBuffer.writeUInt32LE(0, offset); offset += 4; // Reserved
        bmpBuffer.writeUInt32LE(pixelDataOffset, offset); offset += 4; // Pixel data offset

        // Write DIB Header (BITMAPINFOHEADER - 40 bytes)
        bmpBuffer.writeUInt32LE(infoHeaderSize, offset); offset += 4; // Header size
        bmpBuffer.writeInt32LE(width, offset); offset += 4; // Width
        bmpBuffer.writeInt32LE(-height, offset); offset += 4; // Height (negative = top-down)
        bmpBuffer.writeUInt16LE(1, offset); offset += 2; // Planes
        bmpBuffer.writeUInt16LE(1, offset); offset += 2; // Bits per pixel (1-bit)
        bmpBuffer.writeUInt32LE(0, offset); offset += 4; // Compression (none)
        bmpBuffer.writeUInt32LE(pixelDataSize, offset); offset += 4; // Image size
        bmpBuffer.writeInt32LE(2835, offset); offset += 4; // X pixels per meter
        bmpBuffer.writeInt32LE(2835, offset); offset += 4; // Y pixels per meter
        bmpBuffer.writeUInt32LE(2, offset); offset += 4; // Colors in palette
        bmpBuffer.writeUInt32LE(0, offset); offset += 4; // Important colors (0 = all)

        // Write Color Palette (2 colors, 4 bytes each: B G R reserved)
        bmpBuffer.writeUInt8(0, offset++);   // Black - Blue
        bmpBuffer.writeUInt8(0, offset++);   // Black - Green
        bmpBuffer.writeUInt8(0, offset++);   // Black - Red
        bmpBuffer.writeUInt8(0, offset++);   // Black - Reserved
        bmpBuffer.writeUInt8(255, offset++); // White - Blue
        bmpBuffer.writeUInt8(255, offset++); // White - Green
        bmpBuffer.writeUInt8(255, offset++); // White - Red
        bmpBuffer.writeUInt8(0, offset++);   // White - Reserved

        // Write pixel data (top-down, left-to-right)
        for (let y = 0; y < height; y++) {
          let bitIndex = 0;
          let currentByte = 0;

          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx] ?? 0;
            const g = data[idx + 1] ?? 0;
            const b = data[idx + 2] ?? 0;

            // Calculate luminance
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            // Apply threshold: 1 = white, 0 = black (for palette index)
            const bit = luminance >= threshold ? 1 : 0;

            // Pack bit into byte (MSB first)
            currentByte = (currentByte << 1) | bit;
            bitIndex++;

            // Write byte when we have 8 bits or at end of row
            if (bitIndex === 8) {
              bmpBuffer.writeUInt8(currentByte, offset++);
              currentByte = 0;
              bitIndex = 0;
            }
          }

          // Write remaining bits if row width is not multiple of 8
          if (bitIndex > 0) {
            currentByte <<= (8 - bitIndex); // Pad with zeros
            bmpBuffer.writeUInt8(currentByte, offset++);
          }

          // Add padding to make row size multiple of 4 bytes
          const padding = paddedBytesPerRow - bytesPerRow;
          for (let p = 0; p < padding; p++) {
            bmpBuffer.writeUInt8(0, offset++);
          }
        }

        finalImage = bmpBuffer;
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

      // Handle chunking if offset/limit parameters are provided
      const offset = parseInt(params.offset || "0");
      const limit = params.limit ? parseInt(params.limit) : undefined;
      const includeHeader = params.includeHeader === "true";

      let imageChunk: Buffer | Uint8Array = finalImage;

      if (offset > 0 || limit !== undefined) {
        const start = offset;
        const end = limit !== undefined ? Math.min(offset + limit, finalImage.length) : finalImage.length;
        imageChunk = finalImage.slice(start, end);

        // If includeHeader is true and we're using an offset, prepend the header bytes
        // This allows the image to be viewable in a browser even with offset-based downloads
        if (includeHeader && offset > 0) {
          const header = finalImage.slice(0, offset);
          imageChunk = Buffer.concat([header, imageChunk]);
        }
      }

      const contentTypeMap: Record<string, string> = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
        bmp: "image/bmp",
      };

      res.writeHead(200, {
        "Content-Type": contentTypeMap[format],
        "Content-Length": imageChunk.length.toString(),
      });
      res.end(imageChunk);
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
