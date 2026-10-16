---
protocol: along
protocol_version: "4.4.9"
slug: release-v1-8-2
type: task
status: done
completed: 2026-10-11
priority: high
created: 2026-10-11
updated: 2026-10-11
agent: claude-code
tags: [release]
blocked_by: []
related: []
parent: task--release-v1-8-2
---

# Release v1.8.2 (child of root task--release-v1-8-2)

## Problem Statement / Background
Coordinated release v1.8.2 for @actdim/msgmesh including service bus optimizations and version bump.

## Implementation Details
1. Bumped package version to 1.8.2 in package.json.
2. Updated Along protocol metadata to 4.4.10 and refreshed documentation index.
3. Verified all reactive message bus tests pass.

## Acceptance Criteria
- [x] Version 1.8.2 published in package.json
- [x] Documentation index refreshed
- [x] All message mesh unit tests pass
