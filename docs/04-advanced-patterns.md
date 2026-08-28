# Advanced Patterns & Adapters

[← Back to 03. API Reference](./03-api-reference.md) | [Back to Main README](../README.md)

---

## Advanced Features

### 1. Message Replay
Replay past messages to new subscribers when subscribing late:

```typescript
const msgBus = createMsgBus<AppBusStruct>({
    replay: {
        bufferSize: 10, // Keep last 10 messages in memory for new subscribers
    },
});
```

### 2. Throttling and Debouncing
Channels can configure rate-limiting behavior:

```typescript
const msgBus = createMsgBus<AppBusStruct>({
    rateLimit: {
        'UI.SEARCH_INPUT': { debounceMs: 300 },
        'SCROLL.EVENT': { throttleMs: 100 },
    },
});
```

### 3. Chain of Responsibility
Handlers can choose to process or skip messages by setting `msgOut.status = 'skipped'`, allowing downstream handlers to handle the message.

```typescript
msgBus.provide({
    channel: 'AUTH.VALIDATE',
    callback: (msg) => {
        if (!canHandle(msg)) {
            return { status: 'skipped' };
        }
        return { status: 'success', payload: true };
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

**You do NOT need to write manual MsgStruct channels or custom channel selectors for API services.**

### How It Works:
1. Every public method on a service class becomes a channel name (e.g. `getUser` on `UserServiceClient` with prefix `'API.USER.'` becomes `'API.USER.GETUSER'`).
2. Input argument types become a typed tuple for `in` payload (`Parameters<Method>`).
3. Return type becomes the `out` payload (`ReturnType<Method>`).
4. `getMsgChannelSelector(services)` and `registerAdapters(msgBus, adapters, signal)` wire all methods to the bus automatically.

### Complete Example:

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

If your generator outputs standalone exported functions instead of ES classes (common in Orval, Kubb, and OpenAPI-TS generators), import the module with `import * as api` and pass `typeof api` directly to `ToMsgStruct`:

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

[← Back to 03. API Reference](./03-api-reference.md) | [Back to Main README](../README.md)

