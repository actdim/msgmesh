---
slug: request-topic-matching-filter
type: debt
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
---

# Evaluate topic matching filter on request response subscription

- Source: `src/core.ts:478`

## Context

In `dispatch()`, `out` response subscription filter currently checks `outMsg.headers.inResponseToId === msg.headers.requestId`.

## Requirements

- Verify whether `out` response messages should also evaluate topic matching (`match(outMsg.address.topic)`).
- Update subscription filter logic accordingly and add test coverage.
