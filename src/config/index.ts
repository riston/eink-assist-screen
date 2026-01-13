/**
 * Configuration module barrel export
 */

// Side-effect import: Load environment variables
import "./env.js";

// Export config functions and types
export { loadConfig, getConfig, clearConfig } from "./config.js";
export type { HAConfig } from "./config.js";
