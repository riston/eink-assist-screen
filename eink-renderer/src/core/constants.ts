/**
 * Application-wide constants
 */

/** Base host for server binding and config generation */
export const BASE_HOST = process.env.BASE_HOST || "localhost";

/** Base port for server binding */
export const BASE_PORT = parseInt(process.env.BASE_PORT || "8000", 10);

/** Active template ID used in config endpoint */
export const ACTIVE_TEMPLATE_ID = process.env.ACTIVE_TEMPLATE || "dashboard-full.html";

/** WebSocket endpoint for remote browser (e.g. browserless). Empty = use local Chromium */
export const BROWSER_WS_ENDPOINT = process.env.BROWSER_WS_ENDPOINT || "";
