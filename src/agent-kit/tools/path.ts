/**
 * Minimal path utilities for the agent-kit tools.
 *
 * Keep this file tiny: no imports, no host dependencies. The tools use these
 * helpers to normalize paths against a FileSystemProvider's cwd (e.g. /vault).
 */

export function resolvePath(cwd: string, p: string): string {
  if (!p || p === ".") return cwd;
  if (p.startsWith("/")) return p;
  return `${cwd}/${p}`.replace(/\/+/g, "/");
}

export function joinPath(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/");
}
