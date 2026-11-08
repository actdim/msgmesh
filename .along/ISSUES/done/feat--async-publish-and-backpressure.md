---
protocol: along
protocol_version: "4.6.1"
slug: async-publish-and-backpressure
type: feat
status: done
completed: 2026-11-08
priority: high
created: 2026-11-08
updated: 2026-11-08
agent: antigravity
tags: [async, backpressure, flow-control, send-promise]
milestone: v2.0.0-along-transition
blocked_by: []
related: [feat--send-rate-limiting, feat--ack-nack-support, feat--message-persistence]
plan_status: approved
---

# Flow control for in/out channel pairs: real send promise with in-flight limit

- Source: `src/core.ts` (`publish()`, `dispatch()`, `provide()`, `request()`, `requestStream()`)
- Contracts: `src/contracts.ts` (`MsgChannelConfig`, `MsgSenderOptions`, `MsgRequestOptions`)

## Origin

This issue implements the TODO that lived in `publish()` (`src/core.ts:343`) until it was moved to issues in commit `d4e4479`:

```typescript
subject.next(msg);
// TODO: implement backpressure using signal after auto-'ack' or "out" msg signal
return Promise.resolve(msg);
```

and the file-level TODO next to it:

```typescript
// TODO: support rate limiting (for single channel) and backpressure (for "in" and "out" channel pair), real send promise
```

Phase 1 (this issue) uses the "out" message signal. Auto-ack is phase 2 and belongs to `feat--ack-nack-support`.

## Context: why not a queue with watermarks

An earlier draft of this issue proposed a staged pipeline (rate limit gate, watermark-based queue, storage persistence, consumer ACK). It does not fit the current implementation:

- `send()` is `dispatch()`, which is an `async function`: it already allocates a Promise and a microtask. A "zero microtask" fast path is neither possible nor needed.
- There is no queue to measure. `Subject` does not buffer; delivery goes through `observeOn(asyncScheduler)`, one scheduled task per message per subscriber. `subscribe()` does not await async callbacks, so the bus does not know when a message was consumed.
- `drop_oldest` cannot be implemented: a scheduled delivery cannot be withdrawn.
- Persistence and ACK are separate features with their own issues (`feat--message-persistence`, `feat--ack-nack-support`).

What the bus already has is a completion signal for the in/out pair: `provide()` publishes to `out` for every handled message (`status: 'handled'`, also for `out: void`), and `handleError(..., true)` publishes to `out` with `status: 'failed'`. Both carry `headers.inResponseToId === requestId`. Flow control is built on that signal.

## Design

Credit-based flow control per channel: a channel has at most `maxInFlight` messages sent to its input groups and not yet answered in `out`. `send()` / `request()` acquires a slot before publishing; the slot is released by the matching `out` message or by a lease timeout. When no slot is free, `send()` waits (or fails, per config).

### Configuration

Replaces the commented-out `prefetchCount` in `MsgChannelConfig`:

```typescript
export type MsgFlowControl = {
    /** Max messages sent to the channel's input groups and not yet answered in "out". */
    maxInFlight: number;
    /** Behavior of send() when no slot is free. Default: 'wait'. */
    overflow?: 'wait' | 'error';
    /** Lease timeout: a slot is force-released if no "out" arrives in time.
     *  Default: channel timeout ?? defaultPromiseTimeout. */
    leaseTimeout?: number;
};

export type MsgChannelConfig<TChannel> = {
    // ...existing fields
    flowControl?: MsgFlowControl;
};
```

Works with `'*'` defaults like every other channel option (e.g. enable for all `API.*` channels via a function).

Out of scope on purpose: high/low watermarks (equivalent to `maxInFlight` under slot counting), `drop_oldest` (not implementable, see above), sender-side rate limiting (`feat--backpressure-and-rate-limiting`; subscriber-side `throttle` / `debounce` / `delay` already exist).

### Semantics

Scope of the gate:

