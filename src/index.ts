import { createServer } from "./server.js";

const PORT = 3000;

const { server, browserManager } = createServer();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
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
