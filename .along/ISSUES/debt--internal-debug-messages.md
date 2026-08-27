---
protocol: along
slug: internal-debug-messages
type: debt
status: open
priority: low
created: 2026-08-13
updated: 2026-08-13
agent: antigravity
tags: []
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# Publish internal debug event messages on subscription abort

- Source: `src/core.ts:290`

## Context

When a subscription is aborted via `AbortSignal`, it currently logs via `console.debug`.

## Requirements

- Publish a system debug event message onto a dedicated system debug channel (e.g. `MSGBUS.DEBUG:in`) when subscriptions abort.
- Retain optional console debug output based on global debug flags.
