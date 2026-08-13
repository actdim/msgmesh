---
slug: qos-levels
type: feat
status: open
priority: medium
created: 2026-08-13
updated: 2026-08-13
---

# Support Quality of Service (QoS) delivery levels

- Source: `src/core.ts:849`

## Context

Different messaging scenarios require distinct delivery guarantees (e.g. fire-and-forget vs at-least-once vs exactly-once).

## Requirements

- Introduce configurable QoS levels (`at-most-once`, `at-least-once`, `exactly-once`).
- Enforce delivery semantics based on configured channel/message QoS.
