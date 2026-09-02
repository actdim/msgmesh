---
protocol: along
protocol_version: "2.2.5"
slug: setup-and-workflow
title: 03 Setup And Workflow
type: topic
created: 2026-08-27
updated: 2026-09-02
tags: [setup-and-workflow]
---

# @actdim/msgmesh Setup, Build & Workflow

## 1. Prerequisites & Installation

- **Node.js**: >= 20.0.0
- **Package Manager**: `pnpm` (version ~10.21.0)
- **TypeScript**: >= 5.9.3

Install dependencies:
```bash
pnpm install
```

### Peer Dependencies
```bash
pnpm add @actdim/utico rxjs@^7.8.0
```

## 2. Scripts & Workflows

| Command | Action | Description |
|---|---|---|
| `pnpm run build` | `tsc -b tsconfig.json && vite build` | Typechecks and compiles ESM distribution files to `dist/` with `.d.ts` declarations |
| `pnpm run test` | `npx vitest --config=vitest.node.config.ts --no-cache` | Runs test suite under Node.js with Vitest |
| `pnpm run test:w` | `npx vitest --config=vitest.node.config.ts --watch` | Interactive watch mode for test-driven development |
| `pnpm run test:v8` | `npx vite` | Starts Vite dev server to execute browser-based test suite |
| `pnpm run typecheck` | `tsc -b tsconfig.json` | Runs strict TypeScript verification across contracts, core, and tests |
| `pnpm run lint` | `eslint "./**/*.{ts,tsx}"` | Lints codebase according to ESLint config |
| `pnpm run format` | `prettier --write .` | Formats all files with Prettier |

## 3. Testing Strategies

- **Unit Testing Bus Streams**: `tests/msgBus.test.ts` validates concurrency, debouncing, throttling, and request cancellation.
- **Provider Chain Testing**: Tests verify fallback behavior and skipping (`status = 'skipped'`).
- **Timing and Replay**: Tests verify that late subscribers receive buffered events within `replayWindowTime`.

## 4. Cross-Links
- [[INDEX.md]] - Knowledge Base Root
- [[01-architecture.md]] - System Architecture
- [[02-domain-model.md]] - Domain Model
- [[04-api-reference.md]] - Exhaustive API Reference
- [[05-patterns-and-recipes.md]] - Practical Recipes and Messaging Patterns
