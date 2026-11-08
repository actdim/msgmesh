---
protocol: along
slug: send-rate-limiting
type: feat
status: open
priority: high
created: 2026-08-13
updated: 2026-11-08
agent: antigravity
tags: [rate-limit, flow-control, send]
milestone: v2.0.0-along-transition
blocked_by: [feat--async-publish-and-backpressure]
related: [feat--async-publish-and-backpressure]
---

# Sender-side rate limiting per channel

- Source: `src/core.ts` (`dispatch()`), `src/contracts.ts` (`MsgChannelConfig`)

## Scope change (2026-11-08)

This issue was originally "Rate limiting and backpressure support" and covered three items:

- rate limiting per channel;
- backpressure for the `in` / `out` channel pair;
- a real send promise from `publish()` that resolves when capacity is available.

The backpressure and real send promise parts moved to `feat--async-publish-and-backpressure` (in-flight limit per channel, slot released by the `out` signal). This issue now covers only sender-side rate limiting.

## Context

Existing `throttle` / `debounce` / `delay` (channel config and `MsgSubOptions`) act on the subscriber side: they drop or postpone delivery, and the producer never notices. There is no way to make `send()` itself respect a rate (for example, an API adapter channel that must not exceed N calls per second to a backend).

Rate limiting differs from backpressure: backpressure bounds concurrency (messages not yet answered), rate limiting bounds throughput over time regardless of how fast answers arrive. Both gates sit in the same place in `dispatch()` and must share the waiting, timeout and cancellation semantics.

## Requirements

- REQ-1: `MsgChannelConfig` MUST support `rateLimit?: { limit: number; interval: number; overflow?: 'wait' | 'error' }` (token bucket: `limit` tokens refilled per `interval` ms; default overflow `'wait'`).
- REQ-2: The gate MUST reuse the waiter queue, `ChannelBusyError`, `timeout` / `abortSignal` (for `send()`) and `sendTimeout` (for `request()`) semantics introduced by `feat--async-publish-and-backpressure`.
- REQ-3: When both `rateLimit` and `flowControl` are configured, the rate token MUST be taken first and the in-flight slot second, so a waiter for a slot does not hold a rate token.
- REQ-4: `out`, `error`, `MSGBUS.ERROR` and cancel messages MUST NOT be rate limited.
- REQ-5: Channels without `rateLimit` MUST keep the current code path (one field check).

## Acceptance Criteria

- [ ] `rateLimit: { limit: 2, interval: 100 }`: five sequential `await send()` calls take at least ~200 ms (fake timers).
- [ ] `overflow: 'error'` rejects with `ChannelBusyError` when no token is available.
- [ ] `timeout` / `abortSignal` cancel a waiting `send()` without consuming a token.
- [ ] Combined `rateLimit` + `flowControl` ordering verified by a test.
- [ ] Docs updated: `docs/topic--04-advanced-patterns.md`.
