---
protocol: along
slug: 04-advanced-patterns
title: Advanced Patterns & Adapters
type: topic
created: 2026-08-31
updated: 2026-11-08
tags: [04-advanced-patterns]
---

# Advanced Patterns & Adapters

[← Back to 03. API Reference](./topic--03-api-reference.md) | [Back to Main README](../README.md)

---

## Advanced Features

### 1. Message Replay
Replay past messages to new subscribers when subscribing late:

```typescript
const msgBus = createMsgBus<AppBusStruct>({
    'CHAT.HISTORY': {
        replayBufferSize: 10, // Keep last 10 messages in memory for new subscribers
        replayWindowTime: 60000, // Replay window of 60 seconds
    },
});
```

### 2. Throttling, Debouncing, and Delay
Channels and subscriptions can configure rate-limiting, batching, and delivery timing:

```typescript
// Channel-level configuration
const msgBus = createMsgBus<AppBusStruct>({
    'UI.SEARCH_INPUT': {
        debounce: 300, // Wait for 300ms of silence before delivery
    },
    'SCROLL.EVENT': {
        throttle: 100, // Throttle to at most one message per 100ms
        // Or with detailed leading/trailing options:
        // throttle: { duration: 100, leading: true, trailing: false },
    },
    'AUDIT.LOG': {
        delay: 50, // Delay message delivery by 50ms
    },
    'API.SLOW_ENDPOINT': {
        timeout: 10000, // 10s default timeout for this channel instead of global default
    },
});

// Subscription-level configuration (overrides/augments channel config)
msgBus.on({
    channel: 'UI.SEARCH_INPUT',
    options: {
        debounce: 200,
        throttle: { duration: 100, leading: true, trailing: true },
    },
    callback: (msg) => {
        console.log('Debounced search query:', msg.payload);
    },
});
```

### 3. Chain of Responsibility
Handlers can choose to process or skip messages by setting `msgOut.status = 'skipped'`, allowing downstream handlers to handle the message.

```typescript
msgBus.provide({
    channel: 'AUTH.VALIDATE',
    callback: (msg, msgOut) => {
        if (!canHandle(msg.payload)) {
            msgOut.status = 'skipped';
            return;
        }
        return true; // or return payload directly
    },
});
```

### 4. Headers and Metadata
Attach cross-cutting tracking metadata (correlation IDs, auth tokens, client metrics) to any message:

```typescript
msgBus.send({
    channel: 'USER.UPDATE',
    payload: { name: 'Bob' },
    headers: {
        correlationId: 'req-98765',
        timestamp: Date.now(),
    },
});
```

### 5. Flow Control (Backpressure)
By default `send()` publishes and resolves at once, so a fast producer can flood a slow provider. Channel-level `flowControl` limits how many messages sent to the channel's input groups may wait for an `out` answer at the same time (credit-based flow control for the `in` / `out` pair). Opt-in per channel; channels without it keep the old code path.

```typescript
const msgBus = createMsgBus<AppBusStruct>({
    'MEDIA.THUMBNAIL.RENDER': {
        flowControl: {
            maxInFlight: 4, // at most 4 unanswered messages
            overflow: 'wait', // 'wait' (default, FIFO) or 'error' (ChannelBusyError)
            leaseTimeout: 30000, // force-release a slot after 30 s without an answer
        },
    },
    // or for a whole family of channels
    '*': (channel) => (channel.startsWith('API.') ? { flowControl: { maxInFlight: 8 } } : {}),
});

// The producer slows down to the provider's pace: each await waits for a free slot.
for (const id of mediaIds) {
    await msgBus.send({ channel: 'MEDIA.THUMBNAIL.RENDER', payload: id });
}
```

**Taking a slot**: `send()`, `request()` and `requestStream()` take a slot before publishing. With `overflow: 'wait'` the call waits in FIFO order (a released slot goes to the oldest waiter, new callers cannot overtake). With `overflow: 'error'` it rejects with `ChannelBusyError` (`isChannelBusyError()`).

