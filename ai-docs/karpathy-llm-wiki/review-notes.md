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

## Phase 4 — Chat persistence (Dexie + ChatStore interface)

- Module layout confirmed:
  - `src/agent-kit/persistence/chat-store.ts` — the `ChatStore` interface + `ChatSession` type. Zero framework deps; the only imported symbol from outside the folder is `AgentMessage` from `@mariozechner/pi-agent-core`.
  - `src/agent-kit/persistence/in-memory-chat-store.ts` — reference `InMemoryChatStore` (two `Map`s mirroring the split-storage shape). Zero-dep; used by CLI/test reuse.
  - `src/agent-kit/persistence/index.ts` — barrel exports `ChatSession`/`ChatStore` types + `InMemoryChatStore`. Re-exported by `src/agent-kit/index.ts` via `export * from "./persistence"`.
  - `src/adapters/browser/dexie-chat-store.ts` — `DexieChatStore` is the only file that imports `dexie` and `nanoid`. `chat-ui/**` has no direct dexie imports (enforced by ESLint `no-restricted-imports`).
- Split-storage schema (Dexie version 1, database name `zenfs-browser`):
  - `chatSessionMetadata` — primary key `id`, indexes `updatedAt`, `rootDirName`. Row shape: `{id, title, preview, messageCount, rootDirName, createdAt, updatedAt}`.
  - `chatSessionData` — primary key `id`. Row shape: `{id, messagesJson}` where `messagesJson` is `JSON.stringify(AgentMessage[])`.
  - All `createSession`/`deleteSession`/`appendMessage` writes run inside a Dexie rw transaction spanning both tables, so list views never observe a session with one table updated and the other stale.
  - `listSessions` reads only `chatSessionMetadata.orderBy("updatedAt").reverse()` — the 200-char `preview` is computed at append time so the sidebar never parses message JSON.
- High-water-mark persistence in `useAgentSession`:
  - `highWaterMarkRef` records `messages.length` right after `chatStore.loadMessages(sessionId)` hydrates the Agent on mount / session switch; `hydratedSessionIdRef` pins the mark to a specific session so a mid-stream switch can't cross-persist.
  - On `message_end`, `turn_end`, and `agent_end` events, `persistMessageDelta()` snapshots `agent.state.messages`, slices `[highWaterMark..end)`, advances the high-water mark, and appends each new message through a serialised promise chain (`persistLockRef`) so two back-to-back events can't interleave appends.
  - The session-change effect aborts any active stream (`_agent.abort()`) before it reloads transcripts — prevents the previous session's in-flight `message_end` from landing on the new session.
- `useChatSessions` owns session selection + localStorage persistence (`${BASE_URL}chat:currentSessionId`). `ChatColumn` wires it to `useAgentSession` via the `sessionId` port and calls `useChatSessions.onBeforeSwitch = () => session.stop()` so a switch-during-stream aborts first.
- UI surface + testids: `ChatSessionList` renders `btn-chat-session-new`, `btn-chat-session-toggle`, and per-session `btn-chat-session-<id>[data-test-state=active|inactive]` + `btn-chat-session-delete-<id>`. `MessageBubble`'s existing `chat-message-turn-<N>` testid is reused unchanged — persistence is invisible to the UI-level test API.
- E2E journey `e2e/chat-persistence.spec.ts` (single test, 5 steps): open+login+vault+select → send two turns → record active session testid → reload → assert both turns rendered without any new `/v1/chat/completions` hit (via `page.route`, not `page.evaluate`) → new session via `btn-chat-session-new` → send "fresh" → switch back to the original session → assert prior turns still there. Route interception counts HTTP calls; the restoration assertion is the "no new LLM call" invariant the plan called out.
- Gates: `npm run build` clean, `npm run lint` clean, `npm run ci:test:e2e` 6/6 passing (~57s).
- Deviations from plan: the plan suggested driving FSA re-grant through a `btn-sidebar-restore` flow after reload. In practice the mock handle is not structured-cloneable, so `idb-keyval` silently fails on `set(dirHandle)` and the reloaded app lands in `status: "empty"` instead of `prompt`. Chat persistence does not require a vault, so the test does not re-open the directory after reload and still asserts the persistence guarantee cleanly. Real users will still land in `prompt` state via the existing `btn-sidebar-restore` surface (unchanged code path); this is only a test-environment quirk.
- Iterations caught by tests: the first test draft reused `ChatPage.waitServerReady(...)` after `page.reload()`. That helper unconditionally clicks `btn-setup-bodhi`, which does not exist on an already-configured reload — it timed out at the action-timeout boundary and blew the test deadline before any assertion fired. Fix: after reload, wait directly on `badge-server-status[data-teststate="ready"]` + `section-auth[data-teststate="authenticated"]` + the previously active session row becoming visible. The setup helper is only appropriate on a cold `page.goto("/")`.

