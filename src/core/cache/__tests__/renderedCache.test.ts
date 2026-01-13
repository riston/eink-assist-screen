import { describe, it, expect, beforeEach, vi } from "vitest";
import { set, get, has, clear, getStats, setMaxSize, keys } from "../index.js";

describe("renderedCache", () => {
  beforeEach(() => {
    clear();
    setMaxSize(50); // Reset to default
  });

  describe("set and get", () => {
    it("should store and retrieve cached HTML", () => {
      const html = "<html><body>Test</body></html>";
      set("test-key", html, 300, { templateName: "test.html", entitiesFetched: 2 });

      const result = get("test-key");

      expect(result).toBe(html);
    });

    it("should return null for non-existent key", () => {
      const result = get("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null for expired entry", () => {
      vi.useFakeTimers();

      const html = "<html><body>Test</body></html>";
      set("test-key", html, 5, { templateName: "test.html", entitiesFetched: 1 });

      // Fast forward 6 seconds (beyond TTL)
      vi.advanceTimersByTime(6000);

      const result = get("test-key");

      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it("should not return null for entry within TTL", () => {
      vi.useFakeTimers();

      const html = "<html><body>Test</body></html>";
      set("test-key", html, 10, { templateName: "test.html", entitiesFetched: 1 });

      // Fast forward 5 seconds (within TTL)
      vi.advanceTimersByTime(5000);

      const result = get("test-key");

      expect(result).toBe(html);

      vi.useRealTimers();
    });

    it("should delete expired entry when accessed", () => {
      vi.useFakeTimers();

      set("test-key", "<html></html>", 5, { templateName: "test.html", entitiesFetched: 1 });

      vi.advanceTimersByTime(6000);

      get("test-key"); // Should delete

      const stats = getStats();
      expect(stats.size).toBe(0);

      vi.useRealTimers();
    });
  });

  describe("has", () => {
    it("should return true for existing non-expired key", () => {
      set("test-key", "<html></html>", 300, { templateName: "test.html", entitiesFetched: 1 });

      expect(has("test-key")).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(has("nonexistent")).toBe(false);
    });

    it("should return false for expired key", () => {
      vi.useFakeTimers();

      set("test-key", "<html></html>", 5, { templateName: "test.html", entitiesFetched: 1 });

      vi.advanceTimersByTime(6000);

      expect(has("test-key")).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      set("key1", "<html>1</html>", 300, { templateName: "test1.html", entitiesFetched: 1 });
      set("key2", "<html>2</html>", 300, { templateName: "test2.html", entitiesFetched: 2 });

      clear();

      expect(get("key1")).toBeNull();
      expect(get("key2")).toBeNull();
      expect(getStats().size).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", () => {
      set("key1", "<html>1</html>", 300, { templateName: "test1.html", entitiesFetched: 1 });
      set("key2", "<html>2</html>", 600, { templateName: "test2.html", entitiesFetched: 3 });

      const stats = getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(50);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toHaveProperty("key");
      expect(stats.entries[0]).toHaveProperty("templateName");
      expect(stats.entries[0]).toHaveProperty("age");
      expect(stats.entries[0]).toHaveProperty("size");
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when cache is full", () => {
      vi.useFakeTimers();

      setMaxSize(3);

      // Add 3 entries
      set("key1", "<html>1</html>", 300, { templateName: "test1.html", entitiesFetched: 1 });
      vi.advanceTimersByTime(1000);

      set("key2", "<html>2</html>", 300, { templateName: "test2.html", entitiesFetched: 1 });
      vi.advanceTimersByTime(1000);

      set("key3", "<html>3</html>", 300, { templateName: "test3.html", entitiesFetched: 1 });
      vi.advanceTimersByTime(1000);

      // Access key1 to update its lastAccessed time
      get("key1");
      vi.advanceTimersByTime(1000);

      // Access key3
      get("key3");
      vi.advanceTimersByTime(1000);

      // Add 4th entry - should evict key2 (least recently accessed)
      set("key4", "<html>4</html>", 300, { templateName: "test4.html", entitiesFetched: 1 });

      expect(has("key2")).toBe(false); // key2 should be evicted
      expect(has("key1")).toBe(true);
      expect(has("key3")).toBe(true);
      expect(has("key4")).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("setMaxSize", () => {
    it("should update max size", () => {
      setMaxSize(10);

      const stats = getStats();
      expect(stats.maxSize).toBe(10);
    });

    it("should evict entries when reducing max size", () => {
      vi.useFakeTimers();

      setMaxSize(5);

      // Add 5 entries
      for (let i = 1; i <= 5; i++) {
        set(`key${i}`, `<html>${i}</html>`, 300, {
          templateName: `test${i}.html`,
          entitiesFetched: 1,
        });
        vi.advanceTimersByTime(100);
      }

      expect(getStats().size).toBe(5);

      // Reduce max size to 3
      setMaxSize(3);

      expect(getStats().size).toBe(3);

      vi.useRealTimers();
    });
  });

  describe("keys", () => {
    it("should return all cache keys", () => {
      set("key1", "<html>1</html>", 300, { templateName: "test1.html", entitiesFetched: 1 });
      set("key2", "<html>2</html>", 300, { templateName: "test2.html", entitiesFetched: 2 });

      const allKeys = keys();

      expect(allKeys).toContain("key1");
      expect(allKeys).toContain("key2");
      expect(allKeys).toHaveLength(2);
    });
  });
});
