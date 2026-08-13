---
slug: cross-tab-synchronization
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
---

# Cross-tab and web worker message bus delivery

- Source: `src/core.ts:850`

## Context

Applications running across multiple browser tabs or web workers need a unified message bus.

## Requirements

- Support cross-tab message synchronization using `BroadcastChannel` API and `Web Locks` API.
- Support RPC / worker bridging using Comlink pattern integration.
