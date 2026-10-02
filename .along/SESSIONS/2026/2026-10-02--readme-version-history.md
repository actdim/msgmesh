---
protocol: along
protocol_version: "4.4.1"
date: 2026-10-02
slug: readme-version-history
agent: claude-code
branch: main
commit: '2990443'
summary: README changelog for 0.9.0 - 1.8.0 (59 versions) from git history and diffs, __pycache__ ignored, Along lifecycle scripts tracked
milestone: v2.0.0-along-transition
issues_advanced: []
issues_completed: [docs--readme-version-history]
decisions: []
risks_logged: []
spikes_conducted: []
---

# Session: Readme version history

## Summary
README changelog for 0.9.0 - 1.8.0 (59 versions) from git history and diffs, __pycache__ ignored, Along lifecycle scripts tracked

## Work Completed
- `README.md`: new `## Changelog` section before `## License` - 59 versions (0.9.0 - 1.8.0) in 48 headings, newest first, dated. Built from `package.json` version per commit; vague commits checked against their diffs. Breaking changes marked (e.g. 1.2.3 `msgBusCore` -> `contracts`, `msgBusFactory` -> `core`, `onceAsync`/`dispatch`/`dispatchAsync` -> `once`/`send`/`request`; 1.5.2 `MsgStatus` and `(inMsg, outMsg)` provider callback).
- `CHANGELOG.md`: "Earlier versions" points to the README section.
- `.gitignore`: `__pycache__/`, `*.pyc`; Along lifecycle hooks `.along/scripts/build.py`, `test.py` tracked.
- Pushed the pending commit from 2026-10-01 (CHANGELOG, gate manifest, v1.7.2 retrospective log).
- npm has up to 1.7.2; 1.8.0 is documented ahead of publishing.

## Code Review & Blast Radius
- Docs and ignore rules only; no source changes. Tests not rerun.
- `.along/scripts/*.py` compile (`python -m py_compile`).
- Typography: added lines are ASCII only.
