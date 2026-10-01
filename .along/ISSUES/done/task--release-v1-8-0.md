---
protocol: along
protocol_version: "4.4.1"
slug: release-v1-8-0
type: task
status: done
completed: 2026-10-01
priority: medium
created: 2026-10-01
updated: 2026-10-01
agent: claude-code
tags: [release, versioning]
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# Release v1.8.0 and sync submodules

Minor release of the workspace: `pnpm run version:minor` bumped all packages from 1.7.2 to 1.8.0. Ships `bug--msgbus-error-own-fields`.

## Acceptance Criteria
- [x] `package.json` version is 1.8.0
- [x] Along context refreshed to protocol v4.4.1
- [x] `.claude/settings.json` disables commit/PR attribution (no AI `Co-Authored-By` trailers)
- [x] Automated tests passing (55/55), workspace `pnpm build` passing
- [x] Committed and pushed to origin/main
