/**
 * Shared helpers for @-file-mention rendering.
 *
 * Lives in its own file so FileMentionPopup.tsx remains a component-only
 * module (required by eslint's react-refresh rule).
 */

export function sanitizeMentionPath(path: string): string {
  return path.replace(/[/.]/g, "-");
}
