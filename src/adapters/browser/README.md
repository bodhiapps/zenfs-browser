# adapters/browser

Browser-only implementations of `agent-kit` interfaces. The app wires these
into `chat-ui` via props/ports — nothing in `chat-ui` imports from here.

## What lives here

- `zenfs-provider.ts` — `mountVault(handle)` / `unmountVault()` helpers that
  register an FSA `FileSystemDirectoryHandle` with ZenFS at `/vault`.
- `zenfs-fs-provider.ts` — `ZenFsProvider` class implementing
  `FileSystemProvider` over ZenFS `fs.promises`.
- `dexie-chat-store.ts` — `DexieChatStore` implementing `ChatStore`. Uses
  the split-storage pattern (metadata row separate from `messagesJson`
  blob) so the session list never loads message bodies.

## Which agent-kit interfaces this layer implements

- `FileSystemProvider` (defined in `src/agent-kit/tools/fs-provider.ts`) —
  implemented by `ZenFsProvider`.
- `ChatStore` (defined in `src/agent-kit/persistence/chat-store.ts`) —
  implemented by `DexieChatStore`.

## Allowed imports

- `@zenfs/core`, `@zenfs/dom`
- `dexie`
- `nanoid`
- `../../agent-kit/...` (types + interfaces)
- Standard browser APIs (`FileSystemDirectoryHandle`, `TextEncoder`, …)

## Forbidden imports

- `../../chat-ui/...` — the app wires adapters into UI, not the other way
  around. A UI component should never reach directly into this folder; it
  should receive a provider/store as a prop from `App.tsx`.

Enforced by `scripts/check-import-boundaries.mjs` (and, for the other two
layers, by ESLint `no-restricted-imports`).

## Adding a new adapter — worked example

Suppose you want to replace the FSA-backed vault with OPFS (Origin Private
File System). Recipe:

1. Add `src/adapters/browser/opfs-fs-provider.ts` implementing
   `FileSystemProvider`. It reads/writes through `navigator.storage.getDirectory()`
   and its `FileSystemDirectoryHandle` tree — the same FSA shape ZenFS uses,
   so the provider can look very similar to `ZenFsProvider`.
2. (Optional) Add an `opfs-provider.ts` with a `mountOpfsVault()` / `unmountOpfsVault()`
   pair, mirroring the ZenFS mount helpers. If OPFS doesn't need a separate
   "mount" concept, skip this step and just construct the provider.
3. Export the new class/functions from `src/adapters/browser/index.ts`.
4. In `src/App.tsx`, swap the `ZenFsProvider` + `mountVault` construction
   for the OPFS equivalents. `chat-ui/ChatColumn` keeps receiving a
   `FileSystemProvider | null` prop — it doesn't know which adapter
   produced it.

No changes to `agent-kit/` or `chat-ui/`. That's the point of the layer
contract.

## Why this layer exists separately from the UI

The UI ships as a reusable React kit (`src/chat-ui/`) with the intent that
it could drive a different host: a Tauri app backed by a Node-side
`FileSystemProvider`, a server-rendered variant, etc. Keeping the
browser-specific storage/mount code out of `chat-ui/` means the UI kit
doesn't drag `@zenfs/*` or `dexie` with it when reused.
