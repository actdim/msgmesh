---
protocol: along
slug: dependencies
title: Dependencies & AI Documentation for @actdim/msgmesh
type: topic
created: 2026-09-27
updated: 2026-09-27
tags: [dependencies, subproject, ai-context, rules]
---

# Dependencies & AI Documentation for `@actdim/msgmesh`

> [!NOTE]
> This document maintains a localized registry of internal workspace dependencies and third-party libraries for `@actdim/msgmesh`.
> Consult linked guidelines when developing, refactoring, or integrating components.

## Internal Workspace Dependencies

| Internal Package | Relative Path | AI Documentation & Context |
| :--- | :--- | :--- |
| **`@actdim/utico`** | [`../../utico`](../../utico) | [AGENTS.md](../../utico/AGENTS.md) <br> [CLAUDE.md](../../utico/CLAUDE.md) <br> [llms-full.txt](../../utico/llms-full.txt) <br> [llms.txt](../../utico/llms.txt) <br> [.along/](../../utico/.along) <br> [docs/](../../utico/docs) |

## Declared External Dependencies with AI Guidelines

| Package | Ecosystem | Version | AI Guidelines / Instructions |
| :--- | :--- | :--- | :--- |
| **`cytoscape`** | `npm` | `3.34.3` | [AGENTS.md](../node_modules/cytoscape/AGENTS.md) |

## Transitive Dependency Guidelines & Invariants

No exported invariants detected across current dependencies.

## Usage in Agent Sessions
When working on features involving any of the modules or external libraries above:
1. **Internal Submodules**: Follow conventions in the linked package `AGENTS.md` or package `docs/`.
2. **Third-Party Libraries**: Read the linked instruction files directly for framework-specific patterns and best practices.
