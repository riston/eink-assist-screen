/**
 * Mock Home Assistant HTTP server
 * Implements the REST API endpoints used by the app
 */

import http from "node:http";
import { URL } from "node:url";
import { handleStates } from "./handlers/states.js";
import { handleCalendars } from "./handlers/calendars.js";
import { loadMockData, type MockData } from "./data/mock-loader.js";

export function createMockServer(): http.Server {
  // Load mock data on startup
  const mockData = loadMockData();

  return http.createServer((req, res) => {
    // CORS headers for development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Method not allowed" }));
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Route: GET /api/states/{entity_id}
    const statesMatch = url.pathname.match(/^\/api\/states\/(.+)$/);
    if (statesMatch && statesMatch[1]) {
      const entityId = decodeURIComponent(statesMatch[1]);
      handleStates(entityId, mockData, res);
      return;
    }

    // Route: GET /api/calendars/{entity_id}
    const calendarsMatch = url.pathname.match(/^\/api\/calendars\/(.+)$/);
    if (calendarsMatch && calendarsMatch[1]) {
      const entityId = decodeURIComponent(calendarsMatch[1]);
      const start = url.searchParams.get("start") || "";
      const end = url.searchParams.get("end") || "";
      handleCalendars(entityId, start, end, mockData, res);
      return;
    }

    // Root endpoint - show available entities
    if (url.pathname === "/" || url.pathname === "/api") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            message: "Mock Home Assistant API",
            entities: Object.keys(mockData.entities),
            calendars: Object.keys(mockData.calendars),
          },
          null,
          2
        )
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  });
}

export type { MockData };
