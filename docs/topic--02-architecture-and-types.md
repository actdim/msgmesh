---
protocol: along
slug: 02-[architecture](./topic--architecture.md)-and-types
title: Architecture & Types
type: topic
created: 2026-08-31
updated: 2026-09-02
tags: [02-architecture-and-types]
---

# Architecture & Types

[← Back to 01. Overview & Analysis](./topic--01-overview-and-analysis.md) | [Next: 03. API Reference →](./topic--03-api-reference.md)

---

## Message Structure

`@actdim/msgmesh` structures all messaging around a 3-level hierarchy:

### 1. Channels
Channels organize messages by domain, service, or event type. Dot notation is recommended for namespacing (e.g. `'API.USER.GET'`, `'APP.NAV.GOTO'`).

- **System Channel**: `MSGBUS.ERROR` is reserved for system-level errors.

### 2. Groups (`in`, `out`, `ex`)
Groups define payload roles and delivery semantics within a channel:

- **Inbound / Request Group (`in`, `in1`, `in2`)**:
  - Payload entering the channel for request-response RPC.
  - Used with `msgBus.request({ channel, group: 'in', payload })` and `msgBroker.provide`.
  - Multiple input groups (`in1`, `in2`) enable **input type overloading** on a single channel.
- **Outbound / Response / Event Group (`out`)**:
  - The return type returned by a `provide()` callback.
  - Also represents broadcast domain events consumed by subscribers (`msgBus.on` or `msgBroker.subscribe`).
  - If `out` is omitted in a channel definition, `out?: void` is implied.
  - Do NOT wrap `out` types in `Promise` - async resolution is handled automatically.
- **Execution / Command Group (`ex`, `ex1`)**:
  - Command payloads for direct fire-and-forget actions where callers dispatch intent rather than waiting for an RPC response.
  - Typical examples: `APP.NAV.GOTO` with `ex: { route: string, params?: any }` dispatched via `msgBus.send({ channel: 'APP.NAV.GOTO', group: 'ex', payload })`.

### 3. Message Types
Each group declares a TypeScript type. Use `MsgStruct<...>` to wrap your channel dictionary.

---

## Type Definition Example

```typescript
import { MsgStruct } from '@actdim/msgmesh';

export type AppBusStruct = MsgStruct<{
    'USER.COMPUTE_SUM': {
        in: { a: number; b: number };
        out: number;
    };
    'USER.LOGOUT': {
        in: { reason: string };
        out: void;
    };
    'APP.NAV.GOTO': {
        in: { path: string };
        ex: { route: string; params?: Record<string, any> };
    };
    'MULTIPLEXER.CALCULATE': {
        in1: string;
        in2: number;
        out: number;
    };
}>;
```

---

## `send()` vs `request()`

- **`send()` (Fire-and-forget)**: Publishes to the input group and returns immediately. Does not wait for handlers. Use for notifications and events.
- **`request()` (RPC Awaited Response)**: Publishes to the input group and **awaits the `out` response** from a registered provider (`provide()`). Even when `out: void`, `request()` confirms that the handler finished executing.

---

## Bus Instantiation & Headers

Create a typed message bus instance:

```typescript
import { createMsgBus, MsgBus } from '@actdim/msgmesh';

// Basic bus instantiation
export const msgBus = createMsgBus<AppBusStruct>();

// Bus with custom headers
type CustomHeaders = {
    userId?: string;
    correlationId?: string;
};

export const scopedMsgBus = createMsgBus<AppBusStruct, CustomHeaders>();
```

### Scope & Structure Composition

A single message bus instance can handle messages across multiple channel structures as long as channel names are unique:

```typescript
type UnifiedBusStruct = ComponentBusStruct & ApiBusStruct;
const globalBus = createMsgBus<UnifiedBusStruct>();
```

---

[← Back to 01. Overview & Analysis](./topic--01-overview-and-analysis.md) | [Next: 03. API Reference →](./topic--03-api-reference.md)
