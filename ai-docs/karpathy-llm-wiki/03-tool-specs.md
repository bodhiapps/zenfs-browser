# `fs__*` tool specs

Ground truth for each tool is in `src/agent-kit/tools/{read,write,ls,edit,fs-provider}.ts`.
This file is a cross-reference for adding new tools or new renderers later.

All tools share a shape: a factory `createXTool(fs: FileSystemProvider)`
returning an `AgentTool<Schema>` from `@mariozechner/pi-agent-core`. Paths
resolve under `fs.cwd` via `resolvePath()` (see `src/agent-kit/tools/path.ts`),
so callers can pass either `/vault/README.md` or `README.md`.

## The `FileSystemProvider` interface

`src/agent-kit/tools/fs-provider.ts`. This is the port the tools consume. An
adapter (`ZenFsProvider` for the browser; `InMemoryFsProvider` for tests /
CLI) implements it.

```ts
interface FileSystemProvider {
  readonly cwd: string;            // e.g. "/vault"
  readonly name: string;           // display name, e.g. handle.name
  readFile(absolutePath: string): Promise<Uint8Array>;
  writeFile(absolutePath: string, content: string): Promise<void>;
  exists(absolutePath: string): Promise<boolean>;
  isDirectory(absolutePath: string): Promise<boolean>;
  readdir(absolutePath: string): Promise<string[]>;   // names, not full paths
  mkdir(absolutePath: string): Promise<void>;         // recursive, idempotent
}
```

All inputs are **virtual absolute paths**. `mkdir` must succeed if the
directory already exists.

---

## `fs__read`

**Source**: `src/agent-kit/tools/read.ts`

**Signature**: `fs__read(path: string, offset?: number, limit?: number)` —
offset/limit are 1-indexed lines.

**Description shown to the LLM**:

> Read a text file from the user's vault. Returns UTF-8 content and line
> count. Output is capped at 2000 lines; use offset+limit for larger files.
> Absolute paths (/vault/…) and relative paths (README.md) both resolve under
> the vault root.

**Result shape**:

```ts
{
  content: [{ type: "text", text: string }],  // the content, with truncation footer
  details: { path: string, lines: number, truncated: boolean }
}
```

**Error cases** (thrown as `Error` — surfaced to the agent as a tool failure):

- `File not found: <path>`
- `Path is a directory: <path>. Use fs__ls instead.`
- `offset N is beyond end of file (M lines)`
- `Operation aborted` (when `signal?.aborted`)

**Truncation behavior**: when `endIdx < totalLines`, the text gets
`\n\n[Showing lines A-B of N. Use offset=<B+1> to continue.]` appended.

---

## `fs__write`

**Source**: `src/agent-kit/tools/write.ts`

**Signature**: `fs__write(path: string, content: string)`.

**Description**:

> Write content to a file in the user's vault. Creates the file if it does
> not exist, overwrites if it does. Parent directories are created
> automatically. Absolute paths (/vault/…) and relative paths (notes.md)
> both resolve under the vault root.

**Result shape**:

```ts
{
  content: [{ type: "text", text: "Wrote N bytes to <path>" }],
  details: { path: string, bytesWritten: number }
}
```

**Error cases**:

- `Operation aborted`
- Provider-level failures bubble up verbatim (e.g. ZenFS quota errors).

Parent directories are created via `fs.mkdir(parentDir)` before
`fs.writeFile(...)`. The provider contract requires `mkdir` to be recursive
and idempotent.

---

## `fs__ls`

**Source**: `src/agent-kit/tools/ls.ts`

**Signature**: `fs__ls(path?: string, limit?: number, recursive?: boolean)` —
defaults: `path = fs.cwd`, `limit = 500`, `recursive = false`.

**Description**:

> List directory contents in the user's vault. Returns entries sorted
> alphabetically; directories are marked with trailing '/'. Default path:
> /vault. Set recursive=true for a BFS walk (depth<=4, entries<=500);
> recursive entries include their relative path.

**Result shape**:

```ts
{
  content: [{ type: "text", text: string }],   // newline-joined entries
  details: {
    path: string,
    entries: string[],
    truncated: boolean,
    recursive: boolean
  }
}
```

**Error cases**:

- `Path not found: <path>`
- `Not a directory: <path>`
- `Operation aborted`

**Recursive mode**: BFS queue with `RECURSIVE_DEPTH_CAP=4` and
`RECURSIVE_ENTRY_CAP=500`. Entries are emitted as paths **relative to the
listed directory** (`docs/guide.md`, `src/`), directories keep the trailing
`/`. Individual per-child `isDirectory`/`readdir` failures are swallowed (the
walk continues) to keep listings robust against symlinks or permission quirks.

---

## `fs__edit`

**Source**: `src/agent-kit/tools/edit.ts`

**Signature**: `fs__edit(path, startLine, endLine, content)` — all line
numbers 1-indexed inclusive.

**Description**:

> Edit a text file by replacing a range of lines with new content. Line
> ranges are 1-indexed inclusive. Pass endLine = startLine - 1 to insert
> content without replacing. Call fs__read first so your line numbers are
> correct.

**Insert-without-replace rule**: `endLine === startLine - 1` means "insert
`content` before line `startLine`, don't replace anything".

**Result shape**:

```ts
{
  content: [{ type: "text", text: "Edited <path>: replaced A line(s) with B new line(s)" }],
  details: {
    path: string,
    startLine: number,
    endLine: number,
    replacedLines: number,
    newLines: number
  }
}
```

**Error cases**:

- `File not found: <path>`
- `Path is a directory: <path>. fs__edit operates on files only.`
- `startLine must be >= 1, got N`
- `endLine (X) must be >= startLine-1 (Y)`
- `endLine N is beyond end of file (M lines)` — replacement mode only
- `startLine N is beyond end of file (M lines)`
- `Operation aborted`

---

## Adding a new tool

1. Write `src/agent-kit/tools/<name>.ts` with a `createXTool(fs)` factory
   returning `AgentTool<Schema>`. Follow the existing size ceiling (≤110
   lines).
2. Export it from `src/agent-kit/tools/index.ts`.
3. Register it in `createFsTools(fs)` in `src/agent-kit/tools/registry.ts`.
4. Update `buildSystemPrompt` in `src/agent-kit/agent/prompt.ts` to describe
   the new tool + any rules it needs.
5. Optionally add a renderer under `src/chat-ui/components/tool-renderers/`
   and register it via `registerToolRenderer(name, renderer)`. Absent a
   custom renderer, `DefaultToolRenderer` handles the tool-result bubble.
6. Extend or add an e2e journey so at least one test exercises the new tool
   end-to-end through the UI.

No tool may import React, ZenFS, Dexie, or `@bodhiapp/*`.
`scripts/check-import-boundaries.mjs` + `eslint no-restricted-imports` will
fail CI if a tool violates the agent-kit forbidden list.
