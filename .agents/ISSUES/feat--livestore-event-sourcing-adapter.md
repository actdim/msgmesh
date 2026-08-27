---
slug: livestore-event-sourcing-adapter
type: feat
status: open
priority: high
created: 2026-08-27
updated: 2026-08-27
---

# LiveStore event sourcing adapter and reactive sync

- Source: `src/core.ts`
- Related: `src/contracts.ts`

## Context

LiveStore is a reactive event-sourcing data store (often SQLite / WASM in-memory / OPFS) that builds reactive materialized views over an append-only event stream. Connecting MsgMesh streams to LiveStore allows instant event persistence, local-first querying, and zero-latency reactive UI updates.

## Requirements

- Create a bridge adapter (`attachLiveStoreToMsgBus`) that subscribes to configured MsgMesh channels and writes incoming messages into LiveStore tables as append-only event logs.
- Support channel filtering, topic matching, and payload sanitization (masking sensitive fields / PII).
- Provide helper schemas for common event projections (rolling metrics, request logs, user journeys).
- Document patterns for reactive subscriptions and SQL queries over ingested bus events.
