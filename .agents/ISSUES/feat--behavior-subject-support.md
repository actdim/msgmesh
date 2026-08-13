---
slug: behavior-subject-support
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
---

# Support BehaviorSubject for state-holding channels

- Source: `src/core.ts:168`

## Context

Some channels represent state streams where new subscribers need to immediately receive the current/latest value upon subscribing.

## Requirements

- Add channel configuration option to use `BehaviorSubject` in `getOrCreateSubject()`.
- Ensure new subscribers receive the last emitted message on subscription.
