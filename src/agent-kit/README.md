# agent-kit

Portable agent core for browser-native coding/notes agents. Zero dependency on React, filesystem backend, database, or any host-specific SDK.

## Why

This package is the reusable brain. The browser app under `src/` composes it with `adapters/browser` (ZenFS + Dexie) and `chat-ui` (React). A CLI or a backend service could compose it with node-fs + SQLite + a stdio UI.

## Layout

```
agent/         createAgent factory + system prompt builder
tools/         FileSystemProvider interface + fs__read/write/ls/edit
mentions/      @path parser + resolver (text -> text, fs-backed)
persistence/   ChatStore interface + InMemoryChatStore reference impl
```

## Reuse example (sketch, for a Node CLI)

```ts
import { Agent } from "@mariozechner/pi-agent-core";
import { createFsTools, buildSystemPrompt, InMemoryFsProvider } from "./agent-kit";
// plus a node-side streamFn + your own model config + your own ChatStore impl.
```

See `04-portable-kit-reuse.md` in `ai-docs/karpathy-llm-wiki/` for the full example (added in Phase 6).

## Import boundary

The ESLint config at `/eslint.config.js` enforces the rules at the top of `index.ts`. Any PR that tries to import React, ZenFS, Dexie, or adapter/UI code from this folder will fail lint.
