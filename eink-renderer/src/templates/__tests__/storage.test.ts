import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadTemplate,
  listTemplates,
  templateExists,
  getTemplatesDir,
} from "../index.js";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// Mock fs modules
vi.mock("node:fs/promises");
vi.mock("node:fs");

describe("templateStorage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("loadTemplate", () => {
    it("should load template successfully", async () => {
      const mockHtml = "<html><body>Test Template</body></html>";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(mockHtml);

      const content = await loadTemplate("dashboard.html");

      expect(content).toBe(mockHtml);
      expect(readFile).toHaveBeenCalled();
    });

    it("should throw error if template not found", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(loadTemplate("nonexistent.html")).rejects.toThrow(
        /Template not found: nonexistent.html/
      );
    });

    it("should prevent path traversal with ..", async () => {
      await expect(loadTemplate("../etc/passwd")).rejects.toThrow(
        /Invalid template path.*Path traversal not allowed/
      );
    });

    it("should prevent path traversal with absolute paths", async () => {
      await expect(loadTemplate("/etc/passwd")).rejects.toThrow(
        /Invalid template path.*Path traversal not allowed/
      );
    });

    it("should allow templates in subdirectories (legitimate)", async () => {
      const mockHtml = "<html><body>Sub Template</body></html>";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(mockHtml);

      const content = await loadTemplate("widgets/weather.html");

      expect(content).toBe(mockHtml);
    });

    it("should throw error on read failure", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error("Permission denied"));

      await expect(loadTemplate("dashboard.html")).rejects.toThrow(
        /Failed to read template.*Permission denied/
      );
    });
  });

  describe("listTemplates", () => {
    it("should list all HTML templates", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue(
        ["dashboard.html", "weather.html", "readme.txt", "style.css"] as any
      );

      const templates = await listTemplates();

      expect(templates).toEqual(["dashboard.html", "weather.html"]);
    });

    it("should return empty array if templates directory doesn't exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const templates = await listTemplates();

      expect(templates).toEqual([]);
      expect(readdir).not.toHaveBeenCalled();
    });

    it("should handle readdir errors gracefully", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockRejectedValue(new Error("Permission denied"));

      const templates = await listTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe("templateExists", () => {
    it("should return true for existing template", () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const exists = templateExists("dashboard.html");

      expect(exists).toBe(true);
    });

    it("should return false for non-existing template", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const exists = templateExists("nonexistent.html");

      expect(exists).toBe(false);
    });

    it("should return false for path traversal attempts", () => {
      const exists = templateExists("../etc/passwd");

      expect(exists).toBe(false);
      expect(existsSync).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", () => {
      vi.mocked(existsSync).mockImplementation(() => {
        throw new Error("Filesystem error");
      });

      const exists = templateExists("dashboard.html");

      expect(exists).toBe(false);
    });
  });

  describe("getTemplatesDir", () => {
    it("should return absolute path to templates directory", () => {
      const dir = getTemplatesDir();

      expect(dir).toContain("templates");
      expect(dir).toMatch(/^\/|^[A-Z]:\\/); // Unix or Windows absolute path
    });
  });
});
