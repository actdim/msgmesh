---
slug: unsubscribe-alias-handle
type: debt
status: open
priority: low
created: 2026-08-13
updated: 2026-08-13
---

# Provide unsubscribe alias and subscription handle pattern

- Source: `src/core.ts:841`

## Context

Subscription methods currently return a cleanup teardown function `() => void`. Providing an explicit `unsubscribe()` alias / object handle improves ergonomics for React hooks and component lifecycles.

## Requirements

- Return a subscription handle object `{ unsubscribe: () => void }` (or callable with `.unsubscribe()`).
- Maintain backward compatibility with existing cleanup function return signatures.
