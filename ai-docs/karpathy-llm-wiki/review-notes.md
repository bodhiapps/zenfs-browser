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

## Phase 2 — fs__read tool + tool bubbles + agent wiring

- New in `agent-kit`:
  - `tools/read.ts` — `fs__read` ported from karpathy with offset/limit/2000-line cap.
  - `tools/registry.ts` — `createFsTools(fs): FsTool[]` (uses `AgentTool<any>` to sidestep generic variance per karpathy's precedent).
  - `agent/prompt.ts` — `buildSystemPrompt({rootDirName})` canonical system prompt (covers fs__read + rules).
- New in `chat-ui`:
  - `contracts/ui-session.ts` — `ChatUiState` + `ChatUiActions` (UI-agnostic; enables CLI reuse later).
  - `hooks/useAgentSession.ts` — ports-based agent session hook; replaces retired `src/hooks/useAgent.ts`. Uses `useReducer` + rAF-batched streaming updates (pi-web-ui pattern).
  - `hooks/useBodhiModels.ts` — model listing + selection (extracted from old useAgent).
  - `components/tool-renderers/` — registry + Default + FsRead renderers. `registerBuiltInRenderers()` called once at module load.
  - `components/ToolCallMessage.tsx` — assistant toolCall part renderer with `div-tool-call-<name>[data-test-state=...]`.
  - `components/ToolResultMessage.tsx` — role:"toolResult" message renderer; reads `toolName/toolCallId/isError` from the top level of the message (pi-ai `ToolResultMessage` shape).
- `ChatMessages.tsx` no longer filters toolResult; branch-renders. `ChatColumn.tsx` now constructs the streamFn and port set and passes them into `useAgentSession`; model selection moved to `useBodhiModels`.
- Retired `src/hooks/useAgent.ts` entirely.
- New e2e: `e2e/agent-fs.spec.ts` — one journey, 6 steps, multiple assertions. Uses only UI-level driving + `data-testid`/`data-test-state` waits. No `page.evaluate` for feature driving. Asserts `fs__read` tool-call bubble → success tool-result bubble → content contains seeded README → assistant reply references it.
- New data-testids: `div-tool-call-${toolName}`, `div-tool-result-${toolName}` (with `data-test-state=pending|executing|complete` / `success|error`), `div-tool-result-content`.
- Gates: `npm run build` clean, `npm run lint` clean, `npm run ci:test:e2e` 4/4 passing (~34s).
- Architectural notes:
  - `agent-kit` imports verified: only `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@sinclair/typebox`.
  - `chat-ui` does not import from `adapters/`; `ChatColumn` receives the `fsProvider` as a prop from `App.tsx`.
  - Bodhi-specific transport (`streamFn`) is constructed in `ChatColumn` (chat-ui) and passed into `useAgentSession` — the kit-style hook never imports Bodhi SDK.
- Iterations caught by tests:
  - TypeBox peer dep: `@sinclair/typebox@0.34.49` matched pi-ai's version; added as direct dep.
  - `Model` type lives in `@mariozechner/pi-ai`, not `@mariozechner/pi-agent-core`.
  - `toolResult` message shape: top-level `toolName` and `toolCallId`, not a content-part — flagged by the first failed run where bubble rendered as `div-tool-result-unknown`.

## Phase 3 — fs__write, fs__ls, fs__edit tools

- New tool modules (all in `src/agent-kit/tools/`, each <=110 lines):
  - `write.ts` — `fs__write(path, content)`. Creates parent dirs via `FileSystemProvider.mkdir` (already recursive). Dropped the karpathy `onWrite` callback (no search index in M1). Overwrites existing files. Reports `bytesWritten` (UTF-8).
  - `ls.ts` — `fs__ls(path?, limit?, recursive?)`. Non-recursive path unchanged from karpathy shape (entries sorted, trailing `/` on dirs). Recursive path: BFS queue with `RECURSIVE_DEPTH_CAP=4` and `RECURSIVE_ENTRY_CAP=500`; recursive entries are emitted as relative paths (e.g. `docs/guide.md`, `src/`).
  - `edit.ts` — NEW. Schema `{path, startLine, endLine, content}`, 1-indexed inclusive range. `endLine = startLine - 1` signals insert-without-replace. Read → split('\n') → splice → writeFile. Error surface: not-found, is-directory, range out-of-bounds (both ends), aborted.
- `tools/registry.ts` — `createFsTools(fs)` now returns all four tools. Flat list, one factory per tool; no implicit coupling.
- `tools/index.ts` — barrel re-exports `createWriteTool`, `createLsTool`, `createEditTool`; `agent-kit/index.ts` re-exports via its existing `export * from "./tools"`.
- `agent/prompt.ts` — system prompt rewritten to describe all four tools + rules:
  - paths resolve under `/vault` (absolute or relative);
  - run `fs__ls` before `fs__write` to a new directory;
  - run `fs__read` before `fs__edit` so line numbers are correct;
  - don't re-read `@`-mentioned files (contents pre-inlined);
  - report tool errors verbatim. Prompt sits around ~1.1k chars, well under the 1500 guardrail.
- No new tool renderers needed — the `DefaultToolRenderer` fallback is registered via `getToolRenderer()` and renders `div-tool-result-content` for unknown tool names. Decision: keeping renderers minimal honors the "tiny renderer" direction of the plan and the registry's fallback behavior. `FsWriteRenderer`/`FsLsRenderer`/`FsEditRenderer` can be added later without breaking existing tests.
- Test surface enrichment (mock, not app): `e2e/helpers/fs-mock.ts` now honors `{create: true}` on both `getFileHandle` and `getDirectoryHandle` (previously threw `NotFoundError` unconditionally); `removeEntry` now actually deletes the child instead of throwing. Required for ZenFS WebAccess to write new files / create parent dirs. No app code changed.
- New e2e journey `e2e/agent-fs-mutation.spec.ts` — one test, 10 steps, 5+ assertions across the journey: write notes.md → assert virtual file contains `# My Notes` → fs__ls → assert entries include both `README.md` and `notes.md` → fs__edit line 1 → assert virtual file contains `Updated notes`. Each tool-call terminal state is gated on `div-tool-result-<name>[data-test-state="success"]`. Per-tool result content asserted via the existing `div-tool-result-content` selector. `readVirtualFile` used for file-content verification since the file-tree has no refresh UI yet; per the plan this is explicit precedent for secondary verification.
- Architectural invariants confirmed:
  - `agent-kit/tools/*` imports only `@mariozechner/pi-agent-core`, `@sinclair/typebox`, and sibling files — no React/ZenFS/dexie/@bodhiapp.
  - `registry.ts` is the only file that imports all four tool factories; tools themselves do not import each other.
  - `prompt.ts` unchanged in imports (zero deps).
- Gates: `npm run build` clean, `npm run lint` clean, `npm run ci:test:e2e` 5/5 passing (~48s).
