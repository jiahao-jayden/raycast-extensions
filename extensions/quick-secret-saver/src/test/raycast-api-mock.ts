// src/test/raycast-api-mock.ts
//
// In-memory stand-in for @raycast/api, used only in tests. The real package
// ships TypeScript types plus a CLI but no runnable JS entry (the API is
// injected by Raycast at runtime), so Vitest cannot resolve the bare specifier.
// vitest.config.ts aliases "@raycast/api" to this file.
//
// `backing` is the storage map; tests clear it between cases to isolate state.

export const backing = new Map<string, string>();

export const LocalStorage = {
  async getItem(key: string): Promise<string | undefined> {
    return backing.get(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    backing.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    backing.delete(key);
  },
  async clear(): Promise<void> {
    backing.clear();
  },
  async allItems(): Promise<Record<string, string>> {
    return Object.fromEntries(backing);
  },
};
