---
protocol: along
protocol_version: "4.4.13"
slug: pages-deploy-peer-deps
type: bug
status: done
completed: 2026-10-15
priority: high
created: 2026-10-15
updated: 2026-10-15
agent: antigravity
tags: [ci, github-pages, pnpm, peer-deps]
blocked_by: []
related: []
---

# Bug: Pages deployment fails due to unreleased peer dependencies

## Problem
In standalone CI, `pnpm install --no-frozen-lockfile` attempts to fetch `@actdim/utico` >=1.9.0 from npm registry where it is not yet published, failing the docs build.

## Requirements
- Configure pnpm not to auto-install peer dependencies during docs deployment.
- Add `.npmrc` with `auto-install-peers=false` to prevent registry lookups for peer dependencies.

## Acceptance Criteria
- [x] `.github/workflows/pages.yml` updated with `--config.auto-install-peers=false`
- [x] `.npmrc` configured with `auto-install-peers=false`
- [x] Tests and docs build pass
