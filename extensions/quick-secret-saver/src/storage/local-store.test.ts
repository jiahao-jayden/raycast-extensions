// src/storage/local-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";

// @raycast/api is aliased to src/test/raycast-api-mock.ts (see vitest.config.ts),
// which backs LocalStorage with an in-memory Map. We import that map to reset
// state between tests.
import { backing } from "../test/raycast-api-mock";

import { LocalSecretStore } from "./local-store";
import { SECRETS_KEY } from "./types";
import { LocalStorage } from "@raycast/api";

describe("LocalSecretStore", () => {
  let store: LocalSecretStore;
  let now: number;
  let idCounter: number;

  beforeEach(() => {
    backing.clear();
    idCounter = 0;
    now = 1_000;
    // Inject deterministic clock + id generator (see LocalSecretStore ctor).
    store = new LocalSecretStore(
      () => now,
      () => `id-${++idCounter}`,
    );
  });

  it("save() creates a record with id and timestamps", async () => {
    const s = await store.save({ title: "Email", content: "pw123" });
    expect(s).toMatchObject({
      id: "id-1",
      title: "Email",
      content: "pw123",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("id-1");
  });

  it("list() returns records sorted by updatedAt descending", async () => {
    now = 1000;
    await store.save({ title: "A", content: "" });
    now = 2000;
    await store.save({ title: "B", content: "" });
    const all = await store.list();
    expect(all.map((s) => s.title)).toEqual(["B", "A"]);
  });

  it("get() returns a record by id, or undefined", async () => {
    const s = await store.save({ title: "X", content: "y" });
    expect(await store.get(s.id)).toMatchObject({ title: "X" });
    expect(await store.get("missing")).toBeUndefined();
  });

  it("update() changes fields and refreshes updatedAt", async () => {
    const s = await store.save({ title: "Old", content: "c" });
    now = 5000;
    const updated = await store.update(s.id, { title: "New" });
    expect(updated.title).toBe("New");
    expect(updated.content).toBe("c");
    expect(updated.createdAt).toBe(1000);
    expect(updated.updatedAt).toBe(5000);
  });

  it("update() throws when id is not found", async () => {
    await expect(store.update("nope", { title: "x" })).rejects.toThrow(
      /not found/i,
    );
  });

  it("remove() deletes a record; missing id is a no-op", async () => {
    const s = await store.save({ title: "Del", content: "" });
    await store.remove(s.id);
    expect(await store.list()).toHaveLength(0);
    await expect(store.remove("missing")).resolves.toBeUndefined();
  });

  it("list() throws a clear error when stored JSON is corrupt", async () => {
    await LocalStorage.setItem(SECRETS_KEY, "{not valid json");
    await expect(store.list()).rejects.toThrow(/parse|corrupt/i);
  });

  it("list() returns empty array when nothing stored", async () => {
    expect(await store.list()).toEqual([]);
  });

  it("replaceAll() overwrites the stored set", async () => {
    await store.save({ title: "A", content: "a" });
    await store.replaceAll([
      { id: "x", title: "X", content: "xc", createdAt: 10, updatedAt: 10 },
      { id: "y", title: "Y", content: "yc", createdAt: 20, updatedAt: 20 },
    ]);
    const all = await store.list();
    expect(all.map((s) => s.id)).toEqual(["y", "x"]); // sorted by updatedAt desc
  });

  it("replaceAll() with an empty array clears storage", async () => {
    await store.save({ title: "A", content: "a" });
    await store.replaceAll([]);
    expect(await store.list()).toEqual([]);
  });
});
