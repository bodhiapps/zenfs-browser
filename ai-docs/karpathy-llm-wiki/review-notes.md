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
