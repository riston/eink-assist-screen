import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, relative, sep, isAbsolute } from "node:path";

const TEMPLATES_DIR = "./templates";

/**
 * Load an HTML template from the templates directory
 * @param filename Template filename (e.g., "dashboard.html")
 * @returns Template HTML content
 * @throws Error if template not found or path traversal attempted
 */
export async function loadTemplate(filename: string): Promise<string> {
  // Security: prevent absolute paths and path traversal
  if (isAbsolute(filename)) {
    throw new Error(`Invalid template path: ${filename}. Path traversal not allowed.`);
  }

  if (filename.includes("..")) {
    throw new Error(`Invalid template path: ${filename}. Path traversal not allowed.`);
  }

  const templatesRoot = resolve(TEMPLATES_DIR);
  const templatePath = resolve(join(TEMPLATES_DIR, filename));

  // Double-check: ensure resolved path is still within templates directory
  const relativePath = relative(templatesRoot, templatePath);
  if (relativePath.startsWith("..") || !relativePath) {
    throw new Error(`Invalid template path: ${filename}. Path traversal not allowed.`);
  }

  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${filename}`);
  }

  try {
    const content = await readFile(templatePath, "utf-8");
    return content;
  } catch (error) {
    throw new Error(`Failed to read template ${filename}: ${(error as Error).message}`);
  }
}

/**
 * List all available templates in the templates directory
 * @returns Array of template filenames
 */
export async function listTemplates(): Promise<string[]> {
  const templatesRoot = resolve(TEMPLATES_DIR);

  if (!existsSync(templatesRoot)) {
    return [];
  }

  try {
    const files = await readdir(templatesRoot);
    // Only return .html files
    return files.filter((file) => file.endsWith(".html"));
  } catch (error) {
    console.warn("Failed to list templates:", error);
    return [];
  }
}

/**
 * Check if a template exists
 * @param filename Template filename
 * @returns True if template exists
 */
export function templateExists(filename: string): boolean {
  try {
    const templatePath = resolve(join(TEMPLATES_DIR, filename));
    const templatesRoot = resolve(TEMPLATES_DIR);
    const relativePath = relative(templatesRoot, templatePath);

    if (relativePath.startsWith("..")) {
      return false;
    }

    return existsSync(templatePath);
  } catch {
    return false;
  }
}

/**
 * Get the templates directory path
 * @returns Absolute path to templates directory
 */
export function getTemplatesDir(): string {
  return resolve(TEMPLATES_DIR);
}
