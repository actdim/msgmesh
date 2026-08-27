# API Reference

[← Back to 02. Architecture & Types](./02-architecture-and-types.md) | [Next: 04. Advanced Patterns →](./04-advanced-patterns.md)

---

## Bus Configuration (`MsgBusConfig`)

```typescript
const msgBus = createMsgBus<AppBusStruct>({
    // Optional error handler for unhandled channel errors
    errorHandler: (err, headers) => console.error('Global Bus Error:', err),
});
```

---

## Core Methods

### 1. `send()` — Fire-and-Forget
Publishes a message to a channel. Returns immediately without waiting for subscribers or response handlers.

```typescript
msgBus.send({
    channel: 'USER.LOGOUT',
    payload: { reason: 'User clicked logout' },
});
```

### 2. `on()` — Subscribe to Channel Messages
Registers a long-running subscriber for messages matching a channel.

```typescript
const subscription = msgBus.on({
    channel: 'USER.LOGOUT',
    callback: (msg, headers) => {
        console.log('User logged out:', msg.payload.reason);
    },
});

// Unsubscribe manually
subscription.unsubscribe();

// Or pass an AbortSignal for automatic unsubscription:
const controller = new AbortController();
msgBus.on({
    channel: 'USER.LOGOUT',
    signal: controller.signal,
    callback: (msg) => { /* ... */ },
});
```

### 3. `once()` — Await Single Message
Subscribes and resolves a Promise upon receiving the very first matching message, then automatically unsubscribes.

```typescript
const msg = await msgBus.once({
    channel: 'USER.LOGOUT',
    timeoutMs: 5000, // Throws TimeoutError if no message arrives in 5s
});
```

### 4. `stream()` — Observable Stream
Returns an RxJS `Observable` of messages for fine-grained stream composition.

```typescript
const stream$ = msgBus.stream({ channel: 'USER.LOGOUT' });
stream$.subscribe((msg) => { /* ... */ });
```

---

## Request-Response & RPC

### 5. `provide()` — Register RPC Response Handler
Registers a handler that calculates and returns an `out` payload for incoming `request()` calls.

```typescript
msgBus.provide({
    channel: 'USER.COMPUTE_SUM',
    callback: async (msg, headers) => {
        const { a, b } = msg.payload;
        return a + b; // Automatically returned as `out` payload to caller
    },
});
```

#### Provider Cancellation & AbortSignal
`provide()` callbacks receive an `AbortSignal` if the requester cancels the request:

```typescript
msgBus.provide({
    channel: 'USER.COMPUTE_SUM',
    callback: async (msg, headers, signal) => {
        signal?.addEventListener('abort', () => {
            console.log('Request cancelled by caller');
        });
        return longComputation(msg.payload);
    },
});
```

### 6. `request()` — RPC Call
Sends a request message and awaits the provider's response (`out` group).

```typescript
const response = await msgBus.request({
    channel: 'USER.COMPUTE_SUM',
    payload: { a: 10, b: 20 },
    timeoutMs: 3000,
});

console.log('Result:', response.payload); // 30
```

#### Request Cancellation
Pass an `AbortSignal` to cancel an in-flight request:

```typescript
const controller = new AbortController();

const requestPromise = msgBus.request({
    channel: 'USER.COMPUTE_SUM',
    payload: { a: 10, b: 20 },
    signal: controller.signal,
});

// Cancel request mid-flight
controller.abort();
```

---

## Fan-In Streaming

### 7. `requestStream()` — Multi-Provider Fan-In
Streams responses from multiple providers matching the channel until completion or timeout.

```typescript
const stream$ = msgBus.requestStream({
    channel: 'METRICS.COLLECT',
    payload: { timestamp: Date.now() },
    timeoutMs: 2000,
});

stream$.subscribe({
    next: (response) => console.log('Metric slice received:', response.payload),
    complete: () => console.log('All metrics gathered'),
});
```

---

[← Back to 02. Architecture & Types](./02-architecture-and-types.md) | [Next: 04. Advanced Patterns →](./04-advanced-patterns.md)

