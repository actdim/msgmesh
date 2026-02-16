# @actdim/msgmesh - A type-safe, modular message mesh for scalable async communication in TypeScript

[![npm version](https://img.shields.io/npm/v/@actdim/msgmesh.svg)](https://www.npmjs.com/package/@actdim/msgmesh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Overview](#overview)
  - [The Challenge](#the-challenge)
  - [Analysis of Existing Solutions](#analysis-of-existing-solutions)
  - [The Solution](#the-solution-actdimmsgmesh)
  - [Implementation Foundation](#implementation-foundation)
  - [Key Design Goals](#key-design-goals)
- [Architecture](#architecture)
  - [Message Structure](#message-structure)
  - [Type Definition Example](#type-definition-example)
- [Usage Patterns](#usage-patterns)
  - [Global vs Local Usage](#global-vs-local-usage)
  - [Creating a Message Bus](#creating-a-message-bus)
  - [Type Utilities](#type-utilities)
- [API Reference](#api-reference)
  - [Configuration](#configuration)
  - [`send()`](#sending-messages-send)
  - [`on()`](#subscribing-to-messages-on)
  - [`once()`](#awaiting-a-single-message-once)
  - [`stream()`](#streaming-messages-stream)
  - [`provide()`](#providing-response-handlers-provide)
  - [`request()`](#request-response-pattern-request)
- [Advanced Features](#advanced-features)
  - [Message Replay](#message-replay)
  - [Throttling and Debouncing](#throttling-and-debouncing)
  - [Error Handling](#error-handling)
  - [Headers and Metadata](#headers-and-metadata)
  - [Service Adapters](#service-adapters)
- [Comparison](#comparison-with-other-solutions)

## Quick Start

Try @actdim/msgmesh instantly in your browser without any installation:

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/~/github.com/actdim/msgmesh)

Once the project loads, run the tests to see the message bus in action:

```bash
pnpm run test
```

## Installation

```bash
npm install @actdim/msgmesh
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @actdim/utico rxjs
```

Or with pnpm:

```bash
pnpm add @actdim/utico rxjs
```

## Overview

### The Challenge

Modern client-side TypeScript applications require robust event handling mechanisms. Events may be needed within a single component or for communication between components, serving as a decoupling layer independent of component hierarchy. As applications grow in complexity and scale, the convenience, performance, and flexibility of the event system become critical factors. A well-designed messaging system enables extensibility, maintainability, and scalability without losing control over component interactions or system observability. Such a system becomes one of the pillars of high-quality application architecture.

In our case, this message bus serves as the foundation of the @actdim/dynstruct architectural framework.

### Analysis of Existing Solutions

When examining popular messaging systems in the frontend ecosystem, particularly for React-based applications, several categories emerge:

#### Event Emitters

- **Pros**: Simple to understand, typically local in scope
- **Cons**:
    - Limited capabilities and scalability
    - Weak support for interaction structures and declarative approaches
    - Poor type safety (fictitious typing, manual implementation required)
    - Incomplete Promise integration
    - Lack of abstraction levels

#### Message Buses

- **Pros**: Reduce component coupling, beneficial for development and testing
- **Cons**:
    - Underdeveloped type system despite TypeScript's power
    - Often feel like academic experiments porting backend message buses to frontend
    - Poor integration with common development patterns (limited adapters for rate limiting, throttling, debouncing, retry logic)
    - More complex to maintain

#### Reactive Event Streams & Observer Pattern

- **Pros**: Powerful for compositions and complex data flows
- **Cons**:
    - Complex to understand, maintain, and debug
    - Strong architectural influence requiring paradigm shift (similar to procedural-to-functional programming transition)
    - Often tightly embedded throughout the system as an integral part
    - Creates hard dependencies across types, code style, tests, DI, error handling, and even team thinking
    - Essentially becomes the "language" of the application

#### React State Management Systems

- **Pros**: Purpose-built for React ecosystem
- **Cons**:
    - Tight coupling with React (hooks, lifecycle), making usage outside components difficult
    - Significant boilerplate code slowing development and complicating maintenance
    - Often enforce immutability paradigm, which looks elegant on paper but creates more problems and wrapper code than value in practice
    - Rarely provide configuration for event/stream connections (possibly due to weak or inconvenient payload typing)

### The Solution: @actdim/msgmesh

@actdim/msgmesh addresses these shortcomings by providing a message bus that is:

- **Flexible and extensible**: Adapts to various use cases without imposing rigid patterns
- **Scalable**: Grows with your application without losing manageability
- **Minimally opinionated**: Doesn't force a specific paradigm
- **Simple to understand**: Clear mental model and API
- **Local in impact**: Doesn't permeate every aspect of your codebase

### Implementation Foundation

@actdim/msgmesh is built on top of **RxJS**, leveraging the power and quality of this battle-tested library while hiding its complexity and architectural influence (see the comparison section above). This approach provides the best of both worlds: robust reactive stream processing under the hood with a simple, intuitive API on the surface.

**Key RxJS components utilized:**

- **Subjects/Observables**: Power the queue management system and state control, implementing the publish-subscribe (pub/sub) pattern efficiently
- **Async Scheduler**: Ensures the message bus operates independently from individual message handlers, preventing blocking and maintaining system responsiveness
- **Pipe Operators**: Enable flexible message flow behaviors within channels (throttling, debouncing, filtering, etc.) without exposing reactive programming complexity

By abstracting RxJS behind a clean API, @actdim/msgmesh delivers enterprise-grade stream processing capabilities without requiring developers to adopt reactive programming paradigms or deal with the steep learning curve typically associated with RxJS.

### Key Design Goals

#### Observability

- Comprehensive logging and tracing capabilities
- Ability to subscribe to any event at any time
- Minimal system complexity and coupling
- Maintained control and visibility

#### Lifecycle Management

- Convenient subscription and unsubscription with various configuration options
- Automatic cleanup
- Integration with React lifecycle (when needed)
- Support for AbortSignal and AbortController patterns

## Architecture

### Message Structure

The message bus is defined by a type structure consisting of three levels:

#### 1. Channels

Channels organize messages by task class, domain, event type, or any other logical grouping. Channels use string identifiers with dot notation recommended for namespacing.

**Reserved System Channel**: `MSGBUS.ERROR` - for system-level errors

#### 2. Groups

Groups connect related messages within a single channel. Standard groups include:

- **`in`**: For requests or arbitrary messages/events (default for most operations)
- **`out`**: For responses to requests
- **`error`**: Reserved system group for channel-specific errors

You can define custom groups for message multiplexing and input type overloading.

#### 3. Message Types

Each group defines a message structure (payload type). For standard buses, types can be any valid TypeScript type. For persistent message buses (work in progress), types must be serializable.

**Note**: You don't need to wrap `out` types in `Promise` - async handling is automatically supported at the API level.

Use `MsgStructFactory` to define bus structures: it extends your declared channels with system channel groups (including reserved `error` handling groups) so runtime and typing stay consistent.

### Type Definition Example

```typescript
import { MsgStructFactory } from '@actdim/msgmesh';

export type MyBusStruct = MsgStructFactory<{
    'Test.ComputeSum': {
        in: { a: number; b: number };
        out: number;
    };
    'Test.DoSomeWork': {
        in: string;
        out: void;
    };
    'Test.TestTaskWithRepeat': {
        in: string;
        out: void;
    };
    'Test.Multiplexer': {
        in1: string;
        in2: number;
        out: number;
    };
}>;
```

## Usage Patterns

### Global vs Local Usage

@actdim/msgmesh can be used in two primary ways:

#### Global Application-Level Bus

Maintain a system-wide type structure for messages/events, organizing them by:

- Tasks (component ownership)
- Groups (in/out, input type overloading)
- Topics (additional filtering)

#### Local Component/Module-Level Bus

Use within any logical grouping of components or modules.

**Important**: You only need **one bus instance** for the entire application. The bus routes messages based on keys, so as long as key uniqueness is maintained, a single instance can handle messages from any locally-defined schema.

### Creating a Message Bus

```typescript
import { createMsgBus, MsgBus } from '@actdim/msgmesh';
import { KeysOf } from '@actdim/utico/typeCore';

// Basic bus creation
const msgBus = createMsgBus<MyBusStruct>();

// With custom headers (if needed)
type CustomHeaders = MsgHeaders & {
    userId?: string;
    sessionId?: string;
};

const msgBusWithHeaders = createMsgBus<MyBusStruct, CustomHeaders>();

// Note: The instance can process messages from other structures too
// We only type the API for development convenience
// You can compose structures as needed, just ensure they don't overlap (unless intentional)

type AppBusStruct = ComponentBusStruct & ApiBusStruct;
const appMsgBus = createMsgBus<AppBusStruct>();
```

### Type Utilities

```typescript
// Export bus type for dependency injection or props
export type MyMsgBus = MsgBus<MyBusStruct, CustomHeaders>;

// Generic string literal type for channels - useful for component constraints
type MyMsgChannels<TChannel extends keyof MyBusStruct | Array<keyof MyBusStruct>> = KeysOf<
    MyBusStruct,
    TChannel
>;

// Example: Restricting a component to specific channels
// Helper types are necessary for IntelliSense with dynamic types
// All API checks are enforced at compile time - you cannot violate defined contracts
type Behavior = {
    messages: MyMsgChannels<'Test.ComputeSum' | 'Test.DoSomeWork'>;
};
```

## API Reference

| Method | Description |
|--------|-------------|
| `send()` | Publish a message to a channel |
| `on()` | Subscribe to messages on a channel |
| `once()` | Await a single message (Promise-based) |
| `stream()` | Consume messages as an async iterable |
| `provide()` | Register a request handler (auto-responds on `out`) |
| `request()` | Send a request and await a response |

### Configuration

You can configure channels with various options:

```typescript
import { MsgBusConfig } from '@actdim/msgmesh';

const config: MsgBusConfig<MyBusStruct> = {
    'Test.ComputeSum': {
        replayBufferSize: 10, // Number of messages to buffer for replay
        replayWindowTime: 5000, // Time window for replay (ms)
        delay: 100, // Delay before processing (ms)
        throttle: {
            // Throttle configuration
            duration: 1000,
            leading: true,
            trailing: true,
        },
        debounce: 500, // Debounce delay (ms)
    },
};

const msgBus = createMsgBus<MyBusStruct>(config);
```

### Sending Messages: `send()`

Send a message to the bus for a specific channel and group (default is `in`). The payload type is enforced according to the bus structure.

```typescript
// Basic send
await msgBus.send({
    channel: 'Test.ComputeSum',
    payload: { a: 10, b: 20 }, // Typed and validated
});

// With group specification
await msgBus.send({
    channel: 'Test.Multiplexer',
    group: 'in1',
    payload: 'hello', // Typed as string for 'in1' group
});

await msgBus.send({
    channel: 'Test.Multiplexer',
    group: 'in2',
    payload: 42, // Typed as number for 'in2' group
});

// With topic
await msgBus.send({
    channel: 'Test.DoSomeWork',
    topic: 'priority-high',
    payload: 'urgent task',
});

// With custom headers
await msgBus.send({
    channel: 'Test.ComputeSum',
    payload: { a: 5, b: 15 },
    headers: {
        correlationId: 'task-123',
        priority: 1,
    },
});
```

> **Note**: You can specify a topic when sending to enable fine-grained filtering by subscribers.

### Subscribing to Messages: `on()`

Subscribe to messages on a specific channel and group with optional topic filtering.

```typescript
// Basic subscription
msgBus.on({
    channel: 'Test.ComputeSum',
    callback: (msg) => {
        // msg.payload is typed as { a: number; b: number }
        console.log('Received:', msg.payload);
    },
});

// Subscribe to specific group
msgBus.on({
    channel: 'Test.ComputeSum',
    group: 'out', // Listen for responses
    callback: (msg) => {
        // msg.payload is typed as number
        console.log('Result:', msg.payload);
    },
});

// With topic filtering (regex pattern)
msgBus.on({
    channel: 'Test.DoSomeWork',
    topic: '/^task-.*/', // Match topics starting with "task-"
    callback: (msg) => {
        console.log('Task message:', msg.payload);
    },
});

// With options
msgBus.on({
    channel: 'Test.ComputeSum',
    callback: (msg) => {
        console.log('Message:', msg.payload);
    },
    options: {
        fetchCount: 5, // Auto-unsubscribe after 5 messages
        throttle: {
            // Throttle the callback
            duration: 1000,
            leading: true,
            trailing: false,
        },
    },
});
```

#### Automatic Unsubscription

**Limit message count**: Use `fetchCount` to automatically unsubscribe after receiving a specific number of messages.

```typescript
msgBus.on({
    channel: 'Test.ComputeSum',
    callback: (msg) => {
        console.log(msg.payload);
    },
    options: {
        fetchCount: 10, // Unsubscribe after 10 messages
    },
});
```

#### Manual Unsubscription with AbortSignal

Use `AbortSignal` for controlled unsubscription. This allows combining abort signals from multiple `AbortController` instances.

```typescript
const abortController = new AbortController();

msgBus.on({
    channel: "Test.ComputeSum",
    callback: (msg) => {
        console.log(msg.payload);
    },
    options: {
        abortSignal: abortController.signal
    }
});

// Later: unsubscribe
abortController.abort();

// Combining multiple abort signals
const controller1 = new AbortController();
const controller2 = new AbortController();

const combinedSignal = AbortSignal.any([
    controller1.signal,
    controller2.signal
]);

msgBus.on({
    channel: "Test.ComputeSum",
    options: {
        abortSignal: combinedSignal
    },
    callback: (msg) => {
        console.log(msg.payload);
    }
});

// React integration example - cleanup on unmount
import { useEffect } from 'react';

function MyComponent() {
    useEffect(() => {
        const controller = new AbortController();

        msgBus.on({
            channel: "Test.Events",
            callback: handleEvent,
            options: {
                abortSignal: controller.signal
            }
        });

        // Clean up when component unmounts
        return () => {
            controller.abort();
        };
    }, []);

    return <div>Component content</div>;
}
```

### Awaiting a Single Message: `once()`

Subscribe and await the first (next) message on a specific channel and group, similar to `on()` but returns a Promise.

```typescript
// Wait for one message
const msg = await msgBus.once({
    channel: 'Test.ComputeSum',
});

console.log('Received:', msg.payload); // Typed as { a: number; b: number }

// With group specification
const response = await msgBus.once({
    channel: 'Test.ComputeSum',
    group: 'out',
});

console.log('Result:', response.payload); // Typed as number

// With topic filtering
const taskMsg = await msgBus.once({
    channel: 'Test.DoSomeWork',
    topic: '/^priority-.*/', // Match topics starting with "priority-"
});
```

#### Timeout Configuration

Configure timeout duration via the `timeout` option. The `abortSignal` option also works with `once()`.

```typescript
try {
    const msg = await msgBus.once({
        channel: 'Test.ComputeSum',
        options: {
            timeout: 5000, // 5 second timeout
        },
    });
    console.log('Received:', msg.payload);
} catch (error) {
    if (error instanceof TimeoutError) {
        console.error('Timeout waiting for message');
    }
}

// With abort signal
const abortController = new AbortController();

const messagePromise = msgBus.once({
    channel: 'Test.ComputeSum',
    options: {
        timeout: 10000,
        abortSignal: abortController.signal,
    },
});

// Can cancel from elsewhere
setTimeout(() => abortController.abort('User canceled'), 2000);

try {
    const msg = await messagePromise;
} catch (error) {
    if (error instanceof AbortError) {
        console.error('Aborted:', error.cause);
    }
}
```

### Streaming Messages: `stream()`

Create an async iterable iterator for consuming messages as a stream.

```typescript
// Basic streaming
const messageStream = msgBus.stream({
    channel: 'Test.ComputeSum',
});

for await (const msg of messageStream) {
    console.log('Received:', msg.payload);
    // Process messages as they arrive
}

// With topic filtering
const taskStream = msgBus.stream({
    channel: 'Test.DoSomeWork',
    topic: '/^task-.*/',
});

for await (const msg of taskStream) {
    await processTask(msg.payload);
}
```

#### Timeout and Cancellation

The `timeout` option is an **inactivity timeout** — the timer resets on each received message. If no message arrives within the timeout window, the stream ends with a `TimeoutError`. This is useful for detecting when the producer has stopped sending.

For a hard time limit on the stream's total duration, use `AbortSignal.timeout()`.

```typescript
// Inactivity timeout: end stream if no messages for 5s
const stream1 = msgBus.stream({
    channel: 'Test.Events',
    options: {
        timeout: 5000,
    },
});

// Total duration limit: end stream after 60s regardless of activity
const stream2 = msgBus.stream({
    channel: 'Test.Events',
    options: {
        abortSignal: AbortSignal.timeout(60000),
    },
});

// Both: inactivity 5s + hard limit 60s
const stream3 = msgBus.stream({
    channel: 'Test.Events',
    options: {
        timeout: 5000,
        abortSignal: AbortSignal.timeout(60000),
    },
});
```

### Providing Response Handlers: `provide()`

Register a handler for messages on a selected channel and group (typically `in`), which generates a response message for the `out` group of the same channel. This is essentially a subscription with automatic response handling.

The callback can be asynchronous and its result is automatically used to form the response.

```typescript
// Simple provider
msgBus.provide({
    channel: 'Test.ComputeSum',
    callback: (msg) => {
        // msg.payload is typed as { a: number; b: number }
        // Return type is inferred as number (from 'out' type)
        return msg.payload.a + msg.payload.b;
    },
});

// Async provider
msgBus.provide({
    channel: 'Test.DoSomeWork',
    callback: async (msg) => {
        // msg.payload is typed as string
        await performWork(msg.payload);
        // Return type is void (from 'out' type)
    },
});

// With topic filtering
msgBus.provide({
    channel: 'Test.ComputeSum',
    topic: '/^calc-.*/',
    callback: (msg) => {
        return msg.payload.a + msg.payload.b;
    },
});

// With options
msgBus.provide({
    channel: 'Test.ComputeSum',
    callback: (msg) => {
        return msg.payload.a + msg.payload.b;
    },
    options: {
        fetchCount: 100, // Handle 100 requests then unsubscribe
        abortSignal: someController.signal,
    },
});
```

#### Cancellation Handling

The provider callback receives both the message and constructed headers. When a request is canceled by the caller (via `AbortSignal` in [`request()`](#cancellation)), a cancel message with `headers.status === 'canceled'` is delivered to the provider callback. The provider should check `headers.status` and handle cancellation accordingly. The bus will **not** publish an `out` response for cancel messages.

For providers that don't need cancellation support, simply check that `headers.status === 'ok'` before doing work:

```typescript
msgBus.provide({
    channel: 'Test.ComputeSum',
    callback: (msg, headers) => {
        if (headers.status !== 'ok') return;
        return msg.payload.a + msg.payload.b;
    },
});
```

For providers with long-running or cancelable operations (e.g. `fetch`), track active requests by `requestId` and abort them when a cancel message arrives:

```typescript
const activeRequests = new Map<string, AbortController>();

msgBus.provide({
    channel: 'Api.FetchData',
    callback: async (msg, headers) => {
        const { requestId } = headers;

        // Cancel message — abort the in-flight request
        if (headers.status === 'canceled') {
            activeRequests.get(requestId)?.abort();
            activeRequests.delete(requestId);
            return;
        }

        // Normal request — create AbortController and track it
        const controller = new AbortController();
        activeRequests.set(requestId, controller);

        try {
            const response = await fetch(msg.payload.url, {
                signal: controller.signal,
            });
            return await response.json();
        } finally {
            activeRequests.delete(requestId);
        }
    },
});
```

### Request-Response Pattern: `request()`

Send a message and automatically await a response from a handler (registered via `provide()`) on the same channel's `out` group. Returns a Promise that resolves with the response message.

```typescript
// Basic request
const response = await msgBus.request({
    channel: 'Test.ComputeSum',
    payload: { a: 10, b: 20 },
});

console.log('Result:', response.payload); // Typed as number

// With group overloading (using different input groups)
const response1 = await msgBus.request({
    channel: 'Test.Multiplexer',
    group: 'in1',
    payload: 'hello',
});

const response2 = await msgBus.request({
    channel: 'Test.Multiplexer',
    group: 'in2',
    payload: 42,
});

// Both responses have payload with type - number ('out' group)

// With timeout
try {
    const response = await msgBus.request({
        channel: 'Test.ComputeSum',
        payload: { a: 5, b: 15 },
        options: {
            timeout: 5000, // Overall timeout
        },
    });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.error('Request timed out');
    }
}

// With separate send and response timeouts
const response = await msgBus.request({
    channel: 'Test.ComputeSum',
    payload: { a: 5, b: 15 },
    options: {
        sendTimeout: 1000, // Timeout for sending the message
        responseTimeout: 5000, // Timeout for receiving the response
    },
});

// With headers for correlation
const response = await msgBus.request({
    channel: 'Test.ComputeSum',
    payload: { a: 5, b: 15 },
    headers: {
        sourceId: 'component-123',
        correlationId: 'request-456',
    },
});

// The response will include matching headers
console.log(response.headers.requestId); // Original message ID
console.log(response.headers.correlationId); // Preserved correlation ID
```

#### Key Features

1. **Input Type Overloading**: Use different input groups within the same channel to support multiple request signatures while maintaining a single response type.

2. **Timeout Control**: Configure response timeout via the `responseTimeout` option to prevent indefinite waiting.

3. **Header Propagation**: Headers like `correlationId` are automatically propagated from request to response for tracing.

4. **Cancellation**: Cancel in-flight requests with `AbortSignal` (see below).

#### Cancellation

Cancel an in-flight request by passing an `AbortSignal` via `options.abortSignal`. When aborted, the bus sends a cancel message (with `headers.status === 'canceled'`) to the provider and rejects the returned Promise with an `OperationCanceledError`.

On the provider side, the cancel message is delivered to the callback so it can clean up resources. See [`provide()` — Cancellation Handling](#cancellation-handling) for details.

```typescript
const abortController = new AbortController();

const responsePromise = msgBus.request({
    channel: 'Api.FetchData',
    payload: { url: 'https://api.example.com/data' },
    options: {
        abortSignal: abortController.signal,
    },
});

// Cancel the request (sends cancel message to provider)
abortController.abort('user navigated away');

try {
    await responsePromise;
} catch (error) {
    // OperationCanceledError: The request was canceled by the caller
    console.error(error.message);
}
```

## Advanced Features

### Message Replay

Configure channels to buffer and replay messages for late subscribers.

```typescript
const msgBus = createMsgBus<MyBusStruct>({
    'Test.Events': {
        replayBufferSize: 50, // Keep last 50 messages
        replayWindowTime: 60000, // Keep messages for 60 seconds
    },
});

// Send messages
for (let i = 0; i < 100; i++) {
    await msgBus.send({
        channel: 'Test.Events',
        payload: `Message ${i}`,
    });
}

// Late subscriber receives last 50 messages
msgBus.on({
    channel: 'Test.Events',
    callback: (msg) => {
        console.log('Replayed:', msg.payload);
    },
});
```

### Throttling and Debouncing

Control message processing rate at both channel and subscription levels.

```typescript
// Channel-level throttling
const msgBus = createMsgBus<MyBusStruct>({
    'Test.Updates': {
        throttle: {
            duration: 1000,
            leading: true,
            trailing: true,
        },
    },
});

// Subscription-level debouncing
msgBus.on({
    channel: 'Test.Updates',
    callback: (msg) => {
        updateUI(msg.payload);
    },
    options: {
        debounce: 500, // Wait 500ms of inactivity before processing
    },
});
```

### Error Handling

The bus includes built-in error handling and a reserved error channel.

```typescript
// Subscribe to errors for a specific channel
msgBus.on({
    channel: 'Test.ComputeSum',
    group: 'error',
    callback: (msg) => {
        console.error('Error in ComputeSum:', msg.payload.error);
    },
});

// Subscribe to all system errors
msgBus.on({
    channel: 'MSGBUS.ERROR',
    callback: (msg) => {
        console.error('System error:', msg.payload);
    },
});

// Errors in providers are automatically caught and routed
msgBus.provide({
    channel: 'Test.ComputeSum',
    callback: (msg) => {
        if (msg.payload.a < 0) {
            throw new Error('Negative numbers not allowed');
        }
        return msg.payload.a + msg.payload.b;
    },
});
```

### Headers and Metadata

Messages support rich metadata through headers.

```typescript
import { MsgHeaders } from '@actdim/msgmesh';

// Standard headers
type StandardHeaders = {
    sourceId?: string; // Sender identifier
    targetId?: string; // Recipient identifier
    correlationId?: string; // Activity/trace identifier
    traceId?: string; // Distributed trace identifier
    requestId?: string; // Logical request identifier (generated by request/dispatch)
    inResponseToId?: string; // Reply reference (links response to requestId)
    status?: ResponseStatus; // Message status ("ok" | "error" | "canceled" | "timeout")
    publishedAt?: number; // Timestamp (Unix epoch, ms)
    priority?: number; // Message priority
    ttl?: number; // Time to live (ms)
    tags?: string | string[]; // Message tags
};

// Custom headers
type MyHeaders = MsgHeaders & {
    userId: string;
    tenantId: string;
    version: string;
};

const msgBus = createMsgBus<MyBusStruct, MyHeaders>();

await msgBus.send({
    channel: 'Test.ComputeSum',
    payload: { a: 10, b: 20 },
    headers: {
        userId: 'user-123',
        tenantId: 'tenant-456',
        version: '1.0',
        correlationId: 'trace-789',
        priority: 1,
    },
});
```

### Service Adapters

Automatically register any service object (e.g. a Swagger-generated API client) as a message bus provider. The adapter system uses TypeScript's type system to map service methods to bus channels at compile time — channel names, payload types, and return types are all derived from the service class. No manual wiring, no runtime errors.

#### How It Works

Given a service class:

```typescript
class OrderApiClient {
    static readonly name = 'OrderApiClient' as const;
    readonly name = 'OrderApiClient' as const;

    createOrder(items: Item[], priority: number): Promise<OrderResult> { /* ... */ }
    getOrder(id: string): Promise<Order> { /* ... */ }

    // Internal helper — should not be exposed on the bus
    formatResponse() { /* ... */ }
}
```

The type utilities transform it into a bus structure:

```typescript
import {
    ToMsgChannelPrefix,
    ToMsgStruct,
    BaseServiceSuffix,
    registerAdapters,
    getMsgChannelSelector,
    MsgProviderAdapter
} from '@actdim/msgmesh/adapters';

// 1. Generate channel prefix from class name
//    "OrderApiClient" → remove suffix "Client" → uppercase → "API.ORDER."
type ApiPrefix = 'API';
type OrderChannelPrefix = ToMsgChannelPrefix<
    typeof OrderApiClient.name,  // "OrderApiClient"
    ApiPrefix,                    // "API"
    BaseServiceSuffix             // removes CLIENT, API, SERVICE, etc.
>;
// Result: "API.ORDER."

// 2. Transform service methods into bus struct (skip internal methods)
type OrderApiStruct = ToMsgStruct<
    OrderApiClient,
    OrderChannelPrefix,
    'formatResponse'  // skip this method
>;
// Result type (compile-time):
// {
//     "API.ORDER.CREATEORDER": {
//         in: [items: Item[], priority: number];  // ← tuple from Parameters<>
//         out: OrderResult;                        // ← from ReturnType<>
//     };
//     "API.ORDER.GETORDER": {
//         in: [id: string];
//         out: Order;
//     };
// }
```

All channel names, payload types, and return types are verified at compile time. If you rename a method, add a parameter, or change a return type — the compiler catches it immediately.

#### Registering Adapters

```typescript
const services: Record<OrderChannelPrefix, any> = {
    'API.ORDER.': new OrderApiClient(),
};

const adapters = Object.entries(services).map(([_, service]) => ({
    service,
    channelSelector: getMsgChannelSelector(services),
}) as MsgProviderAdapter);

const msgBus = createMsgBus<OrderApiStruct>();
const abortController = new AbortController();

// Register all methods as providers
registerAdapters(msgBus, adapters, abortController.signal);

// Clean up when done
abortController.abort();
```

`registerAdapters()` iterates over each method of the service prototype, resolves the channel name via `channelSelector`, and calls `msgBus.provide()` for each one. The provider callback spreads `msg.payload` (a tuple) as arguments to the original method: `service[methodName](...msg.payload)`.

#### Calling Adapted Methods

Since method parameters are mapped to tuple types in the bus struct, use `payloadFn` for a natural function-call syntax:

```typescript
// Type-safe call — fn signature matches createOrder(items, priority)
const response = await msgBus.request({
    channel: 'API.ORDER.CREATEORDER',
    payloadFn: fn => fn([{ id: '1', qty: 2 }], 1),
});

console.log(response.payload); // OrderResult

// Also works with payload directly (tuple)
const response2 = await msgBus.request({
    channel: 'API.ORDER.GETORDER',
    payload: ['order-123'],
});
```

#### Type Transformation Chain

```
Service class                  ToMsgChannelPrefix              ToMsgStruct
─────────────                  ──────────────────              ───────────
OrderApiClient          →      "API.ORDER."              →    Bus struct
  .createOrder(a, b)              ↑                              ↓
  .getOrder(id)              removes suffix              "API.ORDER.CREATEORDER"
  .formatResponse()          from class name               in: [a, b] (Parameters<>)
                             + uppercases                  out: Result  (ReturnType<>)
                                                         "API.ORDER.GETORDER"
                                                           in: [id]
                                                           out: Order
                                                         (formatResponse skipped)
```

#### Supported Service Suffixes

The following suffixes are automatically removed from class names: `CLIENT`, `API`, `SERVICE`, `FETCHER`, `CONTROLLER`, `LOADER`, `REPOSITORY`, `PROVIDER`.

## Comparison with Other Solutions

| Feature          | @actdim/msgmesh | Event Emitters | RxJS        |
| ---------------- | --------------- | -------------- | ----------- |
| Type Safety      | ✅ Full         | ⚠️ Limited     | ✅ Full     |
| Learning Curve   | Low             | Low            | High        |
| Async Support    | ✅ Native       | ⚠️ Limited     | ✅ Full     |
| Request-Response | ✅ Built-in     | ❌ Manual      | ⚠️ Complex  |
| Boilerplate      | Minimal         | Minimal        | Medium      |
| Paradigm Shift   | None            | None           | Significant |
| Scalability      | ✅ Excellent    | ⚠️ Limited     | ✅ Good     |

## Conclusion

@actdim/msgmesh provides a powerful, type-safe, and flexible message bus solution for TypeScript applications. It combines the simplicity of event emitters with the power of message-oriented middleware, while maintaining excellent type safety and developer experience.

Key benefits:

- **Type Safety**: Full TypeScript support with compile-time checks
- **Flexibility**: Works at any scale - from single components to entire applications
- **Observability**: Built-in support for logging, tracing, and debugging
- **Developer Experience**: Minimal boilerplate, clear API, excellent IntelliSense support
- **Performance**: Single-instance architecture with efficient message routing
- **Integration**: Works seamlessly with React, async operations, and existing patterns

The message bus serves as a solid foundation for the @actdim/dynstruct architectural framework, enabling the development of scalable, maintainable, and testable applications.

## TODO

- rate limiting (for single channel, using signal after auto-'ack') and backpressure (for "in" and "out" channel pair), real send promise

## Further Reading

- [GitHub Repository](https://github.com/actdim/msgmesh)
- [@actdim/dynstruct Documentation](https://github.com/actdim/dynstruct)
- [Type Safety Best Practices](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Message-Oriented Middleware Patterns](https://www.enterpriseintegrationpatterns.com/)
