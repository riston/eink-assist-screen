/**
 * Mock Home Assistant Server Entry Point
 *
 * A standalone development server that mimics the Home Assistant REST API.
 * Use this when you don't have access to a real Home Assistant instance.
 *
 * Usage:
 *   npm run mock-server
 *
 * Then configure the main app:
 *   HA_URL=http://localhost:8124 HA_ACCESS_TOKEN=mock-token npm start
 */

import { createMockServer } from "./server.js";

const MOCK_PORT = parseInt(process.env.MOCK_HA_PORT || "8124", 10);

const server = createMockServer();

server.listen(MOCK_PORT, () => {
  console.log("");
  console.log("=".repeat(60));
  console.log("  Mock Home Assistant Server");
  console.log("=".repeat(60));
  console.log("");
  console.log(`  Server running at: http://localhost:${MOCK_PORT}/`);
  console.log("");
  console.log("  Endpoints:");
  console.log(`    GET /api/states/{entity_id}`);
  console.log(`    GET /api/calendars/{entity_id}?start=&end=`);
  console.log(`    GET /api  (list all entities)`);
  console.log("");
  console.log("  To use with the main app, set environment variables:");
  console.log(`    HA_URL=http://localhost:${MOCK_PORT}`);
  console.log(`    HA_ACCESS_TOKEN=mock-token`);
  console.log("");
  console.log("=".repeat(60));
  console.log("");
});
