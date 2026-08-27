# Architecture & Types

[← Back to 01. Overview & Analysis](./01-overview-and-analysis.md) | [Next: 03. API Reference →](./03-api-reference.md)

---

## Message Structure

`@actdim/msgmesh` structures all messaging around a 3-level hierarchy:

### 1. Channels
Channels organize messages by domain, service, or event type. Dot notation is recommended for namespacing (e.g. `'API.USER.GET'`, `'APP.NAV.GOTO'`).

- **System Channel**: `MSGBUS.ERROR` is reserved for system-level errors.

### 2. Groups
Groups define payload roles within a channel. There are two semantic kinds:

- **Input Groups** (`in`, `in1`, `in2`): Payload types entering the channel. Default is `"in"`. Multiple input groups enable **input type overloading** on a single channel.
- **Output Group** (`out`): Response payload type returned by the channel handler.
  - If `out` is omitted, `out?: void` is implied (handler confirmation with no return data).
  - Do NOT wrap `out` types in `Promise` — async resolution is handled automatically by the API.

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

[← Back to 01. Overview & Analysis](./01-overview-and-analysis.md) | [Next: 03. API Reference →](./03-api-reference.md)

