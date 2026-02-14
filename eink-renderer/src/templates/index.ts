/**
 * Template module barrel export
 */

export {
  loadTemplate,
  templateExists,
  listTemplates,
  getTemplatesDir,
} from "./storage.js";
export { extractEntityIds, extractCalendarIds, renderTemplate } from "./engine.js";
