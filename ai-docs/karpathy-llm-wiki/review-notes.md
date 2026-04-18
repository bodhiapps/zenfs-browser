# Architectural review notes — per phase

Append-only log. One short section per phase; final audit happens in Phase 6.

## Phase 0 — Scaffold 3-layer architecture

- Layers created: `src/agent-kit/` (with `agent/`, `tools/`, `mentions/`, `persistence/`), `src/adapters/browser/`, `src/chat-ui/` (with `hooks/`, `components/`, `contracts/`). Each root has a barrel `index.ts` and (for agent-kit and chat-ui) a README describing the layer contract.
- All 6 existing chat components moved from `src/components/chat/` → `src/chat-ui/components/` via `git mv` (history preserved). Only `src/App.tsx:5-6` imports needed updating; relative imports within the moved files remained valid.
- ESLint `no-restricted-imports` rules added in `eslint.config.js` for two file-scopes:
  - `src/agent-kit/**`: blocks `react*`, `@zenfs/*`, `dexie`, `@bodhiapp/*`, and relative reaches into `adapters/` or `chat-ui/`.
  - `src/chat-ui/**`: blocks `adapters/`, `@zenfs/*`, `dexie`.
- `adapters/browser/**` not restricted (it implements agent-kit interfaces and naturally pulls browser-only deps).
- Gates: `npm run build` clean; `npm run lint` clean; `npm run ci:test:e2e` 3/3 passing (27.8s).
- No dependency on `adapters/` from `chat-ui/` — confirmed empty.
- No behavior change; App.tsx imports are cosmetic.

## Phase 1 — ZenFS mount + FileSystemProvider

- New files:
  - `src/agent-kit/tools/path.ts` — pure path helpers.
  - `src/agent-kit/tools/fs-provider.ts` — `FileSystemProvider` interface + `InMemoryFsProvider` zero-dep reference impl (Map+Set).
  - `src/adapters/browser/zenfs-provider.ts` — `mountVault`/`unmountVault`/`isVaultMounted` + re-exported ZenFS `fs`.
  - `src/adapters/browser/zenfs-fs-provider.ts` — `ZenFsProvider` class (concrete impl of `FileSystemProvider` over ZenFS `fs.promises`).
  - `src/chat-ui/hooks/useVaultMount.ts` — ports-based React hook (useReducer for React-19 `set-state-in-effect` compliance).
- Ports direction confirmed: `adapters/browser/zenfs-fs-provider.ts` imports the `FileSystemProvider` type from `agent-kit`. Nothing in `agent-kit/` imports from adapters or ZenFS.
- App wiring (`src/App.tsx`) instantiates `{mount: mountVault, unmount: unmountVault, createProvider: h => new ZenFsProvider(h.name)}` and hands the object to `useVaultMount` — the hook never imports from `adapters/`.
- New UI element: `<span data-testid="span-vault-status" data-test-state={status}>` with states `idle|mounting|ready|error`. Placed in the header.
- Test extension: one new step in existing `e2e/file-browser.spec.ts` "browse directory" journey asserting the status reaches `ready` after the picker resolves. No mock enrichment needed — ZenFS WebAccess works against the existing `installFsMock` surface unchanged.
- Dependencies added: `@zenfs/core@~2.5.6`, `@zenfs/dom@~1.2.9`. Bundle grew by ~290 KB (index chunk).
- Gates: `npm run build` clean, `npm run lint` clean, `npm run ci:test:e2e` 3/3 passing (~27s).
- React 19 lint notes: `react-hooks/refs` and `react-hooks/set-state-in-effect` required `useReducer` + ref-update-in-effect patterns. Adopted for `useVaultMount`; same pattern will apply to `useAgentSession` in Phase 2.
