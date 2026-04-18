// adapters/browser — browser-specific implementations of agent-kit interfaces.
//
// Layer contract:
//   - This layer IMPLEMENTS interfaces defined in ../../agent-kit.
//   - Imports from @zenfs/core, @zenfs/dom, dexie, and agent-kit are expected.
//   - Must NOT be imported from chat-ui (the app wires adapters into chat-ui
//     via props/ports, not via direct imports).

export {};
