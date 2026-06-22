# Quick Secret Saver

Quickly save and retrieve free-text secrets like passwords, tokens, and notes — without leaving Raycast. Secrets live in Raycast's local storage on your machine and can optionally be synced, end-to-end encrypted, through a private GitHub gist.

## Commands

- **Save Secret** — Create a new secret with a title and content.
- **Save Secret from Clipboard** — Turn the current clipboard text into a new secret in one step.
- **Search Secrets** — Search, copy, view, edit, and delete saved secrets.
- **Sync Secrets** — Merge your local secrets with a private GitHub gist. Everything is encrypted with a passphrase before it leaves your machine.

## How it works

Secrets are stored locally via Raycast's `LocalStorage`. Nothing leaves your machine unless you run **Sync Secrets**.

When you sync:

1. The encrypted envelope is pulled from your gist and decrypted with your passphrase.
2. Remote and local records are merged (newest `updatedAt` wins per record).
3. The merged set is re-encrypted and written back to the gist.

Encryption uses **AES-256-GCM** with a key derived from your passphrase via **scrypt**. The passphrase itself is never stored or uploaded — you enter it each time you sync. If you lose it, the synced data cannot be recovered.

## Setup for sync

Sync is optional. The Save and Search commands work with no configuration. To enable sync:

1. **Create a private gist.** Go to https://gist.github.com, create a *secret* gist with any placeholder content, and save it. Copy its ID from the URL (the long string after your username).
2. **Create a GitHub token.** In GitHub → Settings → Developer settings → Personal access tokens, create a token with the **`gist`** scope only.
3. **Configure the extension.** Open the extension preferences in Raycast and paste:
   - **GitHub Token** — the token from step 2.
   - **Gist ID** — the ID from step 1.
4. **Run Sync Secrets** and enter an encryption passphrase. Use the same passphrase on every device you sync from.

## Privacy

- Secret content is encrypted before upload; the gist only ever holds ciphertext.
- The passphrase and your decrypted secrets are never written to the gist or transmitted anywhere.
- The GitHub token is stored in Raycast's secure preference storage and is used only to read/write your gist.
