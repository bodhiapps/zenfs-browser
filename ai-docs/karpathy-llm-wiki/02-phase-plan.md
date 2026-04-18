# Phase plan — one-page index

The canonical plan lives **outside this repo** at
`/Users/amir36/.claude/plans/we-want-to-evolve-purring-ocean.md`. It covers the
rationale, sub-agent delegation prompts, open risks, and the full
per-phase specs. This file is the short pointer + commit-hash index.

For the authoritative architectural review log (written as each phase landed),
see `review-notes.md` in this same folder.

## Phase index

| Phase | Goal                                                      | Commit    | Test added / extended                                      |
| ----- | --------------------------------------------------------- | --------- | ---------------------------------------------------------- |
| 0     | Scaffold 3 layers + ESLint `no-restricted-imports` rules  | `f39be23` | None (existing `chat.spec.ts` + `file-browser.spec.ts` must stay green) |
| 1     | ZenFS mount at `/vault` + `span-vault-status` indicator   | `5831de3` | One new step added to `e2e/file-browser.spec.ts`           |
| 2     | `fs__read` tool + tool-call/result bubbles + agent wiring | `bfdff54` | New: `e2e/agent-fs.spec.ts`                                |
| 3     | `fs__write`, `fs__ls`, `fs__edit` tools                   | `9e0c8e3` | New: `e2e/agent-fs-mutation.spec.ts`                       |
| 4     | ChatStore interface + Dexie adapter + session list        | `be7b9e7` | New: `e2e/chat-persistence.spec.ts`                        |
| 5     | `@path` mention popup + inline resolution                 | `cb5e238` | New: `e2e/file-mention.spec.ts`                            |
| 6     | Docs + import-boundary audit + architecture README        | (this)    | None (gate is `npm run check:arch` + prior 7 tests green)  |

Intermediate tidy commit landed between Phase 2 and Phase 3: `f438e97`
("fix: track useBodhiModels.ts imported in Phase 2").

## How to dive deeper

- **What changed file-by-file in a given phase** → open `review-notes.md`
  and jump to the matching `## Phase N` section. Each section lists new files,
  retired files, ESLint/test gate results, and any plan-deviations.
- **Why a decision was made** → open the canonical plan
  (`/Users/amir36/.claude/plans/we-want-to-evolve-purring-ocean.md`) — it has
  the original rationale and open-risk list.
- **What a tool does today** → `03-tool-specs.md`.
- **How to reuse `agent-kit` outside the browser** → `04-portable-kit-reuse.md`.
- **What's still karpathy-shaped vs ported** → `00-feature-comparison.md`.
- **Where imports are allowed to go** → `01-architecture-mapping.md`, plus
  `eslint.config.js` and `scripts/check-import-boundaries.mjs` for
  machine-checkable versions.

## Test gate at each phase

Every phase commit had to satisfy:

1. `npm run build` clean.
2. `npm run lint` clean (including the per-layer `no-restricted-imports`).
3. `npm run ci:test:e2e` green with the current test count.
4. No new `any`, no `// @ts-ignore`, no `TODO: revisit` without a tracking
   note.
5. Architectural review bullet appended to `review-notes.md`.

As of Phase 6, total e2e count is **7 tests** across 6 spec files
(`file-browser.spec.ts` holds 2; the rest one each).
