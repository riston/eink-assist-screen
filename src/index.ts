import { createServer } from "./server/index.js";
import { loadConfig } from "./config/index.js";
import { getTemplatesDir, listTemplates } from "./templates/index.js";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BASE_HOST, BASE_PORT } from "./core/constants.js";

// Initialize Home Assistant integration
async function initializeHA() {
  try {
    // Load configuration
    const config = await loadConfig();
    console.log("✓ Home Assistant configuration loaded");
    console.log(`  URL: ${config.homeAssistantUrl}`);
    console.log(`  Cache TTL: ${config.cacheTtlDefault}s`);
    console.log(`  Cache Max Size: ${config.cacheMaxSize}`);

    // Create templates directory if it doesn't exist
    const templatesDir = getTemplatesDir();
    if (!existsSync(templatesDir)) {
      await mkdir(templatesDir, { recursive: true });
      console.log(`✓ Created templates directory: ${templatesDir}`);
    }

    // List available templates
    const templates = await listTemplates();
    if (templates.length > 0) {
      console.log(`✓ Found ${templates.length} template(s):`);
      templates.forEach((t) => console.log(`  - ${t}`));
    } else {
      console.log(`  No templates found in ${templatesDir}`);
      console.log(`  Create .html template files to get started`);
    }
  } catch (error) {
    console.warn("⚠ Home Assistant integration not configured:");
    console.warn(`  ${(error as Error).message}`);
    console.warn("  Template rendering features will be unavailable");
  }
}

// Initialize
await initializeHA();

const { server, browserManager } = createServer();

server.listen(BASE_PORT, () => {
  console.log(`Server running at http://localhost:${BASE_PORT}/`);
});

// Graceful shutdown handling
const shutdown = async () => {
  console.log("Shutdown signal received, shutting down gracefully...");
  await browserManager.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
