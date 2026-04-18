# Feature comparison — karpathy-llm-wiki × zenfs-browser

Baseline: Andrej Karpathy's "LLM Wiki" pattern treats the LLM as a compiler that
turns raw sources into a hand-architected interlinked markdown knowledge base.
All reference implementations assume a **local CLI** (Claude Code, Codex) with
direct filesystem access. The evolution tracked by the plan at
`/Users/amir36/.claude/plans/we-want-to-evolve-purring-ocean.md` brings the core
of that pattern into the browser, one phase at a time.

Columns:

- **karpathy-llm-wiki** — the upstream reference implementation
  (`BodhiSearch/karpathy-llm-wiki/`), CLI-driven.
- **zenfs-browser (before)** — this repo at `3fabf0b` (before Phase 0), an
  FSA-backed browser app with a Bodhi-proxied chat loop but **zero tools** and
  **no chat persistence**.
- **zenfs-browser (post Phase 5)** — this repo at the head of Phase 5
  (`cb5e238`).

Legend: `Yes` = shipped, `No` = not present, `Planned for M2+` = explicitly in
the plan's "later milestone" notes, `Out of scope` = intentionally not pursued.

| Feature                         | karpathy-llm-wiki | zenfs-browser (before) | zenfs-browser (post-Phase-5) |
| ------------------------------- | ----------------- | ---------------------- | ----------------------------- |
| Vault mount (local directory)   | Yes (CLI cwd)     | Yes (raw FSA, no mount) | Yes (FSA → ZenFS at `/vault`) |
| `fs__read` tool                 | Yes               | No                     | Yes                           |
| `fs__write` tool                | Yes               | No                     | Yes                           |
| `fs__ls` tool                   | Yes               | No                     | Yes (with `recursive?`)       |
| `fs__edit` tool                 | Yes               | No                     | Yes (1-indexed line range)    |
| Search tool (bm25 / semantic)   | Yes               | No                     | Planned for M2+               |
| `fetch_url` tool                | Yes               | No                     | Planned for M2+               |
| `extract_concepts` tool         | Yes               | No                     | Planned for M2+               |
| Chat persistence                | N/A (CLI log)     | No (in-memory only)    | Yes (Dexie, split-storage)    |
| Multi-session UI                | N/A               | No                     | Yes (ChatSessionList)         |
| `@path` file-mentions           | N/A (CLI)         | No                     | Yes (inline resolution)       |
| Autocomplete popup for mentions | N/A               | No                     | Yes (Fuse.js)                 |
| Tool renderer registry          | N/A (CLI text)    | No                     | Yes (one concrete renderer)   |
| Ingest skill                    | Yes               | No                     | Planned for M2+               |
| Compile skill                   | Yes               | No                     | Planned for M2+               |
| Query skill                     | Yes               | No                     | Planned for M2+               |
| Lint skill                      | Yes               | No                     | Planned for M2+               |
| Autoresearch loop               | Yes               | No                     | Planned for M2+               |
| Graph view                      | No                | No                     | Out of scope (M1)             |
| Schema editor                   | No                | No                     | Out of scope (M1)             |
| Markdown viewer with wikilinks  | Yes (renderer)    | Basic (FileViewer)     | Basic (Milkdown viewer)       |

## Notes on "Planned for M2+" rows

- **Search / fetch_url / extract_concepts**: the plan (lines 225 onward) ends
  Milestone 1 at the M1 tool quartet (`fs__read/write/ls/edit`). New tools plug
  into `src/agent-kit/tools/registry.ts` + `src/chat-ui/components/tool-renderers/registry.ts`
  without touching existing tool code. See `03-tool-specs.md` for the extension
  recipe.
- **Ingest / compile / query / lint skills + autoresearch**: karpathy's skill
  layer sits above the tools, orchestrating multi-step flows. The 3-layer
  architecture put in place during Phases 0–5 does not preclude this — a
  "skills" submodule would sit in `agent-kit/skills/` and call the same
  `createFsTools` kit.

## Notes on "Out of scope" rows

- **Graph view** and **schema editor** are features of a fuller knowledge-base
  IDE. They aren't CLI-karpathy features either; they'd be net-new surface in
  the browser client and were never on the M1 roadmap.

## Sources checked

- Before-state references (grep-level, pre-Phase-0):
  - `src/hooks/useAgent.ts:179` — `agent.state.tools = []`.
  - No `persistence/` / `chat-store` references.
- Post-Phase-5 references (this repo):
  - `src/agent-kit/tools/{read,write,ls,edit}.ts`
  - `src/agent-kit/persistence/chat-store.ts`,
    `src/adapters/browser/dexie-chat-store.ts`
  - `src/chat-ui/hooks/useFileMentions.ts`,
    `src/agent-kit/mentions/{parser,resolver}.ts`
  - `src/chat-ui/components/tool-renderers/registry.ts`
