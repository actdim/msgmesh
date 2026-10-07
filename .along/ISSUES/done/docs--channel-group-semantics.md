---
protocol: along
slug: channel-group-semantics
type: docs
status: done
completed: 2026-09-27
priority: high
created: 2026-09-27
updated: 2026-09-27
agent: antigravity
tags: [docs, msgmesh, channels, groups, conventions]
blocked_by: []
related: []
---

# Document Channel Group Semantics and Conventions in MsgMesh

Document channel group semantics (`in`, `out`, `ex`) in MsgMesh contracts, adapters, and domain structures:
- `in`: Inbound request payloads for RPC / Request-Response calls (e.g. `request({ channel, group: 'in' })`).
- `out`: Response payloads returned by providers, or broker broadcast events.
- `ex`: Direct execution / command payloads (fire-and-forget commands such as `APP.NAV.GOTO`).
- Conventions on group overloading and matching handlers.

## Verification
- Update `docs/topic--02-architecture-and-types.md`
- Run `along kb-sync` to recompile `INDEX.md`, `llms.txt`, and `llms-full.txt`.
