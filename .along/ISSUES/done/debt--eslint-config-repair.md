---
protocol: along
protocol_version: "4.4.10"
slug: eslint-config-repair
type: debt
status: done
completed: 2026-10-12
priority: medium
created: 2026-10-12
updated: 2026-10-12
agent: claude-code
parent: task--leftovers-after-params-semantics
tags: []
blocked_by: []
related: []
---

# Repair broken merge in eslint.config.mjs

`eslint.config.mjs` carried a broken merge (two `export default defineConfig(` calls, duplicated imports, merged
`no-misused-promises` / `ban-ts-comment` entries, two `languageOptions`), so `pnpm lint` failed with a syntax error.
Rebuilt on the repaired `@actdim/dynstruct` / `@actdim/utico` structure, msgmesh-specific rule overrides kept.

## Acceptance Criteria
- [x] `pnpm lint` runs: 0 errors, 71 warnings (66 `no-unused-vars`, 3 `no-console`, 1 `prefer-const`,
      1 `no-async-promise-executor`) - existing backlog, not fixed here
- [x] Automated tests passing
