import { IncomingMessage, ServerResponse } from "node:http";
import { loadTemplate, templateExists, listTemplates } from "../../templates/index.js";
import { extractEntityIds, renderTemplate } from "../../templates/index.js";
import { getMultipleStates } from "./client.js";
import * as renderedCache from "../../core/cache/index.js";
import { getConfig } from "../../config/index.js";

interface RenderResult {
  success: true;
  template: string;
  entities_fetched: number;
  html_length: number;
  cached_at: string;
  cache_key: string;
}

interface ErrorResult {
  error: string;
  message: string;
  details?: any;
}

/**
 * Handle /ha/render requests
 * Orchestrates: load template → extract entities → fetch HA data → render → cache
 */
export async function handleRender(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Validate template parameter
    const templateName = params.template;
    if (!templateName) {
      sendError(res, 400, "missing_parameter", "Missing required parameter: template", {
        required: ["template"],
        optional: ["cache_ttl", "force_refresh"],
      });
      return;
    }

    // Check if template exists
    if (!templateExists(templateName)) {
      const availableTemplates = await listTemplates();
      sendError(res, 404, "template_not_found", `Template not found: ${templateName}`, {
        available_templates: availableTemplates,
      });
      return;
    }

    // Parse optional parameters
    const config = getConfig();
    const cacheTtl = params.cache_ttl
      ? parseInt(params.cache_ttl, 10)
      : config.cacheTtlDefault;
    const forceRefresh = params.force_refresh === "true";

    // Generate cache key
    const cacheKey = `ha:${templateName}`;

    // Check cache (unless force refresh)
    if (!forceRefresh && renderedCache.has(cacheKey)) {
      const cachedHtml = renderedCache.get(cacheKey);
      if (cachedHtml) {
        const result: RenderResult = {
          success: true,
          template: templateName,
          entities_fetched: 0, // From cache
          html_length: cachedHtml.length,
          cached_at: new Date().toISOString(),
          cache_key: cacheKey,
        };

        sendJson(res, 200, result);
        return;
      }
    }

    // Load template from disk
    const templateHtml = await loadTemplate(templateName);

    // Extract entity IDs from template
    const entityIds = extractEntityIds(templateHtml);

    // Fetch entity states from Home Assistant
    const entities = await getMultipleStates(entityIds);

    // Check for missing entities
    const missingEntities = Object.entries(entities)
      .filter(([_, state]) => state === null)
      .map(([id, _]) => id);

    if (missingEntities.length > 0) {
      console.warn(`Warning: Missing entities in Home Assistant: ${missingEntities.join(", ")}`);
    }

    // Render template with entity data
    const renderedHtml = renderTemplate(templateHtml, entities);

    // Store in cache
    renderedCache.set(cacheKey, renderedHtml, cacheTtl, {
      templateName,
      entitiesFetched: entityIds.length,
    });

    // Send response
    const result: RenderResult = {
      success: true,
      template: templateName,
      entities_fetched: entityIds.length,
      html_length: renderedHtml.length,
      cached_at: new Date().toISOString(),
      cache_key: cacheKey,
    };

    sendJson(res, 200, result);
  } catch (error) {
    console.error("Error in /ha/render handler:", error);

    const err = error as any;

    // Categorize errors
    if (err.message?.includes("Home Assistant is unreachable")) {
      sendError(res, 503, "ha_unreachable", err.message);
    } else if (err.message?.includes("Invalid Home Assistant access token")) {
      sendError(res, 401, "ha_auth_failed", err.message, {
        hint: "Check access_token in addon configuration",
      });
    } else if (err.message?.includes("Template rendering failed")) {
      sendError(res, 500, "template_render_error", err.message);
    } else if (err.message?.includes("Failed to read template")) {
      sendError(res, 500, "template_read_error", err.message);
    } else {
      sendError(res, 500, "internal_error", `Unexpected error: ${err.message}`);
    }
  }
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 */
function sendError(
  res: ServerResponse,
  statusCode: number,
  error: string,
  message: string,
  details?: any
): void {
  const errorResponse: ErrorResult = {
    error,
    message,
    ...(details && { details }),
  };

  sendJson(res, statusCode, errorResponse);
}
