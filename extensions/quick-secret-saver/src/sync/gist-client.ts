// src/sync/gist-client.ts

/** Filename inside the gist holding the encrypted envelope. */
export const GIST_FILENAME = "quick-secret-saver.json.enc";

const API = "https://api.github.com";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Read the encrypted envelope string from the gist, or undefined if the file
 * doesn't exist yet (first sync). Throws with a clear message on API failure.
 */
export async function readGist(
  token: string,
  gistId: string,
): Promise<string | undefined> {
  const res = await fetch(`${API}/gists/${gistId}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub read failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    files?: Record<
      string,
      { content?: string; truncated?: boolean; raw_url?: string }
    >;
  };
  const file = data.files?.[GIST_FILENAME];
  if (!file) {
    return undefined;
  }
  // Gist file contents over ~1MB are truncated; fetch raw_url in that case.
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, { headers: headers(token) });
    if (!rawRes.ok) {
      throw new Error(
        `GitHub raw read failed: ${rawRes.status} ${rawRes.statusText}`,
      );
    }
    return await rawRes.text();
  }
  return file.content;
}

/** Write (PATCH) the encrypted envelope string into the gist. */
export async function writeGist(
  token: string,
  gistId: string,
  content: string,
): Promise<void> {
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: "PATCH",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } }),
  });
  if (!res.ok) {
    throw new Error(`GitHub write failed: ${res.status} ${res.statusText}`);
  }
}
