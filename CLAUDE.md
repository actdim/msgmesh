# CLAUDE.md — AI Context for @actdim/msgmesh

## Project

Type-safe message bus for TypeScript. Built on RxJS (Subjects + pipe operators), but RxJS is an implementation detail — the public API is simple pub/sub + request/response.

Part of the @actdim/dynstruct architectural framework.

## File Structure

```
src/
  contracts.ts   — All types, interfaces, error classes (MsgStruct, MsgBus, MsgHeaders, Msg, etc.)
  core.ts        — Implementation (createMsgBus): publish, subscribe, provide, dispatch, request, stream
  adapters.ts    — Service adapter system: registerAdapters, ToMsgStruct, ToMsgChannelPrefix, getMsgChannelSelector
  util.ts        — Helpers (delay, throttle options)
tests/
  msgBus.test.ts — Main test suite (vitest)
  testDomain.ts  — Test bus structure (TestBusStruct) and shared bus instance
```

## Commands

- `pnpm run test` — run tests (vitest)
- `pnpm run build` — typecheck + vite build
- `pnpm run typecheck` — tsc --noEmit

## Architecture

### Message Addressing: Channel → Group → Topic

Every message has an address: `{ channel, group, topic }`.

- **Channel** — logical namespace (e.g. `"User.Login"`, `"Api.FetchData"`). String with dot notation.
- **Group** — message direction within a channel:
  - `"in"` — requests/events (default for `send`, `on`, `provide`)
  - `"out"` — responses (auto-published by `provide`, consumed by `request`)
  - `"error"` — channel-specific errors (auto-published on provider throw)
  - Custom groups allowed for multiplexing (e.g. `"in1"`, `"in2"`)
- **Topic** — optional sub-filter. Exact match by default. Regex if wrapped in slashes: `"/^task-.*/"`.
- **Reserved**: `"MSGBUS.ERROR"` channel for system-level errors.

### Type Structure

Bus should be defined via `MsgStructFactory` — it augments your structure with system channel groups (for example, `error`) and keeps contracts aligned with runtime behavior:

```typescript
type MyBus = MsgStructFactory<{
    "Order.Create": {
        in: { items: Item[] };    // request payload
        out: OrderResult;         // response payload
    };
}>;
```

`out` types should NOT be wrapped in `Promise` — async is handled at the API level.

### Public API vs Internal Functions

Both `send()` and `request()` use internal `dispatch()`. `publish()` is a lower-level internal function.

| Public method | Internal function | Notes |
|--------------|-------------------|-------|
| `send()` | `dispatch()` | Effectively just publish (no `callback` in `MsgSenderParams`, so `dispatch` skips `out` subscription). Generates `requestId` in headers |
| `on()` | `subscribe()` | Direct subscription |
| `once()` | `subscribe()` with `fetchCount: 1` + Promise wrapper |
| `stream()` | `subscribe()` + async generator with manual Promise queue |
| `provide()` | `subscribe()` + auto-publish to `out` |
| `request()` | `dispatch()` + Promise.race with timeout |

`publish()` is a purely internal function — not exposed in the public API. It generates `msg.id`, sets default `status: "ok"`, sets `publishedAt`, and calls `Subject.next()`.

### Internal Flow

#### Subject Routing

Messages are routed via RxJS Subjects stored in `Map<string, Subject>`.

- **Routing key**: `"channel:group"` (e.g. `"User.Login:in"`, `"User.Login:out"`)
- One Subject per channel+group pair, created lazily by `getOrCreateSubject()`
- `ReplaySubject` used when config has `replayBufferSize` or `replayWindowTime`; plain `Subject` otherwise

#### Pipe Chain Order

Each subscription builds an RxJS pipe chain in this exact order:

```
filter(topic match + custom filter)
  → channel throttle (from config)
    → subscription throttle (from options)
      → channel debounce (from config)
        → subscription debounce (from options)
          → channel delay (from config)
            → observeOn(asyncScheduler)
              → take(fetchCount)
```

The `asyncScheduler` ensures message delivery is always async (never synchronous in the same microtask as `publish()`).

#### dispatch() — Critical Ordering

