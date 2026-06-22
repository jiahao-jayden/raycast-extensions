// src/storage/index.ts
import { LocalSecretStore } from "./local-store";
import { SecretStore } from "./types";

/** Shared store instance used by all commands. */
export const store: SecretStore = new LocalSecretStore();

export * from "./types";
