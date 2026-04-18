/**
 * parseMentions — extract `@path` tokens from free-form user text.
 *
 * The grammar is intentionally small:
 *   - A mention must be preceded by whitespace or start-of-string.
 *   - The path may contain `[a-zA-Z0-9_./\-]` characters.
 *   - The mention ends at whitespace, end-of-string, or a trailing punctuation
 *     character that is unlikely to be part of a real path (, ; : ! ? )).
 *
 * Kept in agent-kit so it is reusable in CLI/backend contexts that don't have
 * React or any DOM bindings. Zero dependencies.
 */

export interface ParsedMention {
  /** The raw text, unmodified — callers rely on this for message display. */
  display: string;
  /** Deduped list of mentioned paths in the order they first appeared. */
  mentions: string[];
}

const MENTION_RE = /(?:^|\s)@([a-zA-Z0-9_./-]+?)(?=\s|$|[,;:!?)])/g;

export function parseMentions(text: string): ParsedMention {
  const mentions: string[] = [];
  const seen = new Set<string>();
  if (typeof text !== "string" || text.length === 0) {
    return { display: text ?? "", mentions };
  }
  // Reset RegExp lastIndex guard via a fresh iteration.
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, MENTION_RE.flags);
  while ((match = re.exec(text)) !== null) {
    const path = match[1];
    if (!path) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    mentions.push(path);
  }
  return { display: text, mentions };
}
