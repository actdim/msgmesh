---
protocol: along
protocol_version: "4.4.16"
slug: agent-native-metadata-and-contracts
type: task
status: open
priority: high
created: 2026-10-16
updated: 2026-10-16
agent: antigravity
tags: [agent, ai, msgmesh, metadata, llms]
milestone: v2.0.0-along-transition
parent: task--agent-native-ecosystem-standardization
blocked_by: []
related: []
---

# Agent-native metadata, bus contracts, and llms.txt guides for MsgMesh

## Purpose and Scope

`@actdim/msgmesh` serves as the communication backbone for applications and AI agents in the Actdim ecosystem.

Traditional frontend architectures rely on deep prop-drilling, scattered React Contexts, and brittle callback chains that cause AI agents to lose track of data flow across files. MsgMesh solves this by providing a strongly typed, channel-based service bus (`{ channel, group, topic }`). An agent can construct, inspect, or modify a UI component in total isolation because communication happens through decoupled, type-safe message contracts.

This task establishes agent-native manifests, `llms.txt` specifications, and code-level JSDoc contracts for `@actdim/msgmesh`.

---

## 1. Package Manifest (`package.json`)

Update the package manifest with agent-native metadata:

- **`description`**:
  ```text
  "High-performance, typed in-memory service bus for decoupled agent, microfrontend, and UI communication."
  ```

- **`keywords`**:
  Add agent and communication keywords:
  ```json
  [
    "agent-native",
    "ai-ready",
    "llm-friendly",
    "service-bus",
    "typed-events",
    "agent-communication",
    "event-driven-rpc",
    "pubsub",
    "rpc",
    "in-memory",
    "rxjs",
    "reactive",
    "type-safe",
    "microfrontends"
  ]
  ```

- **`ai` and `llms` fields**:
  Verify alignment with the ecosystem standard:
  ```json
  "llms": "./llms.txt",
  "ai": {
    "instructions": "./AGENTS.md",
    "docs": "./docs",
    "llms": "./llms.txt",
    "llms-full": "./llms-full.txt"
  }
  ```

- **`files` array**:
  Ensure `llms.txt`, `llms-full.txt`, and `AGENTS.md` are present for npm distribution.

---

## 2. Standardization of `llms.txt`

Restructure `llms.txt` following the llmstxt.org standard:

### Section A: Overview and Topology
Explain the role of MsgMesh as the decoupled messaging layer connecting UI components, background services, and AI agents.

### Section B: Golden Rules for AI Agents
1. **Address Tuple Structure**:
   Every message route requires `{ channel, group, topic }`. Always define topics as typed string literals rather than loose strings.
2. **RPC vs Pub/Sub Distinction**:
   - Use `mesh.request(address, payload)` with `mesh.handle(address, handler)` for 1-to-1 request-response RPC.
   - Use `mesh.publish(address, payload)` with `mesh.subscribe(address, callback)` for 1-to-many broadcast notifications.
   - Do NOT use `publish()` when an RPC response is expected.
3. **Lifecycle and Unsubscription**:
   Always unsubscribe or return teardown functions when a consuming component unmounts to prevent memory leaks and duplicate handler errors.
4. **Payload Serializability**:
   Keep message payloads strictly serializable (plain objects, primitives, DTOs). NEVER pass React elements, JSX, or unmanaged class instances across the bus.
5. **Service Adapter Pattern**:
   UI components must never call HTTP endpoints directly. Wrap backend interactions into registered MsgMesh service adapters, allowing agents to test UI against mock adapters cleanly.

### Section C: Canonical Implementation Template
Provide a complete, copy-pasteable pattern:

```ts
import { createMsgMesh, MsgAddress } from '@actdim/msgmesh';

// 1. Define typed address contract
export interface UserQueryPayload {
  userId: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export const USER_GET_ADDRESS: MsgAddress = {
  channel: 'data',
  group: 'users',
  topic: 'get-by-id',
};

// 2. Initialize mesh
const mesh = createMsgMesh();

// 3. Register service handler (RPC)
mesh.handle<UserQueryPayload, UserDto>(USER_GET_ADDRESS, async (payload) => {
  return {
    id: payload.userId,
    name: 'Alice',
    email: 'alice@example.com',
  };
});

// 4. Request from UI or agent
const user = await mesh.request<UserQueryPayload, UserDto>(USER_GET_ADDRESS, {
  userId: 'u-123',
});

// 5. Broadcast notification (Pub/Sub)
const USER_LOGGED_IN: MsgAddress = {
  channel: 'events',
  group: 'auth',
  topic: 'logged-in',
};

mesh.publish(USER_LOGGED_IN, { userId: 'u-123' });
```

---

## 3. In-Source JSDoc Annotations

Enhance exported methods in `src/`:
- **`createMsgMesh`**: Document initialization options.
- **`request`**: Add `@example` demonstrating typed RPC calls.
- **`handle`**: Add `@agentNotice` warning against duplicate handler registrations for the same address.
- **`publish` / `subscribe`**: Document broadcast semantics and RxJS observable teardown.

---

## Acceptance Criteria

- [ ] `package.json` updated with agent-native description and keywords.
- [ ] `llms.txt` conforms to llmstxt.org with Golden Rules and canonical RPC/PubSub snippets.
- [ ] Core bus methods annotated with `@example` and `@agentNotice` JSDoc tags.
- [ ] Vitest test suite passes without errors (`pnpm test`).