**Releasing a slot** (whichever comes first):
- an `out` message with `inResponseToId === requestId`, any status (`handled`, or `failed` when the provider throws); for `requestStream()` the first response releases the slot;
- provider-side cancel (`msgOut.status = 'canceled'`);
- `leaseTimeout` (default: channel `timeout` ?? 5 s) - the safety net for silent providers;
- no subscriber at publish time - released immediately.

A `skipped` message does not release its slot (the next provider in the chain answers). If all providers skip, or the channel has only `on()` subscribers (they never answer in `out`), the slot is held until `leaseTimeout`. Auto-ack for these cases is planned (`feat--ack-nack-support`).

**Never gated**: publishes to `out` and `error`, `MSGBUS.ERROR`, and cancel messages sent by `request()` on abort. This is what keeps a provider that itself calls `request()` on another limited channel from deadlocking.

**Waiting limits**:
- `send()`: `options.timeout` -> `TimeoutError`, `options.abortSignal` -> `OperationCanceledError`. The waiter leaves the queue and never holds a slot.
- `request()`: `options.sendTimeout` bounds slot waiting; the overall `options.timeout` still applies, and when it fires a still-waiting request is removed from the queue (it is never published later).
- `requestStream()`: `options.timeout` and `abortSignal`; an abort while waiting ends the stream quietly.

**Fire-and-forget safety**: on a flow-controlled channel an unawaited `send()` never produces an unhandled rejection. Gate errors (except cancellation) are reported to the channel `error` group and `MSGBUS.ERROR` (topic `$SYSTEM_TOPIC`); awaiting callers still get the rejection, so they see the error twice.

**Diagnostics**: `msgBus.getFlowStats(channel)` returns `{ limit, inFlight, waiting, leases }`, or `undefined` for channels without flow control.

**When to use**: API adapter channels backed by a rate-sensitive backend, Web Worker and remote providers, heavy media jobs. Not needed for UI events. Transport-level buffering of `@actdim/msgmesh-remote` sockets is a separate concern (`bufferedAmount`), see that package.

---

## Dynstruct UI Integration & Pure Event-Driven Architecture

When building large-scale frontend applications with `@actdim/dynstruct` and `@actdim/msgmesh`, MsgMesh serves as the single source of truth for all cross-component, cross-view, and navigation coordination.

### 1. Single Source of Truth for Cross-Component Events

Classical React architectures rely heavily on callback prop drilling (`onSelect*`, `onNavigate*`, `onClose*`, `onChange*`). In non-trivial applications, passing callbacks creates dual sources of truth, timing races, and state desynchronization.

In the Dynstruct + MsgMesh architecture:
- **Zero Callback Props**: Never pass callback props between Dynstruct components to coordinate state.
- **Strict Role Separation**:
  - Component `props` are strictly for component configuration and reactive bindings (`bindProp`).
  - Component `actions` are internal model mutators (atomic MobX transactions) for component-local state. They are NOT cross-component callbacks.
  - All cross-component, cross-feature, navigation, and domain coordination MUST flow through typed MsgMesh channels (`c.msgBus.send`, `msgBroker.subscribe`).

### 2. Replay Buffer Pattern for UI State Hydration

In UI applications with dynamic view rendering, tabbed layouts, or lazy-loaded components (e.g. media players, document readers, detail panes), an event (such as selecting an item or navigating to a path) may be published before a lazy view is mounted.

Standard event buses drop messages if no subscriber is active at the exact moment of dispatch. MsgMesh solves this with configurable message replay:

```typescript
import { createMsgBus } from '@actdim/msgmesh';

export const msgBus = createMsgBus<AppMsgStruct>({
    'APP.VFS.NAVIGATE': {
        replayBufferSize: 1, // Keep the latest navigation event in memory
        replayWindowTime: Infinity,
    },
    'APP.VFS.SELECT_FILE': {
        replayBufferSize: 1, // Keep the latest active file selection
        replayWindowTime: Infinity,
    },
});
```

