---
protocol: along
slug: message-persistence
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-11-08
agent: antigravity
tags: [persistence, livestore, indexeddb, offline, replay, cross-tab]
milestone: v2.0.0-along-transition
blocked_by: []
related: [feat--cross-tab-synchronization, feat--livestore-event-sourcing-adapter, feat--async-publish-and-backpressure]
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

### 4. Open design points (added 2026-11-08)
- **Model conflict with `@actdim/msgmesh-store`**: the existing CDC bridge (`msgmesh-store/src/bridge/storeBridge.ts`) works store -> CDC -> bus: a store write is the source of truth and the bus only reflects it. "Persist before delivery" works the other way round (bus -> store -> delivery). Decide which flow owns which channels before defining the adapter contract; otherwise a message can be persisted twice or become two sources of truth.
- **Hook instead of baked-in storage**: prefer a generic async hook in `dispatch()` (for example `beforePublish(msg): Promise<void>`) in the core, with storage adapters living in `msgmesh-store`, over a storage provider inside `@actdim/msgmesh` itself.
- **Shared gate semantics**: the hook sits in the same place as the flow control gate of `feat--async-publish-and-backpressure` and MUST reuse its `timeout` / `abortSignal` / `sendTimeout` and fire-and-forget error routing semantics.
- **Naming**: an earlier draft of `feat--async-publish-and-backpressure` proposed `MsgStorageProvider` with `clearChannel`; this issue uses `MsgStorageAdapter` with `clear`. Keep one name (this issue owns the contract).

