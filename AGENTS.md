# AGENTS.md — Codex Context for @actdim/msgmesh

## Project Purpose

`@actdim/msgmesh` is a type-safe message bus for TypeScript applications.
It is built on RxJS internally, but RxJS must stay an implementation detail in public-facing code and docs.

Main API surface is produced by `createMsgBus<TStruct>()` and includes:

- `send()`
- `on()`
- `once()`
- `stream()`
- `provide()`
- `request()`

## Repository Map

- `src/contracts.ts`: core types, constants, error classes, API contracts
- `src/core.ts`: runtime implementation (`createMsgBus`, routing, dispatch/request/stream logic)
- `src/adapters.ts`: service-to-msgbus adapter utilities
- `src/util.ts`: helper operators/utilities
- `tests/msgBus.test.ts`: primary behavioral test suite
- `tests/testDomain.ts`: canonical test message structure and test bus factory

## Local Commands

- Install deps: `pnpm install`
- Test: `pnpm run test`
- Watch tests: `pnpm run test:w`
- Typecheck: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Build: `pnpm run build`

## Message Model (Must Preserve)

Address shape: `{ channel, group, topic }`

- `channel`: logical namespace (`"Feature.Action"` style)
- `group`: message direction/type bucket
  - `in` (default input)
  - `out` (provider response)
  - `error` (channel-level error stream)
  - custom groups allowed (multiplexing)
- `topic`: optional secondary filter; supports exact match or regex string (`"/^foo.*/"`)

Reserved system channel:

- `MSGBUS.ERROR`

## Critical Runtime Invariants

1. `publish()` must assign defaults:
   - generate `msg.id` if missing
   - set `headers.status = "ok"` if missing
   - set `headers.publishedAt`

2. Routing key is `channel:group`.

3. `dispatch()` ordering is important:
   - subscribe to `out` response first (when callback path is used)
   - publish request second
   - do not invert this order

4. Response correlation:
   - request uses `headers.requestId`
   - provider response must set `headers.inResponseToId = request.requestId`
   - request resolution filters by this correlation

5. Cancellation flow for `request()`:
   - on abort, publish cancel message to `in` with same `requestId` and `status: "canceled"`
   - provider callback receives cancel message
   - provider should not emit normal `out` response for canceled message
   - requester rejects with `OperationCanceledError`

6. Error routing:
   - callback/provider errors are routed to both:
     - `<channel>:error` (topic `msgbus`)
     - `MSGBUS.ERROR:in` (topic `msgbus`)

7. `stream()` timeout is inactivity timeout, not absolute stream lifetime.

## Typing Rules

1. Bus structures should be declared with generic `MsgStruct<...>` so system channel groups are added consistently and the same base type is used across the API.
2. `out` payload types are plain values (no `Promise` wrapping in type definitions).
3. Keep strict channel/group payload typing intact for all public methods.
4. `payloadFn` is used for tuple-based payload channels (especially adapters).

## Adapter Notes

Adapter utilities derive channels from service classes and map method signatures to bus contracts.

- `ToMsgChannelPrefix<...>` derives channel prefix from class name.
- `ToMsgStruct<...>` maps methods to channels:
  - `in` = tuple of method args
  - `out` = method return type
- `registerAdapters(...)` registers providers from service methods.

When editing adapter logic, validate both:

- compile-time typing behavior
- runtime channel/method registration behavior

## Change Policy for Codex

When making changes:

1. Prefer minimal diffs that preserve public API compatibility.
2. Do not expose RxJS types/operators in external API contracts.
3. Keep cancellation and timeout semantics backward-compatible.
4. Add/adjust tests in `tests/msgBus.test.ts` for any behavioral changes.
5. If changing typings, ensure tests and typecheck still pass.

## Validation Checklist

Before finishing implementation tasks, run:

1. `pnpm run typecheck`
2. `pnpm run test`

If change affects API shape or build artifacts, also run:

3. `pnpm run build`

## Preferred Patterns

- Use `AbortSignal` for subscription/request lifecycle control.
- Use `fetchCount` for finite subscriptions.
- Use `topic` regex form (`"/.../"`) when pattern matching is required.
- For long-running providers, track active requests by `requestId` and handle cancel messages explicitly.

## Pitfalls to Avoid

- Breaking `requestId`/`inResponseToId` correlation.
- Publishing `out` for cancel messages.
- Changing default `group` fallback from `in`.
- Conflating `msg.id` (transport id) with `headers.requestId` (logical request id).
- Treating `stream()` timeout as total duration.

## Reference Files

- `README.md` for public usage/examples
- `src/contracts.ts` for canonical contracts
- `src/core.ts` for behavior invariants
- `tests/msgBus.test.ts` for expected runtime semantics
