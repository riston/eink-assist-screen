import http from "http";
import { URL } from "url";

import { createBrowserManager, createImageRequestHandler } from "../rendering/index.js";
import { ACTIVE_TEMPLATE_ID } from "../core/constants.js";
import { handleRender, handleEntities } from "../integrations/homeassistant/index.js";

export function createServer() {
  const browserManager = createBrowserManager();
  const handleImageRequest = createImageRequestHandler(browserManager);

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const params = Object.fromEntries(url.searchParams.entries());

      if (url.pathname === "/config") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            image: {
              path: "/image",
              parameters: {
                format: "bmp",
                quality: 80,
                threshold: 128,
                template: ACTIVE_TEMPLATE_ID,
                offset: 0,
                limit: undefined,
                includeHeader: false,
              },
              base_url: `http://${req.headers.host}`,
            },
            display: {
              width: 800,
              height: 480,
              refresh_interval_sec: 300,
            },
          })
        );
      } else if (url.pathname === "/image") {
        handleImageRequest(url, params, res).catch((error: unknown) => {
          console.error("Unhandled error in image handler:", error);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      } else if (url.pathname === "/ha/render") {
        handleRender(req, res).catch((error: unknown) => {
          console.error("Unhandled error in /ha/render handler:", error);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      } else if (url.pathname === "/ha/entities") {
        handleEntities(req, res).catch((error: unknown) => {
          console.error("Unhandled error in /ha/entities handler:", error);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "GET request received",
            parameters: params,
            path: url.pathname,
          })
        );
      }
    } else {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
    }
  });

  return { server, browserManager };
}
