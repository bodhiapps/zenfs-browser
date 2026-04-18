# Architecture mapping — before and after the 3-layer refactor

## Before (pre-Phase-0)

Before the evolution, the codebase had a conventional React-app layout — no
portable kit, no ports/adapters separation.

```
src/
  App.tsx
  hooks/
    useAgent.ts          ← owned streamFn, agent singleton, model state
  components/
    chat/                ← ChatColumn, ChatMessages, bubbles (React)
    app-sidebar.tsx, file-viewer.tsx, ...
  lib/
    fsa-*.ts             ← raw FSA helpers
  main.tsx
```

Dependency edges were implicit: `hooks/useAgent.ts` imported `@bodhiapp/*`, the
pi-agent core, and filesystem helpers directly. `agent.state.tools = []`
(`useAgent.ts:179`) made the agent a chat shell. Chat history lived only in
React state and died on reload.

## After (post Phase 5)

```
src/
  agent-kit/              ← portable: kit<-adapters and kit<-chat-ui
    agent/prompt.ts
    tools/{fs-provider, path, read, write, ls, edit, registry, index}.ts
    mentions/{parser, resolver, index}.ts
    persistence/{chat-store, in-memory-chat-store, index}.ts
    index.ts
    README.md

  adapters/browser/       ← implements agent-kit interfaces over browser libs
    zenfs-provider.ts     (mountVault/unmountVault)
    zenfs-fs-provider.ts  (ZenFsProvider : FileSystemProvider)
    dexie-chat-store.ts   (DexieChatStore : ChatStore)
    index.ts
    README.md             (added in Phase 6)

  chat-ui/                ← React UI kit, consumes agent-kit via ports
    hooks/{useAgentSession, useVaultMount, useChatSessions,
           useFileMentions, useBodhiModels}.ts
    components/{ChatColumn, ChatMessages, ChatInput, ChatSessionList,
                MessageBubble, ToolCallMessage, ToolResultMessage,
                FileMentionPopup, AuthBar, ModelCombobox}.tsx
    components/tool-renderers/{registry.ts, FsReadRenderer.tsx, ...}
    contracts/ui-session.ts
    index.ts
    README.md

  # App-only (wires all three layers together)
  App.tsx
  components/, hooks/, lib/, main.tsx
```

## ASCII dependency diagram

```
            +-----------------+
            |  agent-kit/     |   pure: pi-agent-core, pi-ai, typebox
            |  (ports + core) |
            +-----------------+
                ^         ^
   implements   |         |  consumes via ports (types only)
                |         |
  +-----------------+   +-----------------+
  | adapters/       |   |  chat-ui/       |   React + UI libs + Fuse.js
  | browser/        |   |  (React)        |
  | (ZenFS, Dexie)  |   +-----------------+
  +-----------------+          ^
           ^                   |
           |  instantiated     |  renders
           |  and passed via   |
           |  props            |
           |                   |
           +---------+---------+
                     |
                +----------+
                |  App.tsx | wires all three layers
                +----------+
```

Key direction: **nothing in `agent-kit/` imports from `adapters/` or
`chat-ui/`**; **nothing in `chat-ui/` imports from `adapters/`**. The only
file that simultaneously reaches into all three is `src/App.tsx`, which
composes them.

## Allowed / forbidden imports (enforced by `eslint.config.js`)

| Layer              | Allowed                                                                                             | Forbidden                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `agent-kit/**`     | `@mariozechner/pi-*`, `@sinclair/typebox`, sibling modules in agent-kit                             | `react`, `react-dom`, `@zenfs/*`, `dexie`, `@bodhiapp/*`, `@/adapters/*`, `@/chat-ui/*`, `../adapters`, `../chat-ui` |
| `chat-ui/**`       | `react`, shadcn UI, Radix, Tabler icons, `fuse.js`, `../agent-kit`                                  | `@/adapters/*`, `../adapters`, `@zenfs/*`, `dexie`                                                                 |
| `adapters/browser/**` | `@zenfs/*`, `dexie`, `nanoid`, `../agent-kit`                                                    | `@/chat-ui/*`, `../chat-ui` (DI direction is app→UI→adapters-via-prop, not UI→adapters)                            |

The forbidden list is mirrored in `scripts/check-import-boundaries.mjs`, which
runs via `npm run check:arch` as a belt-and-suspenders guardrail independent
of ESLint's config loading.

## Wiring trace — where a prop comes from

A future contributor reading `ChatColumn.tsx` can trace any inbound prop/port
back to `App.tsx`:

- `fsProvider: FileSystemProvider | null` — wired in `App.tsx`. When the user
  picks a directory, `useVaultMount` from `src/chat-ui/hooks/useVaultMount.ts`
  calls `mountVault(handle)` (a callback from `adapters/browser/zenfs-provider.ts`)
  and constructs a `ZenFsProvider` instance. That instance is handed to
  `<ChatColumn fsProvider={...} />`, which passes it into
  `useAgentSession({ fs: fsProvider, ... })`.
- `chatStore: ChatStore | null` — `App.tsx` instantiates `DexieChatStore`
  once at startup and passes it through the same prop path. Inside
  `useAgentSession`, it's used for `loadMessages(sessionId)` on mount/switch
  and `appendMessage(sessionId, msg)` on `message_end`/`turn_end`.
- `streamFn: StreamFn` — constructed in `ChatColumn` itself (it uses
  `useBodhi()` for the auth token) and passed into `useAgentSession`. This is
  why `chat-ui` depends on `@bodhiapp/bodhi-js-react` — the transport binding
  lives in the UI layer, not in agent-kit.
- `selectedModel` — `useBodhiModels()` (chat-ui hook) owns selection +
  localStorage persistence; `ChatColumn` forwards it into the session.
- `sessionId`, `onBeforeSwitch` — `useChatSessions()` (chat-ui hook) owns
  session selection; `ChatColumn` wires it so a session switch aborts any
  in-flight stream before hydrating the new session.
- `@path` resolution — `useFileMentions()` reads files via the same
  `fsProvider`; on submit, `ChatInput` calls `resolveMentions(fs, text)` from
  `agent-kit/mentions` and sends the expanded text to the agent.

## Why ports-and-adapters

1. **Reusability**: `agent-kit` is framework-free. A Node CLI can construct an
   `InMemoryFsProvider` + `InMemoryChatStore` + its own `streamFn` and drive
   the same tools and prompt. See `04-portable-kit-reuse.md`.
2. **Swappability on the browser side**: a future `OPFSFsProvider` or
   `RemoteFsProvider` slots in without changing `agent-kit` or `chat-ui`. The
   adapters layer README (`src/adapters/browser/README.md`) walks through
   adding one.
3. **Testability**: every tool has an `InMemoryFsProvider` path for unit
   tests. E2E tests drive through the UI but the same `InMemoryFsProvider`
   interface is usable for backend/CLI integration tests later.
