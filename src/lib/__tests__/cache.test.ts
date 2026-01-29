/**
 * Basic cache tests
 * Run with: npm test or jest
 */

import { getFrontendCache, getBackendCache, cacheKeys } from "../cache";

// Mock localStorage for frontend tests
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe("Cache Module", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe("Cache Keys", () => {
    it("should generate scan result cache key", () => {
      const key = cacheKeys.scanResult("mint123", "mainnet");
      expect(key).toBe("scan:mainnet:mint123");
    });

    it("should generate token metadata cache key", () => {
      const key = cacheKeys.tokenMetadata("mint456", "devnet");
      expect(key).toBe("token:devnet:mint456");
    });

    it("should generate Helius DAS cache key", () => {
      const key = cacheKeys.heliusDas("asset789");
      expect(key).toBe("helius:das:asset789");
    });
  });

  describe("Backend Cache", () => {
    it("should set and get values", () => {
      const cache = getBackendCache({ keyPrefix: "test_", ttlMs: 1000 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return null for non-existent keys", () => {
      const cache = getBackendCache({ keyPrefix: "test_", ttlMs: 1000 });
      expect(cache.get("nonexistent")).toBeNull();
    });

    it("should expire entries after TTL", (done) => {
      const cache = getBackendCache({ keyPrefix: "test_", ttlMs: 100 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
      
      setTimeout(() => {
        expect(cache.get("key1")).toBeNull();
        done();
      }, 150);
    });

    it("should check if key exists", () => {
      const cache = getBackendCache({ keyPrefix: "test_", ttlMs: 1000 });
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });

    it("should delete entries", () => {
      const cache = getBackendCache({ keyPrefix: "test_", ttlMs: 1000 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
      cache.delete("key1");
      expect(cache.get("key1")).toBeNull();
    });

    it("should clear all entries", () => {
      const cache = getBackendCache({ keyPrefix: "test_", ttlMs: 1000 });
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
    });
  });

  describe("Frontend Cache (with mock)", () => {
    beforeEach(() => {
      // @ts-ignore
      global.window = {
        localStorage: mockLocalStorage,
      };
    });

    afterEach(() => {
      // @ts-ignore
      delete global.window;
    });

    it("should set and get values", () => {
      const cache = getFrontendCache({ keyPrefix: "test_", ttlMs: 1000 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return null for non-existent keys", () => {
      const cache = getFrontendCache({ keyPrefix: "test_", ttlMs: 1000 });
      expect(cache.get("nonexistent")).toBeNull();
    });

    it("should expire entries after TTL", (done) => {
      const cache = getFrontendCache({ keyPrefix: "test_", ttlMs: 100 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
      
      setTimeout(() => {
        expect(cache.get("key1")).toBeNull();
        done();
      }, 150);
    });
  });
});
