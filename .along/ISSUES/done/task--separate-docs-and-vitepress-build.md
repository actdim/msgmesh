---
protocol: along
protocol_version: "4.4.15"
slug: separate-docs-and-vitepress-build
type: task
status: done
completed: 2026-10-16
priority: medium
created: 2026-10-16
updated: 2026-10-16
agent: antigravity
tags: []
milestone: v2.0.0-along-transition
parent: task--separate-docs-and-vitepress-build
blocked_by: []
related: []
---

# Separate docs sources and VitePress build artifacts

## Background Context
In `@actdim/msgmesh`, the npm package tarball was bloated to 1.7 MB (4.8 MB unpacked, 145 files) because `vitepress build docs` created `docs/.vitepress/dist` and `docs/.vitepress/cache` directly inside `docs/`.
Because `"docs"` was declared in `package.json` `files`, npm included all compiled bundles, Mermaid chunk scripts, KaTeX assets, and Inter woff2 fonts into the release.

## Implementation Details
1. Configured `docs/.vitepress/config.ts`:
   - `outDir: '../.dist-docs'`
   - `cacheDir: '../node_modules/.cache/vitepress'`
2. Added `!docs/.vitepress` to `package.json` `files` array to guarantee that `.vitepress` is excluded from releases while keeping `docs/INDEX.md`, `docs/topic--*.md`, and `docs/decisions/`.
3. Updated `.github/workflows/pages.yml` to upload Pages artifact from `.dist-docs`.
4. Added `.dist-docs/` to `.gitignore`.
5. Cleaned up stale `docs/.vitepress/dist` and `cache`.
6. Verified `pnpm run docs:build` compiles to `.dist-docs/` in 5.98s without dirtying `docs/`.
7. Verified `npm pack --dry-run`: package reduced from 1.7 MB (4.8 MB unpacked, 145 files) to 131.2 kB (463.1 kB unpacked, 41 files).

## Acceptance Criteria
- [x] Set `outDir: '../.dist-docs'` and `cacheDir: '../node_modules/.cache/vitepress'` in `docs/.vitepress/config.ts`
- [x] Add `!docs/.vitepress` to `package.json` `files`
- [x] Update `.github/workflows/pages.yml` artifact path to `.dist-docs`
- [x] Add `.dist-docs/` to `.gitignore`
- [x] Verify `docs:build` compiles outside `docs/`
- [x] Verify `npm pack --dry-run` excludes all `.vitepress` build artifacts and configs
- [x] All unit and integration tests pass cleanly (`pnpm test`)
