---
protocol: along
slug: middleware-and-metrics
type: feat
status: open
priority: high
created: 2026-08-27
updated: 2026-08-27
agent: antigravity
tags: []
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# Interceptor/Middleware pipeline, built-in metrics calculation, and auto-tracing

- Source: `src/core.ts`
- Related: `src/contracts.ts`

## Context

Currently, tracking message timings, calculating latency, or injecting tracing identifiers requires manual handling or wrapping around `msgBus.request()`. A native middleware/interceptor mechanism allows transparent, zero-code cross-cutting concerns.

## Requirements

- Provide a middleware pipeline API on `MsgBus` (`msgBus.use(...)`) supporting pre-send, post-dispatch, error, and stream hooks.
- Automatically calculate message processing duration (latency between `in` and `out`/`error`) and attach it to message metadata / response headers (`headers.durationMs`).
- Provide automatic generation and propagation of `correlationId` and `traceId` if not already present in `msg.headers`.
- Expose hooks for error breadcrumbs and latency aggregation sinks (OTel, Sentry, Prometheus).
