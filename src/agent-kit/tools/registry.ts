/**
 * createFsTools — registry factory for the agent-kit filesystem tools.
 *
 * Later phases will extend this list with fs__write, fs__ls, fs__edit, etc.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { FileSystemProvider } from "./fs-provider";
import { createReadTool } from "./read";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FsTool = AgentTool<any>;

export function createFsTools(fs: FileSystemProvider): FsTool[] {
  return [createReadTool(fs)];
}
