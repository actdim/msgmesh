---
protocol: along
slug: message-persistence
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

# Support message persistence and offline queueing

- Source: `src/core.ts:840`

## Context

Messages published while handlers are offline or across app restarts are currently lost if unhandled.

## Requirements

- Provide optional storage persistence interface (IndexedDB / localStorage / file store).
- Enable log-based message replay and offline queueing for persistent channels.
