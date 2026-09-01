---
protocol: along
protocol_version: "2.2.5"
slug: topic--04-advanced-patterns
title: Advanced Patterns & Adapters
type: topic
created: 2026-08-31
updated: 2026-08-31
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
