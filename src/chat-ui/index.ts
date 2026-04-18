// chat-ui — React UI kit for the agent.
//
// Layer contract:
//   - Depends on ../agent-kit (types + interfaces) and React + UI libs.
//   - Must NOT import from ../adapters/** — the app wires adapters in via
//     props or context so this layer stays transport/storage-agnostic.
//   - The contracts/ subfolder defines UI-agnostic state/event types so a
//     CLI or other renderer can implement the same session shape.

export {};