`dispatch()` (which is exposed as public `send()`):
1. **First**: subscribes to `out` group with filter `msgOut.headers.inResponseToId === msg.headers.requestId`
2. **Then**: publishes message to `in` group via `publish()`
3. Returns the published message (with `headers.requestId`)

This order is critical — subscribing after publishing could miss the response if it arrives synchronously.

#### provide() — Headers Merge & Cancel Logic

```typescript
const headers = { ...msgIn.headers, ...params.headers, inResponseToId: msgIn.headers.requestId };
// msgIn.headers first, then provider's static headers override, inResponseToId always wins
```

On cancel: `provide()` calls the callback (so provider can react), but does NOT publish `out` response:
```typescript
if (msgIn.headers?.status === 'canceled') {
    return; // after callback, skip publish to out
}
```

#### request() — Response Handling

`request()` checks response `status` in this order:
1. `'canceled'` → reject with `OperationCanceledError`
2. `'error'` → reject with `Error` (message from `headers.error`)
3. Else → set `status = 'ok'`, resolve

**Default timeout**: 2 minutes (`DEFAULT_PROMISE_TIMEOUT = 1000 * 60 * 2`).

#### request() — Abort Timing

Abort listener is set up AFTER `await dispatch()` completes (not before). Then checks `abortSignal.aborted` for early abort. This means: if abort fires during publish, it's caught by the `aborted` check after dispatch returns.

#### Error Routing

On error in `provide()` or `subscribe()` callback, errors are published to BOTH:
1. `channel:error` group (channel-specific, topic: `"msgbus"`)
2. `MSGBUS.ERROR:in` channel (global, topic: `"msgbus"`)

Payload: `{ error, source: { id, address, headers } }`

## Key Concepts

### msg.id vs headers.requestId

- `msg.id` — **transport ID**. Unique per published message. Generated by `publish()`. Every message gets a new one.
- `headers.requestId` — **logical request ID**. Generated once per `dispatch()` call: `params.headers?.requestId || uuid()`. Shared between the original request and its cancel message. Used to correlate request → response.

The cancel message has the SAME `requestId` as the original but a DIFFERENT `msg.id`.

### headers.inResponseToId

Set by `provide()` on the `out` response: `inResponseToId = msgIn.headers.requestId`. This is how `dispatch()` filters the correct response for a given request.

### Cancellation Flow

1. Caller calls `request({ ..., options: { abortSignal } })`
2. On abort: `request()` publishes a cancel message to `in` group with `{ requestId: <same>, status: 'canceled' }`
3. `provide()` callback receives the cancel message — provider can clean up (e.g. abort fetch)
4. `provide()` does NOT publish `out` for cancel messages
5. `request()` rejects with `OperationCanceledError`

Provider-side pattern for cancelable work:
```typescript
const activeRequests = new Map<string, AbortController>();
msgBus.provide({
    channel: "...",
    callback: async (msg, headers) => {
        if (headers.status === 'canceled') {
            activeRequests.get(headers.requestId)?.abort();
            activeRequests.delete(headers.requestId);
            return;
        }
        const ctrl = new AbortController();
        activeRequests.set(headers.requestId, ctrl);
        try {
            return await doWork({ signal: ctrl.signal });
        } finally {
            activeRequests.delete(headers.requestId);
        }
    }
});
```

### headers.status (ResponseStatus)

`"ok" | "error" | "canceled" | "timeout"`

- `publish()` sets `status = "ok"` by default if not specified
- `request()` sends `status: "canceled"` on abort
- `provide()` errors set `status: "error"`

### Error Types

- `TimeoutError` — timeout exceeded (request, once). Default: 2 minutes.
- `AbortError` — subscription aborted via AbortSignal (on, once, stream)
- `OperationCanceledError` — request canceled (request with abortSignal)

All extend `BaseError`. Use `isTimeoutError()`, `isAbortError()`, `isOperationCanceledError()` type guards.

### stream() Specifics

- Async generator (`async function*`) with manual Promise-based message queue
- Uses sentinel value `Symbol("stream-end")` for clean shutdown
- **Timeout is inactivity timeout** (resets on each message), NOT total duration
- Supports `fetchCount` (max messages) and `abortSignal`

### settled Pattern

