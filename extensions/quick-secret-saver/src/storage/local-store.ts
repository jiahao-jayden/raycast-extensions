// src/storage/local-store.ts
import { randomUUID } from "node:crypto";
import { LocalStorage } from "@raycast/api";
import {
  SECRETS_KEY,
  Secret,
  SaveInput,
  UpdatePatch,
  SecretStore,
} from "./types";

/** Injectable clock so tests are deterministic. Defaults to Date.now. */
type Clock = () => number;

/** Injectable id generator so tests are deterministic. Defaults to randomUUID. */
type IdGen = () => string;

export class LocalSecretStore implements SecretStore {
  // randomUUID comes from node:crypto, not the global `crypto` — Raycast's Node
  // runtime does not expose a global crypto, so `crypto.randomUUID()` throws.
  constructor(
    private readonly now: Clock = () => Date.now(),
    private readonly genId: IdGen = randomUUID,
  ) {}

  /** Read + parse the full array. Throws a clear error on corrupt JSON. */
  private async readAll(): Promise<Secret[]> {
    const raw = await LocalStorage.getItem<string>(SECRETS_KEY);
    if (raw === undefined || raw === "") {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Secret[]) : [];
    } catch {
      // Do NOT overwrite the corrupt data — surface the error so the user
      // can recover. Never echo content in the message (spec §9).
      throw new Error("Failed to parse stored secrets (corrupt data).");
    }
  }

  private async writeAll(secrets: Secret[]): Promise<void> {
    await LocalStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
  }

  async list(): Promise<Secret[]> {
    const all = await this.readAll();
    return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Secret | undefined> {
    const all = await this.readAll();
    return all.find((s) => s.id === id);
  }

  async save(input: SaveInput): Promise<Secret> {
    const all = await this.readAll();
    const ts = this.now();
    const secret: Secret = {
      id: this.genId(),
      title: input.title,
      content: input.content,
      createdAt: ts,
      updatedAt: ts,
    };
    all.push(secret);
    await this.writeAll(all);
    return secret;
  }

  async update(id: string, patch: UpdatePatch): Promise<Secret> {
    const all = await this.readAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`Secret not found: ${id}`);
    }
    const updated: Secret = {
      ...all[idx],
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      updatedAt: this.now(),
    };
    all[idx] = updated;
    await this.writeAll(all);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const all = await this.readAll();
    const next = all.filter((s) => s.id !== id);
    if (next.length !== all.length) {
      await this.writeAll(next);
    }
  }

  async replaceAll(secrets: Secret[]): Promise<void> {
    await this.writeAll(secrets);
  }
}
