import type { ToolRenderer } from "./types";
import { DefaultToolRenderer } from "./DefaultToolRenderer";

const registry = new Map<string, ToolRenderer>();

export function registerToolRenderer(
  name: string,
  renderer: ToolRenderer,
): void {
  registry.set(name, renderer);
}

export function getToolRenderer(name: string): ToolRenderer {
  return registry.get(name) ?? DefaultToolRenderer;
}
