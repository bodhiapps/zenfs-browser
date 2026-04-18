/**
 * createFsTools — registry factory for the agent-kit filesystem tools.
 *
 * Flat list of tool factories; each tool is a leaf module with no implicit
 * coupling to the others. Host apps receive the full quartet.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { FileSystemProvider } from "./fs-provider";
import { createReadTool } from "./read";
import { createWriteTool } from "./write";
import { createLsTool } from "./ls";
import { createEditTool } from "./edit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FsTool = AgentTool<any>;

export function createFsTools(fs: FileSystemProvider): FsTool[] {
  return [
    createReadTool(fs),
    createWriteTool(fs),
    createLsTool(fs),
    createEditTool(fs),
  ];
}
