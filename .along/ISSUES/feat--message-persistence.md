---
protocol: along
slug: message-persistence
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-28
agent: antigravity
tags: [persistence, livestore, indexeddb, offline, replay, cross-tab]
milestone: v2.0.0-along-transition
blocked_by: []
related: [feat--cross-tab-synchronization, feat--livestore-event-sourcing-adapter]
---

# Support message persistence and offline queueing

- Source: `src/core.ts:840`
- Related: `src/contracts.ts`

## Context

Messages published while handlers are offline, during network disconnects, or across application restarts are lost if they are strictly in-memory. Persistent storage engines provide durable message buffering, audit logs, and automatic cross-tab state synchronization.

## Requirements

### 1. Pluggable Storage Adapter Contract
- Define `MsgStorageAdapter` contract (`saveMessage`, `loadMessages`, `deleteMessage`, `clear`).
- Provide default implementations:
  - **LiveStore Adapter**: Event-sourcing storage over SQLite/WASM/OPFS/IndexedDB.
  - **IndexedDB Adapter**: Browser-native key-value / object store.
  - **In-Memory / LocalStorage Adapter**: Fallback for test and light client environments.

### 2. LiveStore-Powered Persistence & Automatic Cross-Tab Sync
- Persisting events to LiveStore provides two capabilities in a single layer:
  1. **Durable Persistence**: Complete audit trail and offline queuing for configured persistent channels.
  2. **Cross-Tab Synchronization**: Because all browser tabs connect to the same underlying LiveStore database (or SharedWorker/OPFS), events written by Tab A are automatically available and observed by Tab B.

### 3. Log-Based Message Replay & Delivery Guarantees
- Replay unacknowledged or offline messages upon bus initialization or handler reconnection.
- Configure TTL and retention limits per channel.

