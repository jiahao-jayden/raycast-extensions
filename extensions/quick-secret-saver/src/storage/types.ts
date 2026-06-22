// src/storage/types.ts

/** The LocalStorage key under which the full secrets array is stored. */
export const SECRETS_KEY = "secrets";

/** A single saved secret record. */
export interface Secret {
  id: string;
  title: string;
  content: string;
  createdAt: number; // ms epoch
  updatedAt: number; // ms epoch
}

/** Input for creating a new secret. */
export interface SaveInput {
  title: string;
  content: string;
}

/** Patch for updating an existing secret. Omitted fields are left unchanged. */
export interface UpdatePatch {
  title?: string;
  content?: string;
}

/**
 * Data-layer contract. Commands depend ONLY on this interface, never on
 * LocalStorage directly. A future sync backend is a new implementation.
 */
export interface SecretStore {
  /** All records, sorted by updatedAt descending. */
  list(): Promise<Secret[]>;
  /** A single record by id, or undefined if not found. */
  get(id: string): Promise<Secret | undefined>;
  /** Create a new record; generates id, createdAt, updatedAt. */
  save(input: SaveInput): Promise<Secret>;
  /** Update an existing record and refresh updatedAt. Throws if id not found. */
  update(id: string, patch: UpdatePatch): Promise<Secret>;
  /** Delete a record by id. No-op if id not found. */
  remove(id: string): Promise<void>;
  /** Replace the entire stored set with the given records (used by sync). */
  replaceAll(secrets: Secret[]): Promise<void>;
}
