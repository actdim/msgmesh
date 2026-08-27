---
protocol: along
slug: ack-nack-support
type: feat
status: open
priority: high
created: 2026-08-13
updated: 2026-08-13
agent: antigravity
tags: []
milestone: v2.0.0-along-transition
blocked_by: []
related: []
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
