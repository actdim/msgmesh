---
protocol: along
slug: livestore-event-sourcing-adapter
type: feat
status: open
priority: high
created: 2026-08-27
updated: 2026-08-28
agent: antigravity
tags: [livestore, event-sourcing, persistence, cross-tab, sqlite, opfs]
milestone: v2.0.0-along-transition
blocked_by: []
related: [feat--message-persistence, feat--cross-tab-synchronization]
---

# LiveStore event sourcing adapter and reactive sync

- Source: `src/core.ts`
- Related: `src/contracts.ts`

## Context

LiveStore is a reactive event-sourcing data store (SQLite / WASM / OPFS / IndexedDB) that builds reactive materialized views over an append-only event stream. Connecting MsgMesh streams to LiveStore provides durable local persistence and automatic cross-tab state replication across browser instances sharing the database.

## Requirements

- Create a bridge adapter (`attachLiveStoreToMsgBus`) that subscribes to configured MsgMesh channels and writes incoming messages into LiveStore tables as append-only event logs.
- Support channel filtering, topic matching, and payload sanitization (masking sensitive fields / PII).
- Provide helper schemas for common event projections (rolling metrics, request logs, user journeys).
- Document patterns for reactive subscriptions and SQL queries over ingested bus events.
- Leverage LiveStore's shared storage engine for automatic multi-tab synchronization and offline replay.

