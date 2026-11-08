---
protocol: along
protocol_version: "4.6.1"
slug: flow-control-resume-threshold
type: feat
status: open
priority: low
created: 2026-11-08
updated: 2026-11-08
agent: claude-code
tags: [flow-control, backpressure, watermarks, batching]
milestone: v2.0.0-along-transition
blocked_by: [feat--async-publish-and-backpressure]
related: [feat--async-publish-and-backpressure, feat--send-rate-limiting]
---

# Flow control resume threshold (resumeAt / low watermark) for batched release

- Source: `src/core.ts` (flow control `release()` introduced by `feat--async-publish-and-backpressure`), `src/contracts.ts` (`MsgFlowControl`)

## Context

Phase 1 flow control (`feat--async-publish-and-backpressure`) hands each released slot to the oldest waiter immediately: one `release()` wakes exactly one `send()`. That is optimal for the in-process bus, where waking a waiter is just resolving a Promise, and it needs no hysteresis.

Some consumers prefer work in batches rather than a trickle: a Web Worker that processes messages in chunks, an adapter that coalesces calls, a UI that re-renders once per burst. For them a classic low watermark is useful: once the channel is full, producers stay paused until in-flight drops to a lower threshold, and then the waiters are released together.

This is an optional extension. Implement it only when a concrete consumer needs batched release; until then this issue documents the design so it stays compatible with phase 1.

## Design

```typescript
export type MsgFlowControl = {
    maxInFlight: number;
    overflow?: 'wait' | 'error';
    leaseTimeout?: number;
    /** Low watermark. When set, a full channel stays paused until inFlight <= resumeAt,
     *  then waiters are admitted in FIFO order up to maxInFlight. Default: undefined
     *  (phase 1 behavior: every released slot goes to the next waiter at once). */
    resumeAt?: number;
};
```

Semantics:

- The channel enters a `paused` state when `inFlight` reaches `maxInFlight` and there are waiters.
- While paused, `release()` only decrements `inFlight`; no waiter is admitted and new `send()` calls queue behind existing waiters (no barging).
- When `inFlight <= resumeAt`, the state switches to `running` and waiters are admitted in FIFO order until `inFlight` is back at `maxInFlight` or the queue is empty.
- `resumeAt` MUST satisfy `0 <= resumeAt < maxInFlight`; `resumeAt = maxInFlight - 1` is equivalent to phase 1 behavior.
- Lease timeouts, aborts and `ChannelBusyError` behave as in phase 1; an aborted waiter never counts toward `inFlight`.

Not to be confused with transport watermarks in `msgmesh-remote` (issue `feat--socket-backpressure` there): those measure bytes in a socket buffer and must poll `bufferedAmount`; this one counts unanswered messages and is event driven.

## Requirements

- REQ-1: `MsgFlowControl` MUST accept optional `resumeAt`; invalid values (negative, `>= maxInFlight`) MUST throw at bus creation or on first use of the channel config.
- REQ-2: Without `resumeAt`, behavior MUST be identical to phase 1.
- REQ-3: With `resumeAt`, a paused channel MUST NOT admit waiters until `inFlight <= resumeAt`, then MUST admit them in FIFO order up to `maxInFlight`.
- REQ-4: New `send()` calls MUST NOT bypass queued waiters while the channel is paused.
- REQ-5: `bus.getFlowStats(channel)` (if added in phase 1) MUST report the `paused` state.

## Acceptance Criteria

- [ ] `maxInFlight: 4, resumeAt: 1`: with 4 in flight and 4 waiters, releasing 1 and 2 slots admits nobody; releasing the 3rd admits 3 waiters at once.
- [ ] No `resumeAt`: the phase 1 test suite passes unchanged.
- [ ] Invalid `resumeAt` rejected with a clear error.
- [ ] No barging: a `send()` issued while paused is admitted after earlier waiters.
- [ ] Abort or timeout of a waiter while paused leaves counters consistent (no leaked slots or timers).
- [ ] Docs: `docs/topic--04-advanced-patterns.md` explains when to use `resumeAt` and how it differs from transport watermarks.
