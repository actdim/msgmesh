---
protocol: along
slug: backpressure-and-rate-limiting
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

# Rate limiting and backpressure support

- Source: `src/core.ts:343`, `src/core.ts:843`, `README.md:1406`

## Context

When message producers output at high frequency, channels can overflow without throttling/backpressure.

## Requirements

- Implement rate limiting per channel using signals after auto-ack or output signals.
- Implement backpressure handling for `"in"` and `"out"` channel pairs.
- Return a real send promise from `publish()` that resolves when capacity is available.
