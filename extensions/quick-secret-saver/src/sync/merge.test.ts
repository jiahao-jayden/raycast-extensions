// src/sync/merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeSecrets } from "./merge";
import { Secret } from "../storage/types";

const s = (id: string, updatedAt: number, content = "c"): Secret => ({
  id,
  title: id,
  content,
  createdAt: 0,
  updatedAt,
});

describe("mergeSecrets", () => {
  it("unions records present on only one side", () => {
    const merged = mergeSecrets([s("a", 1)], [s("b", 2)]);
    expect(merged.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("on id conflict keeps the newer updatedAt", () => {
    const merged = mergeSecrets([s("a", 10, "old")], [s("a", 20, "new")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe("new");
  });

  it("on equal updatedAt keeps the local copy", () => {
    const merged = mergeSecrets([s("a", 10, "local")], [s("a", 10, "remote")]);
    expect(merged[0].content).toBe("local");
  });

  it("returns records sorted by updatedAt descending", () => {
    const merged = mergeSecrets([s("a", 1), s("c", 3)], [s("b", 2)]);
    expect(merged.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("handles empty local and empty remote", () => {
    expect(mergeSecrets([], [])).toEqual([]);
    expect(mergeSecrets([s("a", 1)], [])).toHaveLength(1);
    expect(mergeSecrets([], [s("b", 2)])).toHaveLength(1);
  });
});
