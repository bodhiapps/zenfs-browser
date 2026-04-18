// agent-kit — portable agent core.
//
// Layer contract:
//   - This layer must NOT import from: react, @zenfs/*, dexie, @bodhiapp/*,
//     ../adapters/**, ../chat-ui/**.
//   - Allowed deps: @mariozechner/pi-agent-core, @mariozechner/pi-ai,
//     @sinclair/typebox, and standard web/node-safe utilities only.
//
// See ./README.md for how this kit is designed to be reused (CLI, backend).

export * from "./tools";
export * from "./agent";
