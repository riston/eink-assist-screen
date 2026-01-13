import http from "http";
import { URL } from "url";

import { createBrowserManager, createImageRequestHandler } from "../rendering/index.js";
import { BASE_HOST, BASE_PORT, ACTIVE_TEMPLATE_ID } from "../core/constants.js";
import { handleRender } from "../integrations/homeassistant/index.js";

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
                // url: "data:text/html,<h1>hello</h1><b>dsadsa</b>",
                // url: `http://${BASE_HOST}:${BASE_PORT}/dashboard`,
                template: ACTIVE_TEMPLATE_ID,
                offset: 0,
                limit: undefined,
                includeHeader: false,
              },
              base_url: `http://${BASE_HOST}:${BASE_PORT}`,
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
      } else if (url.pathname === "/dashboard") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>E-Ink Renderer — Atelier</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --color-ink: #1a1614;
        --color-paper: #faf8f5;
        --color-accent: #d4a574;
        --color-accent-dark: #b8864d;
        --color-muted: #6b6562;
        --color-border: #e5e1dc;
        --color-success: #4a7c59;
        --color-error: #c14747;

        --font-display: 'Cormorant Garamond', serif;
        --font-mono: 'JetBrains Mono', monospace;

        --ease-smooth: cubic-bezier(0.4, 0.0, 0.2, 1);
        --shadow-subtle: 0 1px 3px rgba(26, 22, 20, 0.08);
        --shadow-elevated: 0 4px 12px rgba(26, 22, 20, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        font-family: var(--font-mono);
        font-size: 13px;
        background: var(--color-paper);
        color: var(--color-ink);
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }

      /* Decorative background texture */
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image:
          radial-gradient(circle at 20% 30%, rgba(212, 165, 116, 0.03) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(212, 165, 116, 0.04) 0%, transparent 50%);
        pointer-events: none;
        z-index: 0;
      }

      .app {
        display: grid;
        grid-template-columns: 280px 1fr;
        min-height: 100vh;
        position: relative;
        z-index: 1;
      }

      /* Sidebar */
      .sidebar {
        background: var(--color-ink);
        color: var(--color-paper);
        padding: 48px 32px;
        position: relative;
        overflow: hidden;
      }

      .sidebar::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 1px;
        height: 100%;
        background: linear-gradient(180deg,
          rgba(212, 165, 116, 0.3) 0%,
          rgba(212, 165, 116, 0.1) 50%,
          rgba(212, 165, 116, 0.3) 100%);
      }

      .logo {
        margin: 0 0 56px 0;
      }

      .logo h1 {
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 400;
        margin: 0 0 4px 0;
        letter-spacing: 0.02em;
        color: var(--color-accent);
      }

      .logo p {
        font-size: 11px;
        margin: 0;
        color: var(--color-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .nav {
        list-style: none;
        padding: 0;
        margin: 0 0 48px 0;
      }

      .nav li {
        margin: 0 0 8px 0;
      }

      .nav a {
        display: block;
        padding: 12px 16px;
        color: var(--color-paper);
        text-decoration: none;
        border-radius: 4px;
        transition: all 0.2s var(--ease-smooth);
        font-size: 13px;
        position: relative;
      }

      .nav a::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 0;
        background: var(--color-accent);
        transition: height 0.2s var(--ease-smooth);
      }

      .nav a:hover, .nav a.active {
        background: rgba(212, 165, 116, 0.1);
        padding-left: 24px;
      }

      .nav a:hover::before, .nav a.active::before {
        height: 100%;
      }

      .status-indicator {
        padding: 24px 16px;
        border-top: 1px solid rgba(212, 165, 116, 0.2);
        margin-top: auto;
      }

      .status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 11px;
      }

      .status-row:last-child {
        margin-bottom: 0;
      }

      .status-label {
        color: var(--color-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .status-value {
        color: var(--color-paper);
        font-weight: 500;
      }

      .pulse {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-success);
        margin-right: 8px;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.95); }
      }

      /* Main Content */
      .main {
        padding: 48px 64px;
        max-width: 1400px;
      }

      .header {
        margin-bottom: 48px;
        animation: fadeInDown 0.6s var(--ease-smooth);
      }

      @keyframes fadeInDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .header h2 {
        font-family: var(--font-display);
        font-size: 48px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--color-ink);
        letter-spacing: -0.02em;
      }

      .header p {
        color: var(--color-muted);
        margin: 0;
        font-size: 14px;
      }

      /* Stats Grid */
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 24px;
        margin-bottom: 48px;
      }

      .stat-card {
        background: white;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        box-shadow: var(--shadow-subtle);
        transition: all 0.3s var(--ease-smooth);
        animation: fadeInUp 0.6s var(--ease-smooth) backwards;
      }

      .stat-card:nth-child(1) { animation-delay: 0.1s; }
      .stat-card:nth-child(2) { animation-delay: 0.15s; }
      .stat-card:nth-child(3) { animation-delay: 0.2s; }
      .stat-card:nth-child(4) { animation-delay: 0.25s; }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-elevated);
        border-color: var(--color-accent);
      }

      .stat-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-muted);
        margin-bottom: 8px;
      }

      .stat-value {
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 600;
        color: var(--color-ink);
        margin-bottom: 4px;
      }

      .stat-meta {
        font-size: 12px;
        color: var(--color-muted);
      }

      /* Section */
      .section {
        margin-bottom: 48px;
        animation: fadeIn 0.8s var(--ease-smooth) 0.3s backwards;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }

      .section-title {
        font-family: var(--font-display);
        font-size: 28px;
        font-weight: 600;
        margin: 0;
        color: var(--color-ink);
      }

      .btn {
        padding: 10px 20px;
        background: var(--color-ink);
        color: var(--color-paper);
        border: none;
        border-radius: 4px;
        font-family: var(--font-mono);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s var(--ease-smooth);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .btn:hover {
        background: var(--color-accent-dark);
        transform: translateY(-1px);
        box-shadow: var(--shadow-elevated);
      }

      .btn-secondary {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-ink);
      }

      .btn-secondary:hover {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: white;
      }

      /* Preview Card */
      .preview-card {
        background: white;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        overflow: hidden;
        box-shadow: var(--shadow-subtle);
      }

      .preview-header {
        padding: 24px;
        border-bottom: 1px solid var(--color-border);
        background: linear-gradient(135deg, var(--color-ink) 0%, #2a2522 100%);
        color: var(--color-paper);
      }

      .preview-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
      }

      .preview-meta {
        font-size: 12px;
        color: var(--color-muted);
      }

      .preview-body {
        padding: 32px;
        display: flex;
        gap: 32px;
        align-items: flex-start;
      }

      .preview-image {
        flex: 0 0 400px;
        height: 240px;
        background: var(--color-paper);
        border: 2px solid var(--color-border);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
      }

      .preview-image::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image:
          linear-gradient(45deg, var(--color-border) 25%, transparent 25%),
          linear-gradient(-45deg, var(--color-border) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, var(--color-border) 75%),
          linear-gradient(-45deg, transparent 75%, var(--color-border) 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        opacity: 0.3;
      }

      .preview-placeholder {
        position: relative;
        z-index: 1;
        text-align: center;
        color: var(--color-muted);
      }

      .preview-details {
        flex: 1;
      }

      .detail-row {
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-border);
      }

      .detail-row:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .detail-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-muted);
        margin-bottom: 4px;
      }

      .detail-value {
        font-size: 14px;
        color: var(--color-ink);
        font-weight: 500;
      }

      /* Renders Table */
      .table-container {
        background: white;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        overflow: hidden;
        box-shadow: var(--shadow-subtle);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead {
        background: var(--color-ink);
        color: var(--color-paper);
      }

      th {
        padding: 16px 20px;
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }

      tbody tr {
        border-bottom: 1px solid var(--color-border);
        transition: background 0.2s var(--ease-smooth);
      }

      tbody tr:hover {
        background: rgba(212, 165, 116, 0.05);
      }

      tbody tr:last-child {
        border-bottom: none;
      }

      td {
        padding: 16px 20px;
        font-size: 13px;
      }

      .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .badge-success {
        background: rgba(74, 124, 89, 0.1);
        color: var(--color-success);
      }

      .badge-error {
        background: rgba(193, 71, 71, 0.1);
        color: var(--color-error);
      }

      .badge-pending {
        background: rgba(212, 165, 116, 0.1);
        color: var(--color-accent-dark);
      }

      /* Responsive */
      @media (max-width: 1024px) {
        .app {
          grid-template-columns: 1fr;
        }

        .sidebar {
          padding: 32px 24px;
        }

        .main {
          padding: 32px 24px;
        }

        .preview-body {
          flex-direction: column;
        }

        .preview-image {
          flex: 1 1 auto;
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="logo">
          <h1>Atelier</h1>
          <p>E-Ink Renderer</p>
        </div>

        <nav>
          <ul class="nav">
            <li><a href="#" class="active">Dashboard</a></li>
            <li><a href="#">Templates</a></li>
            <li><a href="#">Entities</a></li>
            <li><a href="#">Configuration</a></li>
            <li><a href="#">History</a></li>
          </ul>
        </nav>

        <div class="status-indicator">
          <div class="status-row">
            <span class="status-label">Status</span>
            <span class="status-value"><span class="pulse"></span>Active</span>
          </div>
          <div class="status-row">
            <span class="status-label">Uptime</span>
            <span class="status-value" id="uptime">—</span>
          </div>
          <div class="status-row">
            <span class="status-label">Version</span>
            <span class="status-value">1.0.0</span>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main">
        <header class="header">
          <h2>Dashboard</h2>
          <p>Monitor rendering performance and manage templates</p>
        </header>

        <!-- Stats -->
        <div class="stats">
          <div class="stat-card">
            <div class="stat-label">Display Size</div>
            <div class="stat-value" id="display-size">800 × 480</div>
            <div class="stat-meta">pixels</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Refresh Rate</div>
            <div class="stat-value" id="refresh-rate">300</div>
            <div class="stat-meta">seconds</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Last Render</div>
            <div class="stat-value" id="last-render">—</div>
            <div class="stat-meta">time ago</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Total Renders</div>
            <div class="stat-value" id="total-renders">142</div>
            <div class="stat-meta">since start</div>
          </div>
        </div>

        <!-- Preview Section -->
        <section class="section">
          <div class="section-header">
            <h3 class="section-title">Current Preview</h3>
            <button class="btn" onclick="triggerRender()">Render Now</button>
          </div>

          <div class="preview-card">
            <div class="preview-header">
              <div class="preview-title">Latest Render</div>
              <div class="preview-meta">Generated at <span id="preview-time">—</span></div>
            </div>
            <div class="preview-body">
              <div class="preview-image">
                <div class="preview-placeholder">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  <p style="margin: 8px 0 0 0; font-size: 12px;">No preview available</p>
                </div>
              </div>
              <div class="preview-details">
                <div class="detail-row">
                  <div class="detail-label">Format</div>
                  <div class="detail-value">BMP (1-bit monochrome)</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Quality</div>
                  <div class="detail-value">80</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Threshold</div>
                  <div class="detail-value">128</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Source</div>
                  <div class="detail-value" style="word-break: break-all; font-family: var(--font-mono); font-size: 12px;">
                    data:text/html,&lt;h1&gt;hello&lt;/h1&gt;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Recent Renders -->
        <section class="section">
          <div class="section-header">
            <h3 class="section-title">Recent Renders</h3>
            <button class="btn btn-secondary">View All</button>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Template</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody id="renders-table">
                <tr>
                  <td>#142</td>
                  <td>2026-01-12 14:32:15</td>
                  <td><span class="badge badge-success">Success</span></td>
                  <td>home_dashboard.hbs</td>
                  <td>1.2s</td>
                </tr>
                <tr>
                  <td>#141</td>
                  <td>2026-01-12 14:27:03</td>
                  <td><span class="badge badge-success">Success</span></td>
                  <td>weather_widget.hbs</td>
                  <td>0.8s</td>
                </tr>
                <tr>
                  <td>#140</td>
                  <td>2026-01-12 14:21:47</td>
                  <td><span class="badge badge-pending">Queued</span></td>
                  <td>calendar_view.hbs</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>#139</td>
                  <td>2026-01-12 14:16:22</td>
                  <td><span class="badge badge-success">Success</span></td>
                  <td>home_dashboard.hbs</td>
                  <td>1.1s</td>
                </tr>
                <tr>
                  <td>#138</td>
                  <td>2026-01-12 14:11:08</td>
                  <td><span class="badge badge-error">Failed</span></td>
                  <td>custom_template.hbs</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>

    <script>
      // Simple uptime counter
      const startTime = Date.now();
      function updateUptime() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        document.getElementById('uptime').textContent =
          \`\${hours}h \${minutes}m \${seconds}s\`;
      }
      setInterval(updateUptime, 1000);
      updateUptime();

      // Load config data
      fetch('/config')
        .then(r => r.json())
        .then(data => {
          document.getElementById('display-size').textContent =
            \`\${data.display.width} × \${data.display.height}\`;
          document.getElementById('refresh-rate').textContent =
            data.display.refresh_interval_sec;
        })
        .catch(err => console.error('Failed to load config:', err));

      // Update timestamp
      function updateTimestamp() {
        const now = new Date();
        document.getElementById('preview-time').textContent =
          now.toLocaleString();
        document.getElementById('last-render').textContent =
          now.toLocaleTimeString();
      }
      updateTimestamp();

      // Render trigger
      function triggerRender() {
        alert('Render functionality would trigger /ha/render endpoint');
      }
    </script>
  </body>
</html>`);
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
