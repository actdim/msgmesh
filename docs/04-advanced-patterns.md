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

The `@actdim/msgmesh/adapters` module transforms standard TypeScript service classes (such as NSwag-generated REST API clients or gRPC clients) into typed message bus providers automatically.

### How It Works:
1. Every public method on a service class becomes a channel name (e.g. `getDataItems` → `API.TEST.GETDATAITEMS`).
2. Input argument types become the `in` payload type.
3. Return types become the `out` payload type.

```typescript
import { ToMsgChannelPrefix, ToMsgStruct } from '@actdim/msgmesh/adapters';

export class UserApiClient {
    static readonly name = 'UserApiClient' as const;
    readonly name = 'UserApiClient' as const;

    getUser(id: string): Promise<{ id: string; name: string }> {
        return fetch(`/api/users/${id}`).then(r => r.json());
    }
}

// Automatically generates channel 'API.USER.GETUSER' with typed input & output!
type ApiChannels = ToMsgChannelPrefix<typeof UserApiClient.name, 'API'>;
type ApiMsgStruct = ToMsgStruct<UserApiClient, ApiChannels>;
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

