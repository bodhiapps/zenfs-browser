# Reusing `agent-kit` outside the browser

The `src/agent-kit/` layer is framework-free by design. Anything in this
folder can be lifted into a Node CLI, a Cloudflare Worker, a Tauri app, or a
backend service that wants the same `fs__*` tool quartet + system prompt +
chat persistence contract.

The kit's only runtime deps are:

- `@mariozechner/pi-agent-core`
- `@mariozechner/pi-ai`
- `@sinclair/typebox`

The browser app today composes agent-kit with:

- `ZenFsProvider` (over FSA) — implements `FileSystemProvider`
- `DexieChatStore` — implements `ChatStore`
- A Bodhi-bearer `streamFn` built from `@mariozechner/pi-ai`'s `streamSimple`

A Node CLI or backend would swap each of those three for a host-native impl
while keeping tools + prompt + mentions + types unchanged.

## Recipe — Node CLI starter

Copy-pasteable skeleton. The CLI-side `streamFn` pattern is the only
non-obvious piece; everything else is wiring you'd do anyway.

```ts
// cli-main.ts
import { Agent, type StreamFn } from "@mariozechner/pi-agent-core";
import {
  streamSimple,
  type Model,
} from "@mariozechner/pi-ai";
import {
  createFsTools,
  buildSystemPrompt,
  InMemoryFsProvider,
  InMemoryChatStore,
  resolveMentions,
} from "./agent-kit"; // or your own alias

// 1. Build a FileSystemProvider. For real CLI use, replace with a node:fs
//    adapter that maps an on-disk cwd to virtual /vault paths; the interface
//    is the same. InMemoryFsProvider is great for tests + first runs.
const fs = new InMemoryFsProvider({ cwd: "/vault", name: "demo" });
await fs.writeFile("/vault/README.md", "# Demo Project\nHello.");

// 2. Build a ChatStore. InMemoryChatStore is zero-dep; a real CLI might
//    persist to better-sqlite3 or plain JSONL.
const chatStore = new InMemoryChatStore();
const session = await chatStore.createSession(fs.name);

// 3. Build a model + streamFn. pi-ai's streamSimple works in any runtime
//    with fetch (Node 18+). Provide baseUrl + apiKey per your provider.
const model: Model = {
  id: "claude-sonnet-4-5",
  api: "anthropic",          // or "openai", "bodhi", ...
  baseUrl: "https://api.anthropic.com",
  apiKey: process.env.ANTHROPIC_API_KEY!,
  // ... plus model-specific fields (temperature, maxTokens, etc.)
} as Model;

const streamFn: StreamFn = async (params, onEvent, signal) =>
  streamSimple({ ...params, model }, onEvent, signal);

// 4. Wire the agent with the kit's tools + prompt.
const agent = new Agent({
  streamFn,
  systemPrompt: buildSystemPrompt({ rootDirName: fs.name }),
  tools: createFsTools(fs),
});

// 5. Optional: resolve @path mentions server-side before sending.
const userText = "What does @README.md describe?";
const expanded = await resolveMentions(fs, userText);

// 6. Run a turn. Persist messages as they close out.
await agent.prompt(expanded, {
  onEvent: async (event) => {
    if (event.type === "message_end" || event.type === "turn_end") {
      const latest = agent.state.messages.at(-1);
      if (latest) await chatStore.appendMessage(session.id, latest);
    }
  },
});

console.log(agent.state.messages.at(-1));
```

## What the recipe demonstrates

- `createFsTools(fs)` returns the full `[fs__read, fs__write, fs__ls,
  fs__edit]` quartet over whichever `FileSystemProvider` you pass — the
  same tools the browser agent uses.
- `buildSystemPrompt({ rootDirName })` is the **canonical** system prompt
  for the kit. Host wrappers may prepend/append, but the tool rules live in
  the kit.
- `InMemoryFsProvider` + `InMemoryChatStore` let you boot without any extra
  dependencies. Swap each for a production impl when you need durability.
- `resolveMentions(fs, text)` inlines `@path` file contents into the user
  message, using the same caps (20KB per file, 40KB global) the browser UI
  uses. Wire it in ahead of `agent.prompt(text)`.

## Keep the kit clean

If you fork this into a separate package, maintain these invariants:

- No `react`, `react-dom`, or any UI library in `agent-kit/`.
- No `@zenfs/*`, `dexie`, `nanoid` (these are host-specific concerns — put
  them in your own adapter package).
- All host-specific features (filesystem, storage, transport, model config)
  enter via port parameters, never via direct imports.

`scripts/check-import-boundaries.mjs` in this repo demonstrates a
zero-dep CI check that enforces the forbidden list; adapt it to your
package layout.
