---
protocol: along
slug: cross-tab-synchronization
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-28
agent: antigravity
tags: [cross-tab, broadcastchannel, livestore, web-worker, sync]
milestone: v2.0.0-along-transition
blocked_by: []
related: [feat--message-persistence, feat--livestore-event-sourcing-adapter]
---

# Cross-tab and web worker message bus delivery

- Source: `src/core.ts:850`
- Related: `src/contracts.ts`

## Context

Applications running across multiple browser tabs, windows, or Web Workers need a unified message mesh with two distinct communication modes:
1. **Ephemeral Cross-Tab Events (Non-persistent)**: Lightweight, real-time message broadcasting between open tabs.
2. **Persistent Cross-Tab Synchronization (LiveStore / IndexedDB)**: Replicated event-sourcing log where cross-tab sync is a natural byproduct of shared database storage.

## Requirements

### 1. Ephemeral Browser Event Mode (`BroadcastChannel` / Storage Events)
- Implement `createCrossTabBridge(msgBus, { channels, channelPrefix, name })` based on native browser `BroadcastChannel` API.
- Fallback to `window.StorageEvent` for legacy browser environments.
- Use `navigator.locks` (Web Locks API) for multi-tab leader election and deduplication of singleton background tasks (e.g. single WebSocket connection or worker sync).
- Exclude loopback echo: ensure sender tab does not duplicate messages it published itself (tracking `tabId` or `instanceId` in message headers).

### 2. Stateful Storage-Backed Mode (LiveStore Integration)
- Integrate with `feat--livestore-event-sourcing-adapter` to leverage shared SQLite/WASM/OPFS/IndexedDB storage.
- When messages are persisted to LiveStore, notify other tabs via storage reactivity or lightweight change notifications.
- Automatically provide offline replay, durable delivery, and queryable state across all open application tabs.

### 3. Web Worker & Comlink RPC Bridging
- Support RPC / Worker bridging using PostMessage / Comlink pattern to route channel requests to background Web Workers.

