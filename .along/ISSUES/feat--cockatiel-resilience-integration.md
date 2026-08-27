---
protocol: along
slug: cockatiel-resilience-integration
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
agent: antigravity
tags: []
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# Integrate Cockatiel resilience library

- Source: `src/contracts.ts:288`

## Context

Transient failures in message providers benefit from standardized resilience policies (retry, circuit breaker, bulkhead, timeout, fallback).

## Requirements

- Integrate Cockatiel policy primitives into bus request handling and provider wrappers.
- Allow configuring channel resilience policies via bus configuration.
