# chat-ui

React UI kit for the agent. Talks to `agent-kit` through typed ports (FileSystemProvider, ChatStore, model getter, streamFn). Doesn't know about ZenFS, Dexie, or Bodhi — the app wires those in.

## Why this is organized as a kit

The `contracts/` subfolder defines UI-agnostic state/event types (`ChatUiState`, `ChatUiActions`). A CLI renderer (ink, blessed, raw readline) could implement the same contract and reuse `agent-kit` without touching this folder.

## Layout

```
hooks/         React hooks (useAgentSession, useFileMentions, useVaultMount)
components/    React components (ChatColumn, bubbles, popups, tool renderers)
contracts/     UI-agnostic state/event types
```

## Import boundary

- Imports from `../agent-kit` → OK.
- Imports from `../adapters/**` → BLOCKED (enforced by ESLint).
- Imports from `react`, shadcn UI, Radix, Tabler icons → OK.