## Phase 5 — @-file-mention popup + resolver

- Module layout confirmed — parser/resolver live in agent-kit; popup + hook in chat-ui:
  - `src/agent-kit/mentions/parser.ts` — `parseMentions(text): {display, mentions[]}` over the regex `/(?:^|\s)@([a-zA-Z0-9_./-]+?)(?=\s|$|[,;:!?)])/g`. Dedupes paths, preserves order. Zero deps.
  - `src/agent-kit/mentions/resolver.ts` — `resolveMentions(fs, text, options?): Promise<string>`. Walks the mentions list, resolves each against `fs.cwd`, reads content via `FileSystemProvider.readFile`, wraps in a fenced code block (language inferred from extension; `// @path` header as the first body line). Per-file cap 20KB, global cap 40KB. Files that don't exist / are directories / would overflow budget get a short marker block instead so the user sees every mention was processed.
  - `src/agent-kit/mentions/index.ts` — barrel; re-exported via `src/agent-kit/index.ts`'s `export * from "./mentions"`.
  - `src/chat-ui/hooks/useFileMentions.ts` — BFS walk over `FileSystemProvider` (depth cap 6, entry cap 2000, skips `node_modules`, `.git`, and any dotfile). Lazy first-use, cached. `invalidate()` clears the cache and re-walks; ChatInput owns the hook directly (per the plan's "cleaner wiring" note) so there's no cross-cutting subscription plumbing to agent events yet — write-triggered invalidation can be wired in a later phase if needed.
  - `src/chat-ui/components/FileMentionPopup.tsx` — absolute-positioned div anchored above the input (we avoided Radix Popover because it steals focus; the input must retain focus while the popup is up). Renders one `btn-mention-option-<sanitized-path>` per row; sanitizer replaces `/` and `.` with `-`. Uses `onMouseDown` (with preventDefault) for clicks so the input's blur doesn't dismiss the popup before the pick lands.
  - `src/chat-ui/components/mention-utils.ts` — houses `sanitizeMentionPath` so the popup component stays "components-only" per react-refresh lint rule.
  - `src/chat-ui/components/ChatInput.tsx` — now owns the popup state. Detects `@` at caret via `/(?:^|\s)@([a-zA-Z0-9_./-]*)$/` against the substring up to `selectionStart`; open/close/arrow-up/down/Enter/Esc handled inline. On pick, replaces the `@<query>` token at its start index with `@<path> `.
- Fuse.js config: `threshold: 0.4`, `ignoreLocation: true`, single synthetic key `{name:"path", getFn: s => s}` over the flat path array. Results capped at 20. Empty-query path returns the first 20 files without fuse.
- **Inline-vs-persist decision**: stored the **resolved** text in both agent state and chat store. Rationale: splitting display (original) vs replay (resolved) would require either a custom AgentMessage shape or a post-hydration re-inlining step — both leak resolver concerns into persistence. Resolved text renders fine in the bubble (the bubble is `whitespace-pre-wrap`; fenced blocks show as literal text). Turn 2+ LLM replay works without extra plumbing because what was sent is what is stored. Plan explicitly allows this choice.
- Data-testids added:
  - `div-file-mention-popup[data-test-state="visible|filtering|empty"]` — the popup container.
  - `btn-mention-option-<sanitized-path>` — one per listed option; `data-active="true"` on the currently highlighted row.
  - `div-mention-empty` — rendered when filtering returns no files (secondary, for debugging).
- E2E journey `e2e/file-mention.spec.ts` — single test, 8 steps: login+pick+mount+model → type `@src/u` → assert popup visible + `btn-mention-option-src-utils-ts` visible → Enter → assert input contains `@src/utils.ts ` → finish prompt and send → assistant reply references `add` / `a + b` / `42` → `div-tool-call-fs__read` count is 0 (proves the agent did not need a tool call because the content was inlined).
- Page-object additions on `ChatPage`: static `sanitizeMentionPath`, instance `mentionPopup(state?)`, `mentionOption(path)`, `typeMention(query)`, `pickMentionByPath(path)`.
- Architectural invariants:
  - `rg "from ['\"](react|@zenfs|dexie|@bodhiapp|fuse)" src/agent-kit/` — zero matches. mentions/ imports only `../tools/fs-provider` and `../tools/path`.
  - `rg "from ['\"].*adapters" src/chat-ui/` — zero matches.
  - Fuse.js import lives only in `src/chat-ui/hooks/useFileMentions.ts` (a UI concern — allowed in chat-ui).
- Gates: `npm run build` clean, `npm run lint` clean, `npm run ci:test:e2e` **7/7 passing** (~1.1m), no flakes on first run.
- Deviations from plan:
  - Used an absolute-positioned div instead of Radix Popover for the mention popup. The plan suggested Popover; in practice Radix Popover's focus-management (Trigger + Portal) interferes with keeping the caret in the Input. The simpler div pattern matches established chat-autocomplete UX and passes the same data-testid contract.
  - Did not wire a subscribe-to-`fs__write`-events invalidation path on `useFileMentions`. The plan explicitly permits either approach ("err on 'caller invalidates' if uncertain"); since Phase 5's tests don't require post-write freshness and the ChatInput is the sole consumer today, `invalidate()` is exported for the next phase that needs it without adding observer plumbing now.

## Phase 6 — ai-docs reports + import-boundary audit

- Reports produced under `ai-docs/karpathy-llm-wiki/`:
  - `00-feature-comparison.md` — karpathy × zenfs-browser-before × post-Phase-5 matrix. "Planned for M2+" rows are the ones explicitly deferred by the plan (search, fetch_url, extract_concepts, skills, autoresearch); "Out of scope" rows (graph view, schema editor) are non-goals for M1.
  - `01-architecture-mapping.md` — before/after module graphs, ASCII dependency diagram, allowed/forbidden imports per layer (mirrors `eslint.config.js`), and a ChatColumn → useAgentSession/useChatSessions/useFileMentions wiring trace so a future contributor can trace any prop back to `App.tsx`.
  - `02-phase-plan.md` — one-pager phase index with commit hashes and the test added/extended at each phase. Points at the canonical plan file at its external path (`/Users/amir36/.claude/plans/we-want-to-evolve-purring-ocean.md`).
  - `03-tool-specs.md` — reference for the `fs__*` quartet. Prose schemas (TypeBox `parameters` shape described in text), LLM-facing descriptions, error cases, result shapes, plus the `FileSystemProvider` interface and a short "adding a new tool" checklist.
  - `04-portable-kit-reuse.md` — copy-pasteable Node CLI skeleton using `Agent`, `createFsTools(fs)`, `buildSystemPrompt`, `InMemoryFsProvider`, `InMemoryChatStore`, `resolveMentions`, and a `streamSimple`-based `streamFn`.
- Import-boundary audit script `scripts/check-import-boundaries.mjs` (~130 lines). Zero new runtime or dev dependencies — uses `node:fs/promises` + regexes. Walks `src/agent-kit/**`, `src/chat-ui/**`, `src/adapters/**` and fails non-zero with `layer, file:line, rule, snippet` on any forbidden import. Wired via `"check:arch": "node scripts/check-import-boundaries.mjs"` and a new composite `"ci:check": "npm run build && npm run lint && npm run check:arch && npm run ci:test:e2e"` in `package.json`.
- `tsx` not in devDependencies (as hinted by the phase prompt); chose `.mjs` + plain Node over `node --experimental-strip-types` to avoid the flag and the experimental gate. Script is ES-module JS, no transpile step. Keeps the guardrail reproducible on any Node 18+ host.
- New `src/adapters/browser/README.md` matches the style of the existing `agent-kit/README.md` and `chat-ui/README.md`: what the layer is, which `agent-kit` interfaces it implements, allowed vs. forbidden imports, and a worked "swap ZenFS for OPFS" example. The adapters/browser `index.ts` already had the layer-contract header comment; the README expands on it.
- Root `README.md` was pure Vite template boilerplate — replaced in full with a purpose-specific short README: one-paragraph description, architecture diagram + link to `01-architecture-mapping.md`, links to the four other reports, a link to the external plan file (with a note that it's outside the repo), and a Development section listing `dev`/`build`/`lint`/`check:arch`/`ci:test:e2e`/`ci:check`.
- CI workflow (`.github/workflows/build.yml`) currently runs `lint`, `build`, and `ci:test:e2e` as separate steps. Did **not** modify the workflow YAML; `check:arch` is available via `npm run check:arch` and `npm run ci:check` locally. Adding it to GitHub Actions is a follow-up: insert a `Check architecture` step between `Lint` and `Build`, or swap the `Lint`/`Build`/`E2E tests` triplet for a single `npm run ci:check` step. Flagged per the phase prompt's "if CI adjustments are non-trivial, document and stop short" rule.
- Audit run (post-Phase-5 source) found **zero forbidden imports** across all three layers. No production code needed to change. Aligns with the prior-phase architectural review bullets.
- Corrections to prior assumptions: none discovered while writing the docs. The phase spec matched what shipped at each commit (including the `be7b9e7` Phase 4 test-environment quirk on re-granting FSA handles after reload, which review-notes.md already documents). The one minor doc-vs-code gap — `src/adapters/browser/` previously had no README while `agent-kit/` and `chat-ui/` did — is addressed here.
- Gates: `npm run build` clean, `npm run lint` clean, `npm run check:arch` exit 0, `npm run ci:test:e2e` 7/7 passing.
