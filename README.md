# zenfs-browser

A browser-native coding/notes agent. The user grants access to a local
directory via the File System Access API; the app mounts it at `/vault`
using ZenFS, exposes four filesystem tools (`fs__read`, `fs__write`,
`fs__ls`, `fs__edit`) to an LLM agent (via `@mariozechner/pi-agent-core`
proxied through a Bodhi server), persists chats to IndexedDB, and supports
`@path` file-mentions that inline file contents into user messages. The
inspiration is Andrej Karpathy's "LLM Wiki" pattern — but running in the
browser, not a CLI.

## Architecture

Three loosely-coupled layers behind ports-and-adapters boundaries. See
[`ai-docs/karpathy-llm-wiki/01-architecture-mapping.md`](ai-docs/karpathy-llm-wiki/01-architecture-mapping.md)
for the full diagram and allowed/forbidden import lists.

```
src/
  agent-kit/           portable TS core — no React, no ZenFS, no Dexie
    tools/             FileSystemProvider + fs__read/write/ls/edit
    mentions/          @path parser + resolver
    persistence/       ChatStore interface + InMemoryChatStore
    agent/             canonical system prompt

  adapters/browser/    browser impls of agent-kit interfaces
    zenfs-fs-provider  ZenFsProvider : FileSystemProvider
    dexie-chat-store   DexieChatStore : ChatStore

  chat-ui/             React UI kit (hooks + components) — talks to
                       agent-kit via ports, not adapters

  # App-only — wires all three layers together
  App.tsx, components/, hooks/, lib/
```

Dependency direction: `agent-kit ← adapters/browser` and `agent-kit ← chat-ui`.
Nothing in `chat-ui/` imports from `adapters/`. `App.tsx` is the only
composition root.

## Related docs

- [`00-feature-comparison.md`](ai-docs/karpathy-llm-wiki/00-feature-comparison.md)
  — feature table vs. karpathy-llm-wiki and pre-evolution zenfs-browser.
- [`01-architecture-mapping.md`](ai-docs/karpathy-llm-wiki/01-architecture-mapping.md)
  — before/after module graphs, wiring trace, ESLint boundary rules.
- [`02-phase-plan.md`](ai-docs/karpathy-llm-wiki/02-phase-plan.md) —
  one-pager phase index with commit hashes.
- [`03-tool-specs.md`](ai-docs/karpathy-llm-wiki/03-tool-specs.md) —
  `fs__*` tool schemas, descriptions, error cases, result shapes.
- [`04-portable-kit-reuse.md`](ai-docs/karpathy-llm-wiki/04-portable-kit-reuse.md)
  — recipe for building a Node CLI on the same `agent-kit`.
- [`review-notes.md`](ai-docs/karpathy-llm-wiki/review-notes.md) —
  append-only per-phase architectural review log (authoritative record).

The canonical evolution plan lives **outside this repo** at
`/Users/amir36/.claude/plans/we-want-to-evolve-purring-ocean.md`. It covers
rationale, sub-agent delegation prompts, open risks, and the full per-phase
specs. Anyone with access to that path can read it directly.

## Development

| Script                  | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server                                                     |
| `npm run build`         | Typecheck + production build                                        |
| `npm run lint`          | ESLint, including `no-restricted-imports` for the 3-layer contract  |
| `npm run check:arch`    | Substring-match import-boundary audit (independent of ESLint)       |
| `npm run ci:test:e2e`   | Playwright e2e suite (7 tests)                                      |
| `npm run ci:check`      | build + lint + check:arch + ci:test:e2e (full CI gate)              |

`check:arch` is a belt-and-suspenders CI guardrail: it parses imports in
`src/agent-kit/**`, `src/chat-ui/**`, and `src/adapters/**` against the same
forbidden-lists ESLint enforces, so a broken lint config can't let
boundary violations slip through. Source:
[`scripts/check-import-boundaries.mjs`](scripts/check-import-boundaries.mjs).

## Prerequisites

- Node 20+ (CI uses 22).
- A running Bodhi server (see `@bodhiapp/*` packages) for the chat
  transport — configure via `.env` variables matching
  `VITE_BODHI_APP_CLIENT_ID` / `VITE_BODHI_AUTH_SERVER_URL`.
- A Chromium-based browser for FSA + the e2e tests (`npx playwright install chromium`).
