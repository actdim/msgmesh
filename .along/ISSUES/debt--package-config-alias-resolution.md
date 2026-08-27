---
protocol: along
slug: package-config-alias-resolution
type: debt
status: open
priority: low
created: 2026-08-13
updated: 2026-08-13
agent: antigravity
tags: []
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# Read path aliases dynamically from tsconfig.json in packageConfig.ts

- Source: `packageConfig.ts:11`

## Context

`packageConfig.ts` currently hardcodes the `@ -> ./src` alias dictionary.

## Requirements

- Dynamically parse path aliases from `tsconfig.json` compilerOptions paths.
- Ensure package build tool resolution stays synced automatically with tsconfig.
