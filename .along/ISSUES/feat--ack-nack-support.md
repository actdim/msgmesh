---
protocol: along
slug: ack-nack-support
type: feat
status: open
priority: high
created: 2026-08-13
updated: 2026-11-08
agent: antigravity
tags: [ack, flow-control]
milestone: v2.0.0-along-transition
blocked_by: [feat--async-publish-and-backpressure]
related: [feat--async-publish-and-backpressure, feat--message-persistence]
---

# Support ACK / NACK and MsgRecord tracking

- Source: `src/core.ts:158`, `src/core.ts:842`, `src/contracts.ts:287`

## Context

Messages currently dispatch without explicit delivery receipt. Adding `ack`/`nack` support allows callers to verify that messages were processed by subscribers.

## Requirements

- Introduce `MsgRecord` tracking (`msg`, `acked`, `ackedAt`).
- Implement custom `RepeatSubject` for retransmitting unacknowledged messages.
- Support auto-ack on publish to `"out"` channel and dedicated `"ack"` message group.

## Draft Implementation / Reference Code

```typescript
type MsgRecord<TStructN> = {
    msg: Msg<TStructN>;
    acked: boolean;
    ackedAt?: number;
};

class RepeatSubject<T> {
    private buffer: Msg<T>[] = [];
    private subject = new Subject<Msg<T>>();

    next(msg: Msg<T>) {
        this.buffer.push(msg);
        this.subject.next(msg);
    }

    subscribe(observer: (msg: Msg<T>) => void, filterFn?: (msg: Msg<T>) => boolean) {
        this.buffer.filter(filterFn ?? (() => true)).forEach(observer);
        return this.subject.subscribe(observer);
    }
}
```

## Phase 2 of flow control: auto-ack (added 2026-11-08)

`feat--async-publish-and-backpressure` (phase 1) limits in-flight messages per channel and releases a slot on the matching `out` message, provider-side `canceled`, or a lease timeout. Channels without an `out` answer fall back to the lease timeout: channels with only `on()` subscribers, and messages that every provider marks `skipped`. Auto-ack closes that gap and is the first deliverable of this issue.

- REQ-A1: In `subscribe()`, a `tap` placed right after the synchronous `filter` operator MUST register each accepting subscription on the message lease (`pending++`).
- REQ-A2: Subscription callbacks MUST be awaited for ack purposes: when a sync callback returns or an async callback settles, `pending--`. Today `subscribe()` drops the callback result.
- REQ-A3: The slot MUST be released when `pending` reaches zero, or earlier by the phase 1 signals (`out`, provider `canceled`).
- REQ-A4: Restore `AckMode = 'atLeastOne' | 'all'` (removed in commit `8cc00ad`) as `flowControl.ackMode`: release on the first settled callback or on all of them.
- REQ-A5: `provide()` invocations that end `skipped` MUST count as settled, so a channel where all providers skip releases its slot without waiting for the lease timeout.
- Caveat: a message accepted by the filter and then dropped by `throttle` / `debounce` never settles; it falls back to `leaseTimeout`. Either document this or reject `flowControl` combined with channel-level `throttle` / `debounce`.

Manual ack / nack, `MsgRecord` and `RepeatSubject` redelivery (sections above) build on the same lease ledger and come after auto-ack.
