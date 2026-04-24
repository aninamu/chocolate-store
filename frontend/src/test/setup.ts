import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

/** jsdom/Node may expose a partial `localStorage`; replace with a full in-memory impl. */
function createLocalStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  } as Storage;
}

Object.defineProperty(globalThis, "localStorage", {
  value: createLocalStorage(),
  configurable: true,
  writable: true,
});

const origFetch = globalThis.fetch?.bind(globalThis);

/** Default fetch: stub debug ingest; delegate other URLs to the original fetch when present. */
function installFetchStub(): void {
  globalThis.fetch = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const u =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (u.includes("7350/ingest")) {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      if (origFetch) return origFetch(input as RequestInfo, init);
      return Promise.resolve(new Response("{}", { status: 200 }));
    }
  ) as typeof fetch;
}

installFetchStub();

afterEach(() => {
  vi.clearAllMocks();
  installFetchStub();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
