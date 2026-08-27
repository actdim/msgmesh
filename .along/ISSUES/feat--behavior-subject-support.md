---
protocol: along
slug: behavior-subject-support
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

# Support BehaviorSubject for state-holding channels

- Source: `src/core.ts:168`

## Context

Some channels represent state streams where new subscribers need to immediately receive the current/latest value upon subscribing.

## Requirements

- Add channel configuration option to use `BehaviorSubject` in `getOrCreateSubject()`.
- Ensure new subscribers receive the last emitted message on subscription.
