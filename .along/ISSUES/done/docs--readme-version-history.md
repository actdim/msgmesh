---
protocol: along
protocol_version: "4.4.1"
slug: readme-version-history
type: docs
status: done
completed: 2026-10-02
priority: medium
created: 2026-10-02
updated: 2026-10-02
agent: claude-code
tags: [docs, changelog, release]
milestone: v2.0.0-along-transition
blocked_by: []
related: [task--release-v1-8-0]
---

# Docs: version history section in README

`README.md` has no version history. Add a `## Changelog` section (same format as `@actdim/utico`) covering every version from 0.9.0 to the unpublished 1.8.0, derived from git history (`package.json` version per commit) and the actual diffs where commit messages are vague.

## Acceptance Criteria
- [ ] `## Changelog` section in `README.md`, newest first, one `### x.y.z (YYYY-MM-DD)` heading per version
- [ ] 1.8.0 includes the `MSGBUS.ERROR` own error fields fix
- [ ] `CHANGELOG.md` "Earlier versions" points to the README section
- [ ] `__pycache__/` ignored in `.gitignore`
- [ ] Committed and pushed to origin/main