`once()` and `request()` use a `settled` boolean flag to prevent double resolution of the Promise. Always check `if (settled) return` before resolving/rejecting, and set `settled = true` immediately after.

### Service Adapters (adapters.ts)

Automatically wraps a service object (e.g. Swagger-generated API client) as a bus provider. All wiring is compile-time type-safe.

**Type transformation chain:**
```
Class: OrderApiClient                    Bus struct:
  .createOrder(a: Item[], b: number)  →  "API.ORDER.CREATEORDER": { in: [Item[], number]; out: OrderResult }
  .getOrder(id: string)               →  "API.ORDER.GETORDER": { in: [string]; out: Order }
```

Key types:
- `ToMsgChannelPrefix<ClassName, Prefix, Suffix>` — generates channel prefix from class name. Removes known suffixes (CLIENT, API, SERVICE, etc.), uppercases. E.g. `"OrderApiClient"` + `"API"` → `"API.ORDER."`
- `ToMsgStruct<Service, Prefix, Skip>` — maps service methods to bus struct. Method params → `in` tuple (`Parameters<>`), return type → `out` (`ReturnType<>`). `Skip` excludes methods from the type.
- `MsgStructFactory<T>` — adds `error` group to each channel in struct

Runtime:
- `registerAdapters(msgBus, adapters, abortSignal?)` — registers each method as `provide()` handler. Callback spreads `msg.payload` tuple as method arguments: `service[method](...msg.payload)`
- `getMsgChannelSelector(services)` — creates a channel resolver from service map

**Important**: `ToMsgStruct` enforces type safety at compile time (wrong channel names won't compile), but `registerAdapters` registers ALL methods at runtime (including skipped ones). The `Skip` parameter only affects the TypeScript type, not runtime registration.

`payloadFn` is the natural way to call adapted methods since payload types are tuples:
```typescript
msgBus.request({ channel: "API.ORDER.CREATEORDER", payloadFn: fn => fn(items, priority) });
```

## Code Conventions

- TypeScript strict mode
- Vitest for tests
- Path alias `@/` → `src/`
- RxJS is internal only — never exposed in public API
- All public API is on the `MsgBus` interface returned by `createMsgBus<TStruct>(config?)`
- Generic type parameters: `TStruct` (bus structure), `TStructN` (normalized, Awaited), `TChannel`, `TGroup`, `THeaders`
- Payload types are resolved from the struct: `in` group → `InStruct<TStruct, TChannel>`, `out` group → `OutStruct<TStruct, TChannel>`
- `MsgStructNormalized<TStruct>` applies `Awaited<>` to all payload types (unwraps Promises)

## Testing

Tests are in `tests/msgBus.test.ts`. Test domain defined in `tests/testDomain.ts`:

```typescript
type TestBusStruct = {
    "Test.ComputeSum": { in: { a: number; b: number }; out: number };
    "Test.DoSomeWork": { in: string; out: void };
    "Test.TestTaskWithRepeat": { in: string; out: void };
    "Test.Multiplexer": { in1: string; in2: number; out: number };
};
```

`createTestMsgBus()` creates a fresh bus instance. `sharedMsgBus` is a shared instance used across tests.

Ignore `mocha.test.ts` — it's a legacy file, fails with "describe is not defined" (Mocha globals not available in vitest). Not related to the library.

## Common Pitfalls

- **`send()` uses `dispatch()` internally** but without callback — so it's effectively just a publish with `requestId` generation. The `out` subscription in `dispatch()` only activates when `request()` passes a callback.
- **Headers spread order in `provide()`**: `{ ...msgIn.headers, ...params.headers, inResponseToId }` — provider's static headers override incoming, but `inResponseToId` always wins.
- **Cancel message has no payload**: only `{ requestId, status: 'canceled' }` in headers. Provider must handle `msg.payload` being `undefined` for cancel messages.
- **`dispatch()` subscribe-before-publish**: changing this order breaks request-response correlation.
- **`request()` abort after dispatch**: abort listener is attached after `await dispatch()`, not before. Immediate abort is handled by checking `abortSignal.aborted`.
- **`asyncScheduler` makes delivery async**: callbacks are never called synchronously within the same `publish()` call. Tests use `await delay()` to let the scheduler process messages.