When a lazy-loaded or late-mounting component registers its subscription in `msgBroker.subscribe`, MsgMesh immediately delivers the buffered message. The component hydrates its local model instantly without requiring parent prop drilling or global store sync.

### 3. Modular Bus Slicing

Rather than declaring all application events in a single monolithic file, domain features define their own channel slices:

```typescript
// features/vfs-explorer/vfsMsgStruct.ts
import { type MsgStruct } from '@actdim/msgmesh/contracts';

export type VfsLocalChannels = {
    'APP.VFS.NAVIGATE': {
        in: { driveId: string; path: string };
        out: void;
    };
    'APP.VFS.SELECT_FILE': {
        in: { fileNode: any | null };
        out: void;
    };
};

export type VfsMsgStruct = MsgStruct<VfsLocalChannels>;
```

The application root composes modular slices into the unified application bus contract using TypeScript intersection types:

```typescript
// config/appConfig.ts
export type AppMsgStruct = BaseAppMsgStruct &
    ApiMsgStruct &
    VfsMsgStruct &
    AuthMsgStruct;
```

This guarantees 100% compile-time autocomplete and type safety across all components while keeping feature modules completely decoupled.

---

## Service Adapters (NSwag / OpenAPI / gRPC Automation)

The `@actdim/msgmesh/adapters` module automatically transforms standard TypeScript service classes (such as NSwag-generated REST API clients, gRPC clients, or custom service classes) into typed message bus providers at compile-time.

### Strict Rules for Backend / API Client Integration:
1. **Zero Manual Channels for API**: When connecting REST, FastAPI, OpenAPI, Swagger, or gRPC endpoints to MsgMesh, **NEVER** write manual `MsgStruct` channel maps (`{ in: ..., out: ... }`) and **NEVER** write manual `fetch` / `axios` handlers inside `provide()`.
2. **Always Use Service Adapters**: Use NSwag, OpenAPI, or gRPC generated client classes combined with `ToMsgChannelPrefix`, `ToMsgStruct`, and `registerAdapters`.
3. **String Literal in `ToMsgChannelPrefix`**: Always pass an explicit string literal type (e.g. `'DashboardApiClient'`) as the first argument:
   ```typescript
   export type DashboardChannelPrefix = ToMsgChannelPrefix<'DashboardApiClient', 'API'>;
   ```
   **Important**: Do NOT pass `typeof Class.name` without `as const`, because in standard TypeScript `Class.name` has type `string`, which evaluates to a generic `${string}` and breaks compile-time literal channel resolution.

### How It Works:
1. Every public method on a service class becomes a channel name (e.g. `getUser` on `UserServiceClient` with prefix `'API.USER.'` becomes `'API.USER.GETUSER'`).
2. Input argument types become a typed tuple for `in` payload (`Parameters<Method>`).
3. Return type becomes the `out` payload (`ReturnType<Method>`).
4. `getMsgChannelSelector(services)` and `registerAdapters(msgBus, adapters, signal)` wire all methods to the bus automatically.

### Complete Example (Class-based):