- All input groups of a channel (`in`, `in1`, `in2`, ...) share one slot pool, because `out` is shared per channel.
- Never gated: publishes to `out` and `error`, to `MSGBUS.ERROR`, and cancel messages (`status: 'canceled'`) sent by `request()`. Gating `out` would deadlock (provider waits for an `out` slot while the `in` slot waits for the provider).

A slot is released by whichever comes first:

1. A message is published to `out` with `inResponseToId === requestId`, any status (`handled`, `failed`, `canceled`). Checked synchronously inside `publish()`, no extra subscription.
2. The provider cancels (`msgOut.status = 'canceled'`). Today `provide()` publishes nothing in this case, so it must call the internal `release()` in that branch.
3. `leaseTimeout` expires (safety net for stuck providers and channels without providers). A warning is logged in debug mode.
4. No subscriber is attached at publish time (`!subject.observed`): the slot is released immediately.

`skipped` does not release a slot: the next provider in the chain answers. If all providers skip, the lease timeout applies; precise handling comes with auto-ack in phase 2.

Result of `send()`: the Promise resolves when a slot is acquired and the message is published. This throttles a producer naturally (`for (...) await bus.send(...)` runs at consumer speed). Waiting for processing remains the job of `request()`.

Overflow:

- `'wait'`: FIFO waiter queue. A released slot is handed directly to the oldest waiter (no barging by new callers).
- `'error'`: immediate rejection with a new `ChannelBusyError extends BaseError` (with `.channel`, type guard `isChannelBusyError()`).

Waiting, timeout and cancellation:

- `send()`: honors `options.timeout` and `options.abortSignal` from `MsgSenderOptions` (declared today but ignored by `dispatch()`). Timeout rejects with `TimeoutError`, abort with `OperationCanceledError`. The waiter is removed from the queue; it never held a slot.
- `request()`: slot waiting is bounded by `options.sendTimeout` (declared in `MsgRequestOptions`, currently unused). The overall `timeout` keeps its current meaning, so calls on channels without `flowControl` behave exactly as before.

Fire-and-forget safety: internally `const p = ...; p.catch((err) => handleError(...)); return p;`. Awaiting callers still get the rejection; unawaited calls produce no unhandled rejection, and the error goes to `channel:error` and `MSGBUS.ERROR`. Trade-off to document: a gate error is always also reported on the error channels.

## Implementation plan (`src/core.ts`)

State inside `createMsgBus`:

```typescript
type Lease = { count: number; timer: ReturnType<typeof setTimeout> };
type Waiter = { resolve: () => void; reject: (err: unknown) => void; cleanup: () => void };
type FlowState = {
    limit: number;
    inFlight: number;
    leases: Map<string, Lease>; // key: requestId (count handles caller-supplied duplicate requestIds)
    waiters: Waiter[]; // FIFO
};
const flows = new Map<string, FlowState>(); // key: channel
```

Helpers:

- `acquire(channel, flowControl, options): Promise<void> | undefined` - if `inFlight < limit`, increments and returns `undefined` (sync path, no Promise); otherwise enqueues (`'wait'`) or throws `ChannelBusyError` (`'error'`).
- `lease(channel, requestId, timeout)` - after publish: records the lease and starts its timer.
- `release(channel, requestId)` - decrements the lease, clears the timer, hands the slot to the next waiter or decrements `inFlight`. Idempotent for unknown `requestId`.

Insertion points:

1. `dispatch()`: after the `out` subscription (subscribe-before-publish order is preserved) and before `publish()`:

   ```typescript
   const flowControl = channelConfig.flowControl;
   if (flowControl && isInputGroup(group) && status !== 'canceled') {
       const wait = acquire(channel, flowControl, params.options);
       if (wait) {
           await wait; // on rejection: unsubscribe the out-subscription created above
       }
   }
   const msg = await publish(/* ... */);
   if (flowControl) {
       subject.observed ? lease(channel, requestId, timeout) : release(channel, requestId);
   }
   ```

