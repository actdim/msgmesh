# Living Plan: async-publish-and-backpressure

## Revision 1 (2026-11-08T19:24:05Z, ExitPlanMode)

# Plan: msgmesh flow control (feat--async-publish-and-backpressure, phase 1)

Execution Mode: Direct

## Context

`bus.send()` returns `Promise.resolve(msg)` right after `subject.next()`; a fast producer has no way to slow down for a slow provider. The issue (rewritten and committed in `cc784e7`) specifies credit-based flow control per channel: at most `maxInFlight` messages sent to the channel's input groups without an `out` answer. `send()` / `request()` / `requestStream()` take a slot before publishing; the slot is released by the matching `out` message (any status), by provider-side `canceled`, by a lease timeout, or immediately when nobody is subscribed. Opt-in per channel; channels without `flowControl` behave exactly as today.

## Changes

### 1. `src/contracts.ts`
- `MsgFlowControl = { maxInFlight: number; overflow?: 'wait' | 'error'; leaseTimeout?: number }`; `MsgChannelConfig.flowControl?: MsgFlowControl` (replaces the commented `prefetchCount` line; other commented ack lines stay).
- `ChannelBusyError extends BaseError` (`.channel`, same shape as `NoProviderError`) + `isChannelBusyError()`.
- `MsgFlowStats = { limit: number; inFlight: number; waiting: number; leases: number }`; `MsgBus.getFlowStats(channel): MsgFlowStats | undefined` (needed by the leak tests, useful for diagnostics; only `src/core.ts` builds a `MsgBus` literal in the repo).
- Doc comments: `MsgSenderOptions.timeout/abortSignal` now bound slot waiting; `MsgRequestOptions.sendTimeout` bounds slot waiting in `request()`.

### 2. `src/core.ts` (all inside `createMsgBus`)
- State: `flows: Map<channel, FlowState>` with `{ limit, inFlight, leases: Map<requestId, { count, timer }>, waiters: Waiter[] }`; `flowConfigs: Map<channel, MsgFlowControl | null>` caches the resolved config so the fast path does not pay `getChannelConfig()`'s object spread on every `send()`.
- Helpers:
  - `getFlowControl(channel, group)` - `undefined` for `out` / `error` groups or channels without config; validates `maxInFlight >= 1`.
  - `acquireSlot(channel, fc, wait: { timeout?, signals: AbortSignal[] }): Promise<void> | undefined` - sync `undefined` when a slot is free; `'error'` -> throw `ChannelBusyError`; `'wait'` -> FIFO waiter with timeout (`TimeoutError`) and abort (`OperationCanceledError`) that removes itself and clears its timer/listeners.
  - `openLease(channel, requestId, leaseTimeout)` - registered BEFORE `publish()`; `releaseSlot(channel, requestId)` - idempotent, decrements lease count, clears timer, hands the slot to the oldest waiter (no barging) or decrements `inFlight`; lease timeout -> `releaseSlot` + debug warning.
  - `leaseTimeout` default: `fc.leaseTimeout ?? channelConfig.timeout ?? defaultPromiseTimeout`.