```typescript
import { createMsgBus } from '@actdim/msgmesh';
import {
    ToMsgChannelPrefix,
    ToMsgStruct,
    getMsgChannelSelector,
    registerAdapters,
    type MsgProviderAdapter,
} from '@actdim/msgmesh/adapters';

// 1. Any regular service class (no static properties or special base class required)
export class UserServiceClient {
    getUser(id: string): Promise<{ id: string; name: string }> {
        return fetch(`/api/users/${id}`).then((r) => r.json());
    }

    updateUser(id: string, name: string): Promise<boolean> {
        return fetch(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name }),
        }).then((r) => r.ok);
    }
}

// 2. Generate prefix: 'UserServiceClient' + 'API' -> 'API.USER.' (suffix 'Client' is stripped automatically)
type UserPrefix = ToMsgChannelPrefix<'UserServiceClient', 'API'>; // 'API.USER.'

// 3. Automatically compile-time map methods to typed bus struct:
//    - 'API.USER.GETUSER': { in: [id: string]; out: Promise<{ id: string; name: string }> }
//    - 'API.USER.UPDATEUSER': { in: [id: string, name: string]; out: Promise<boolean> }
type ApiMsgStruct = ToMsgStruct<UserServiceClient, UserPrefix>;

// 4. Map service instances to their prefix
const services: Record<UserPrefix, any> = {
    'API.USER.': new UserServiceClient(),
};

// 5. Build adapters and register them on the bus
const adapters = Object.entries(services).map(
    (entry) =>
        ({
            service: entry[1],
            channelSelector: getMsgChannelSelector(services),
        }) as MsgProviderAdapter,
);

const msgBus = createMsgBus<ApiMsgStruct>();
const abortController = new AbortController();

registerAdapters(msgBus, adapters, abortController.signal);

// 6. Invoke API methods through the bus with 100% type safety
const user = await msgBus.request({
    channel: 'API.USER.GETUSER',
    payloadFn: (fn) => fn('usr-123'), // type-safe arguments tuple!
});

console.log(user.payload.name);
```

### Functional API Modules (Orval / Kubb style):

If your generator outputs standalone exported functions instead of ES classes (common in Orval, Kubb, and OpenAPI-TS generators), import the module with `import * as UserApi` and pass `typeof UserApi` directly to `ToMsgStruct`:

```typescript
// 1. Module file: userApi.ts (standalone exported functions)
// export async function getUser(id: string) { ... }
// export async function listUsers(limit?: number) { ... }

import * as UserApi from './userApi';
import { createMsgBus } from '@actdim/msgmesh';
import {
    ToMsgChannelPrefix,
    ToMsgStruct,
    getMsgChannelSelector,
    registerAdapters,
    type MsgProviderAdapter,
} from '@actdim/msgmesh/adapters';

// 2. Generate prefix & bus structure from module namespace type
type UserPrefix = ToMsgChannelPrefix<'UserApi', 'API'>; // 'API.USER.'
type ApiMsgStruct = ToMsgStruct<typeof UserApi, UserPrefix>;

// 3. Register module namespace object
const services: Record<UserPrefix, any> = {
    'API.USER.': UserApi,
};
const adapters = Object.entries(services).map(([prefix, service]) => ({
    service,
    channelSelector: getMsgChannelSelector(services),
})) as MsgProviderAdapter[];

const msgBus = createMsgBus<ApiMsgStruct>();
registerAdapters(msgBus, adapters);

// 4. Request via bus
const users = await msgBus.request({
    channel: 'API.USER.LISTUSERS',
    payloadFn: (fn) => fn(10),
});
```

### Combining Dynamic API Structs with Local UI Events

Here is the complete, canonical recipe for merging NSwag-generated API structs with local UI event channels and `BaseAppMsgStruct`:

```typescript
import { createMsgBus } from '@actdim/msgmesh';
import type { MsgBus, MsgStruct } from '@actdim/msgmesh/contracts';
import {
    type ToMsgChannelPrefix,
    type ToMsgStruct,
    type BaseServiceSuffix,
    registerAdapters,
    getMsgChannelSelector,
    type MsgProviderAdapter,
} from '@actdim/msgmesh/adapters';
import { type BaseAppMsgStruct } from '@actdim/dynstruct/appDomain/appContracts';
import { type KeysOf } from '@actdim/utico/typeCore';
import { DashboardApiClient } from './api/client'; // NSwag generated client

// 1. Dynamic API prefix: 'DashboardApiClient' + 'API' -> 'API.DASHBOARD.'
export type ApiPrefix = 'API';
export type DashboardApiClientName = 'DashboardApiClient';
export type DashboardChannelPrefix = ToMsgChannelPrefix<
    DashboardApiClientName,
    ApiPrefix,
    BaseServiceSuffix
>;

// 2. Dynamic API struct: compile-time generated from DashboardApiClient methods
export type DashboardApiStruct = ToMsgStruct<
    DashboardApiClient,
    DashboardChannelPrefix
>;

// 3. Local UI state and event channels
export type DashboardLocalChannels = {
    'APP.DATA.UPDATED': { in: any; out: void };
    'APP.TAB.SET': { in: string; out: void };
    'APP.ENTITY.SELECT': { in: { id: string; type?: string }; out: void };
    'APP.ENTITY.CLOSE': { in: void; out: void };
    'APP.SSE.STATUS': { in: { connected: boolean }; out: void };
};

// 4. Combined Application Bus Struct
export type DashboardAppMsgStruct = DashboardApiStruct &
    MsgStruct<DashboardLocalChannels> &
    BaseAppMsgStruct;

export type DashboardMsgChannels<
    TChannel extends keyof DashboardAppMsgStruct | Array<keyof DashboardAppMsgStruct>,
> = KeysOf<DashboardAppMsgStruct, TChannel>;

export const dashboardBus: MsgBus<any> = createMsgBus<any>();

// 5. Automatic registration of all API methods
export function setupApiAdapters(bus: MsgBus<any>) {
    const services: Record<DashboardChannelPrefix, any> = {
        'API.DASHBOARD.': new DashboardApiClient(),
    };

    const adapters = Object.entries(services).map(
        ([_, service]) =>
            ({
                service,
                channelSelector: getMsgChannelSelector(services),
            }) as MsgProviderAdapter,
    );

    registerAdapters(bus, adapters);
}
```

### Channel Name Resolution & Invocation Cheatsheet

| Service Method | Prefix | Resulting Bus Channel | Invocation Example |
|---|---|---|---|
| `getFullData()` | `'API.DASHBOARD.'` | `'API.DASHBOARD.GETFULLDATA'` | `bus.request({ channel: 'API.DASHBOARD.GETFULLDATA' })` |
| `searchKb(q, tag, type)` | `'API.DASHBOARD.'` | `'API.DASHBOARD.SEARCHKB'` | `bus.request({ channel: 'API.DASHBOARD.SEARCHKB', payload: [q, tag, type] })` |
| `listIssues(status, ...)` | `'API.DASHBOARD.'` | `'API.DASHBOARD.LISTISSUES'` | `bus.request({ channel: 'API.DASHBOARD.LISTISSUES', payload: ['open'] })` |
| `getIssue(id)` | `'API.DASHBOARD.'` | `'API.DASHBOARD.GETISSUE'` | `bus.request({ channel: 'API.DASHBOARD.GETISSUE', payload: ['iss-1'] })` |

---

## Comparison Matrix

| Feature | `EventEmitter` | RxJS Raw | Redux / Zustand | `@actdim/msgmesh` |
|---|---|---|---|---|
| **Type Safety** | Low / Fake | Manual Generics | Store-centric | **100% Compile-Time** |
| **RPC (Request/Response)** | ❌ No | Manual Subjects | ❌ No | **Native (`request/provide`)** |
| **Cancellation (`AbortSignal`)** | ❌ No | RxJS Subscription | ❌ No | **Built-in** |
| **Service Adapters** | ❌ No | ❌ No | ❌ No | **Automated Class Wrapping** |
| **Stream Fan-In** | ❌ No | Complex | ❌ No | **Native (`requestStream`)** |
| **Learning Curve** | Low | High | Medium | **Low** |

---

[← Back to 03. API Reference](./topic--03-api-reference.md) | [Back to Main README](../README.md)