2. `publish()`: when `group === 'out'` and `headers.inResponseToId` is set and the channel has a `FlowState`, call `release(channel, inResponseToId)` (one `Map` lookup).
3. `provide()`: call `release()` in the `outMsg.status === 'canceled'` branch.
4. `requestStream()`: publishes directly via `publish()`, bypassing `dispatch()`; needs the same `acquire` + `lease`. The slot is released by the first response (later responses are stream data, not delivery confirmation).
5. `request()`: pass `sendTimeout` to `dispatch()` as the slot-wait timeout.

Fast path: a channel without `flowControl` costs one field check; no `FlowState` is created and the code path is unchanged.

Public API changes: new config field `flowControl`, new error `ChannelBusyError` + guard. Optional: `bus.getFlowStats(channel)` returning `{ inFlight, waiting, limit }` for diagnostics.

Note: the work touches more than three files (`contracts.ts`, `core.ts`, tests, docs). Per protocol the plan must declare `Execution Mode: Direct` or run via `along-team`.

## Follow-up phases (not in this issue)

- Phase 2 - auto-ack (`feat--ack-nack-support`): release slots for channels with no `out` (only `on()` subscribers, all providers `skipped`). A `tap` right after the synchronous `filter` in `subscribe()` counts accepting subscriptions; awaited callback settlement decrements; zero releases the slot. Restore `AckMode = 'atLeastOne' | 'all'` (removed in `8cc00ad`). Caveat: messages dropped by `throttle` / `debounce` after the filter never ack; they fall back to `leaseTimeout`, or the combination is disallowed.
- Phase 3 - transport backpressure in `msgmesh-remote`: `client.send()` is synchronous and ignores `socket.bufferedAmount`. Needs its own gate; separate issue in that package. Phase 1 already gives end-to-end flow control when the provider is remote (its `out` is republished locally), but the socket buffer stays unbounded.
- Persistence stays in `feat--message-persistence`; its "persist before delivery" model must be reconciled with the CDC bridge in `msgmesh-store` (store -> CDC -> bus).

## Acceptance Criteria

- [x] `MsgFlowControl` and `MsgChannelConfig.flowControl` added in `src/contracts.ts`; commented `prefetchCount` replaced.
- [x] `ChannelBusyError` + `isChannelBusyError()` exported.
- [x] Channels without `flowControl`: existing test suite passes unchanged; micro-benchmark (100k `send()` calls) shows no regression versus HEAD.
- [x] `maxInFlight: N` with a slow provider: the (N+1)-th `send()` stays pending until the first `out` arrives.
- [x] FIFO: the oldest waiter gets the released slot first.
- [x] `overflow: 'error'` rejects with `ChannelBusyError`.
- [x] `timeout` / `abortSignal` on a waiting `send()` reject with `TimeoutError` / `OperationCanceledError`; the waiter is removed and no slot leaks.
- [x] Slots are released by `out` with `failed` (provider threw) and by provider-side `canceled`.
- [x] `leaseTimeout` releases a slot when the provider never answers.
- [x] No subscribers at publish: slot released immediately.
- [x] `out`, `error` and cancel messages are never gated; no deadlock when a provider on channel A requests channel B, both with `maxInFlight: 1`.
- [x] `request()` honors `sendTimeout` while waiting for a slot.
- [x] `requestStream()` acquires a slot and releases it on the first response.
- [x] Unawaited `send()` with a gate error: no unhandled rejection; error appears on `MSGBUS.ERROR`.
- [x] No leaks: after a burst of requests `flows` holds no leases and all timers are cleared (pattern of `tests/timeoutTimerLeak.test.ts`).
- [x] Docs updated: `docs/topic--02-architecture-and-types.md`, `docs/topic--04-advanced-patterns.md`, package `AGENTS.md` (Internal Flow, Common Pitfalls).
