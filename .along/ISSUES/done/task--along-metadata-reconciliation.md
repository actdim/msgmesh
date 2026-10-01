---
protocol: along
protocol_version: "4.4.1"
slug: along-metadata-reconciliation
type: task
status: done
completed: 2026-10-01
priority: medium
created: 2026-10-01
updated: 2026-10-01
agent: claude-code
tags: [along, metadata, release]
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# Release metadata for v1.8.0 / v1.7.2 (CHANGELOG, gate manifest, tags)

Part of the Infomnia root issue `task--along-metadata-reconciliation`: release metadata that the v1.8.0 and v1.7.2
releases skipped. Metadata only, no source changes.

## Acceptance Criteria
- [x] `CHANGELOG.md` with 1.8.0 and 1.7.2 entries.
- [x] Gate Execution Manifest in the `2026-10-01--release-v1-8-0` session log, re-verified at `b585374`.
- [x] Retrospective session log for `docs--channel-group-semantics` (`2026-10-01--retro-v1-7-2-docs`).
- [x] Annotated tags `v1.8.0` (`b585374`) and `v1.7.2` (`15b3cdc`).
- [x] Automated tests passing (55/55).