- `publish()`: if `group === 'out'`, `flows.size > 0` and `headers.inResponseToId` -> `releaseSlot(channel, inResponseToId)`. Covers `handled`, `failed` from `handleError(..., true)`, and stream responses (first one releases, the rest are no-ops).
- `provide()`: in the skip branch, when `outMsg.status === 'canceled'` -> `releaseSlot(channel, inMsg.headers.requestId)`. Not on `inMsg.status === 'canceled'` (original invocation may still be running) and not on `skipped` (next provider answers; lease timeout otherwise).
- `dispatch()`: after the existing `out` subscription, gate with `acquireSlot`; on rejection unsubscribe the `out` subscription and rethrow. Then `openLease`, `publish`, and if the input subject has no observers release immediately. New internal field on `MsgDispatcherParams`: `flowWait?: { timeout?: number; signals: AbortSignal[] }`; when absent (plain `send()`), use `params.options.timeout` / `abortSignal`.
- `send`: new thin wrapper over `dispatch`; only for flow-controlled channels attaches `p.catch(err => ...)` that reports gate errors (except `OperationCanceledError`) via `handleError()` to `channel:error` and `MSGBUS.ERROR`. Awaiting callers still get the rejection; unawaited calls produce no unhandled rejection.
- `request()`: passes `flowWait = { timeout: options.sendTimeout, signals: [options.abortSignal, timeoutAc.signal] }`. `timeoutAc` already aborts in `finally` when the race settles, so an overall request timeout also removes a still-waiting dispatch (no orphan publish later).
- `requestStream()`: same gate around its direct `publish()` (wait bounded by `options.timeout` and `abortSignal`); release on the first response happens via the `publish()` hook.
- Untouched: `subscribe()` pipe chain, `observeOn(asyncScheduler)`, `once()`, `stream()`, `handleError()` publishes (they call `publish()` directly and are never gated), cancel messages from `request()` (direct `publish()`).

### 3. Tests: new `tests/flowControl.test.ts`
Pattern from `tests/timeoutTimerLeak.test.ts` (`createMsgBus<AnyBusStruct>()`, fake timers where timing matters). Cases = the issue's acceptance criteria:
- no `flowControl`: `getFlowStats` returns `undefined`, existing suites unchanged;
- `maxInFlight: 2` + slow provider: 3rd `send()` pending until first `out`; FIFO order of waiters;
- `overflow: 'error'` -> `ChannelBusyError`;
- `timeout` / `abortSignal` on waiting `send()` -> `TimeoutError` / `OperationCanceledError`, waiter removed, counters intact;
- release by `failed` (provider throws) and by provider `canceled`; `skipped` holds until lease timeout;
- `leaseTimeout` with a silent provider; no subscribers -> immediate release;
- no deadlock: provider on A requests B, both `maxInFlight: 1`;
- `request()` with `sendTimeout`; overall request timeout while waiting leaves no orphan publish;
- `requestStream()` takes a slot and frees it on the first response;
- unawaited `send()` with `overflow: 'error'`: no unhandled rejection, error on `MSGBUS.ERROR`;
- leak check: after a burst `getFlowStats` shows 0 in flight / 0 leases and `vi.getTimerCount()` is 0.

### 4. Docs
- `docs/topic--04-advanced-patterns.md`: new "Flow control (backpressure)" section (config, release signals, overflow, timeouts, fire-and-forget, when to use, phase 2/3 pointers).
- `docs/topic--02-architecture-and-types.md`: `MsgFlowControl`, `ChannelBusyError`, `getFlowStats` in the types section.
- `docs/topic--03-api-reference.md`: `send()` options now meaningful, `sendTimeout`, `getFlowStats`.
- Package `AGENTS.md` (project part only, not the managed protocol block): Internal Flow note on the gate in `dispatch()` and release in `publish()`, Common Pitfalls (out/error/cancel never gated, `skipped` waits for lease timeout).

## Verification
1. Baseline before edits: temporary micro-benchmark (100k `send()` on a channel with one `on()` subscriber, no `flowControl`) run with vitest on HEAD; same file after the change; compare; the temp file is not committed, numbers go into the wrap summary.
2. `pnpm run typecheck`, `pnpm run test` (all suites incl. new one), `pnpm run lint`, `pnpm run build`.
3. Blast radius: `along graph-impact` / grep consumers of `MsgBus` type in apps (`webapp`, `server`, `msgmesh-remote` structural `RemoteBusLike` needs no change).
4. Commit via `along commit -i async-publish-and-backpressure`, then `along wrap async-publish-and-backpressure --no-decisions` (or an ADR if the user wants the flow-control design recorded). No version bump (monorepo-wide only).
