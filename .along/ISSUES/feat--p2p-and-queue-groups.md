---
protocol: along
slug: p2p-and-queue-groups
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

# Support P2P delivery, Queue Groups, and Broadcast

- Source: `src/core.ts:846`, `src/core.ts:847`, `src/core.ts:848`

## Context

Currently messages in a channel are delivered to all active subscribers (pub/sub). Load balancing across worker pools requires queue groups and targeted P2P routing.

## Requirements

- Point-to-Point (P2P): Direct targeted delivery to exactly one recipient.
- Queue Groups: Support worker pool load balancing (Round-Robin, Fan-out, Fan-in).
- Explicit Broadcast pattern support.
