---
protocol: along
slug: 03-api-reference
title: API Reference
type: topic
created: 2026-08-31
updated: 2026-09-02
tags: [03-api-reference]
---

# API Reference

[← Back to 02. Architecture & Types](./topic--02-architecture-and-types.md) | [Next: 04. Advanced Patterns →](./topic--04-advanced-patterns.md)

---

## Bus Configuration (`MsgBusConfig`)

Configure channel behaviors and pipeline defaults when creating the message bus instance:

```typescript
import { createMsgBus, MsgStruct, $C_ERROR } from '@actdim/msgmesh';

const msgBus = createMsgBus<AppBusStruct>({
    // 1. Channel-specific configuration
    'USER.GET_PROFILE': {
        mandatoryProvider: true, // Throws NoProviderError if requested with no provider
        delay: 50, // Delivery delay in ms
        debounce: 200, // Debounce in ms
        throttle: 100, // Throttle duration in ms (or { duration: 100, leading: true, trailing: true })
        replayBufferSize: 10, // Replay last N messages to new subscribers
        replayWindowTime: 60000, // Replay window in ms
    },

    // 2. Wildcard default configuration for all channels
    '*': {
        mandatoryProvider: false,
    },
});

// System errors (e.g. unhandled provider errors) are published to the system channel MSGBUS.ERROR
msgBus.on({
    channel: 'MSGBUS.ERROR',
    callback: (msg) => {
        console.error('System error on channel:', msg.payload.source, msg.payload.error);
    },
});
```

---

## Core Methods

### 1. `send()` - Fire-and-Forget Message
Dispatches a message to a channel input group. Returns a Promise that resolves with the sent message once dispatched.

```typescript
const sentMsg = await msgBus.send({
    channel: 'USER.LOGOUT',
    payload: { reason: 'User clicked logout' },
});
```

### 2. `on()` - Subscribe to Messages
Registers a long-running subscriber for messages matching a channel. Returns an unsubscribe closure `() => void`.

```typescript
// Basic subscription
const unsubscribe = msgBus.on({
    channel: 'USER.LOGOUT',
    callback: (msg) => {
        console.log('User logged out:', msg.payload.reason);
        console.log('Correlation ID:', msg.headers?.correlationId);
    },
});

// Unsubscribe manually
unsubscribe();

// Or pass an AbortSignal for automatic cancellation:
const controller = new AbortController();
msgBus.on({
    channel: 'USER.LOGOUT',
    options: {
        abortSignal: controller.signal,
        debounce: 200,
        throttle: { duration: 100, leading: true, trailing: true },
    },
    callback: (msg) => {
        console.log('Filtered message:', msg.payload);
    },
});
```

### 3. `once()` - Await Single Message
Subscribes and resolves a Promise upon receiving the first matching message, then automatically unsubscribes.

```typescript
const controller = new AbortController();

const msg = await msgBus.once({
    channel: 'USER.LOGOUT',
    options: {
        timeout: 5000, // Throws TimeoutError if no message arrives in 5000ms
        abortSignal: controller.signal, // Throws AbortError if aborted
    },
});

console.log('Received message:', msg.payload);
```

### 4. `stream()` - Async Generator Stream
Returns an `AsyncGenerator` allowing you to iterate over incoming messages using standard `for await (... of ...)` syntax.

```typescript
const controller = new AbortController();

for await (const msg of msgBus.stream({
    channel: 'USER.LOGOUT',
    options: {
        timeout: 5000, // Inactivity timeout between messages
        fetchCount: 10, // Automatically ends after 10 messages
        abortSignal: controller.signal,
    },
})) {
    console.log('Streamed message:', msg.payload);
}
```

---

## Request-Response & RPC

### 5. `provide()` - Register RPC Response Handler
Registers a provider that handles incoming `request()` calls and returns an `out` payload.

```typescript
msgBus.provide({
    channel: 'USER.COMPUTE_SUM',
    callback: async (inMsg, outMsg) => {
        const { a, b } = inMsg.payload;
        return a + b; // Returned to caller as response.payload
    },
});
```

#### Provider Cancellation & Status Control
Providers can inspect `inMsg.headers`, set custom `outMsg.headers`, skip handling via `outMsg.status = 'skipped'`, or listen to cancellation:

```typescript
msgBus.provide({
    channel: 'USER.COMPUTE_SUM',
    options: {
        abortSignal: controller.signal, // Unregister provider when signal aborts
    },
    callback: async (inMsg, outMsg) => {
        if (inMsg.headers?.skip) {
            outMsg.status = 'skipped'; // Chain of responsibility: allows next provider to handle
            return;
        }
        outMsg.headers = { computedBy: 'Worker-1' };
        return inMsg.payload.a + inMsg.payload.b;
    },
});
```

### 6. `request()` - RPC Call
Sends a request and awaits the provider's response (`out` group). Returns `Promise<Msg<...>>`.

```typescript
const controller = new AbortController();

const response = await msgBus.request({
    channel: 'USER.COMPUTE_SUM',
    payload: { a: 10, b: 20 },
    options: {
        timeout: 3000, // Max wait time for response
        throwIfNoProvider: true, // Throws NoProviderError if no provider is active
        abortSignal: controller.signal,
    },
});

console.log('Result payload:', response.payload); // 30
console.log('Response headers:', response.headers);
```

---

## Fan-In Streaming

### 7. `requestStream()` - Multi-Provider Response Stream
Sends a request and streams responses from one or more registered providers as an `AsyncGenerator`.

```typescript
for await (const response of msgBus.requestStream({
    channel: 'METRICS.COLLECT',
    payload: { timestamp: Date.now() },
    options: {
        timeout: 2000,
        fetchCount: 5,
    },
})) {
    console.log('Metric slice from provider:', response.payload);
}
```

---

[← Back to 02. Architecture & Types](./topic--02-architecture-and-types.md) | [Next: 04. Advanced Patterns →](./topic--04-advanced-patterns.md)
