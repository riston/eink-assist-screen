/**
 * Template module barrel export
 */

export {
  loadTemplate,
  templateExists,
  listTemplates,
  getTemplatesDir,
} from "./storage.js";
export { extractEntityIds, renderTemplate } from "./engine.js";
