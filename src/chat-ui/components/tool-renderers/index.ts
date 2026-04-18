import { registerToolRenderer } from "./registry";
import { FsReadRenderer } from "./FsReadRenderer";

export { registerToolRenderer, getToolRenderer } from "./registry";
export type { ToolRenderer } from "./types";
export { DefaultToolRenderer } from "./DefaultToolRenderer";
export { FsReadRenderer };

/** Register built-in renderers. Called once at module load. */
export function registerBuiltInRenderers(): void {
  registerToolRenderer("fs__read", FsReadRenderer);
}
