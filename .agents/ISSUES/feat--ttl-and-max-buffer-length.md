---
slug: ttl-and-max-buffer-length
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
---

# Support TTL and maxBufferLength channel controls

- Source: `src/core.ts:844`

## Context

Messages in buffers without expiration or capacity limits can consume unbounded memory.

## Requirements

- Add `ttl` (Time-To-Live) support in message headers and channel configurations.
- Support `maxBufferLength` for bounding subject replay/queue buffers and dropping stale messages.
