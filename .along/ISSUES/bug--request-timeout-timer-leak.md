---
protocol: along
protocol_version: "4.5.0"
slug: request-timeout-timer-leak
type: bug
status: open
priority: high
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
tags: [core, timeout, node, timers]
blocked_by: []
related: []
---

# request() and once() leave the timeout timer running after settle

## Problem
`request()` (`src/core.ts:584-585`) and `once()` (`src/core.ts:390-391`) race the work promise
against `delayError(timeout, ...)` from `@actdim/utico/utils`. When the work promise wins, the
timeout timer is never cleared: `delayError` is called without an `AbortSignal`, so the
`setTimeout` inside utico `delay` keeps running for the full timeout (default
`defaultPromiseTimeout` = 5 s) and then builds a `TimeoutError` nobody observes.

Found while validating msgmesh as the server-side bus for Mempart (Node 24): a plain-Node smoke
script whose checks finished in about 1 s exited only after 5.2 s.

Impact on Node consumers (server, workers, CLI scripts, tests):
- the event loop stays alive up to `timeout` after the last request: delayed graceful shutdown,
  scripts and test runners hang until the timer fires;
- one live timer and one discarded `TimeoutError` (stack capture) per successful request /
  once; under load this is avoidable timer-heap and CPU churn.
In the browser the effect is only the wasted timer and error object.

## Requirements
- REQ-1: Clear the timeout timer as soon as the race settles (success, error, cancel), in both
  `request()` and `once()`.
- REQ-2: Preferred fix: per-call `AbortController` passed to `delayError(timeout, factory,
  ac.signal)`, and `ac.abort()` in a `finally` on the raced promise. The rejection from the
  aborted delay is absorbed by `Promise.race` (already settled), so no unhandled rejection.
- REQ-3: Do not change timeout, cancel or error semantics; no `unref()` (not portable to the
  browser).
- REQ-4: Check `stream()` / `requestStream()` inactivity timers (`core.ts:695-903`) clear on
  every exit path (they use `clearTimeout`; add a test).

## Reproduction
```javascript
import { createMsgBus } from '@actdim/msgmesh/core';
const bus = createMsgBus();
bus.provide({ channel: 'Test.Sum', callback: (m) => m.payload.a + m.payload.b });
await bus.request({ channel: 'Test.Sum', payload: { a: 2, b: 3 } });
// Expected: process exits immediately (after unsubscribing the provider).
// Actual: process stays alive about 5 s (defaultPromiseTimeout).
```

## Acceptance Criteria
- [ ] After a successful `request()` / `once()` no timer remains pending (test with
      `vi.useFakeTimers()` and `vi.getTimerCount()`, or a child-process exit-time test).
- [ ] Timeout, abort and provider-error behaviour unchanged (existing tests pass).
- [ ] `stream()` / `requestStream()` timer cleanup covered by a test.
- [ ] Automated tests passing.
