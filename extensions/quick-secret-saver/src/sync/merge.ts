// src/sync/merge.ts
import { Secret } from "../storage/types";

/**
 * Merge local and remote secret sets by id. On id conflict the record with the
 * greater updatedAt wins; ties keep the local copy (deterministic). The result
 * is sorted by updatedAt descending. Pure function — no I/O.
 */
export function mergeSecrets(local: Secret[], remote: Secret[]): Secret[] {
  const byId = new Map<string, Secret>();
  for (const r of remote) {
    byId.set(r.id, r);
  }
  for (const l of local) {
    const r = byId.get(l.id);
    // Tie goes to local: use local unless remote is strictly newer.
    if (!r || l.updatedAt >= r.updatedAt) {
      byId.set(l.id, l);
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
