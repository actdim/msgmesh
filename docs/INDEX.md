---
protocol: along
protocol_version: "2.2.8"
slug: INDEX
title: Knowledge Base Topic Index
type: index
created: 2026-08-27
updated: 2026-09-02
tags: [index, kb, topics, map]
---

# Knowledge Base Topic Index

Central entry point and cross-linked topic catalog for @actdim/msgmesh documentation.

## Knowledge Graph & Topic Map

```mermaid
flowchart TD
    INDEX["Knowledge Base (INDEX)"]
    T_OVERVIEW["Overview & Problem Analysis"]
    INDEX --> T_OVERVIEW
    T_ARCH_TYPES["Architecture & Types"]
    INDEX --> T_ARCH_TYPES
    T_API["API Reference"]
    INDEX --> T_API
    T_ADVANCED["Advanced Patterns & Adapters"]
    INDEX --> T_ADVANCED
    T_ARCHITECTURE["Architecture"]
    INDEX --> T_ARCHITECTURE
    T_DOMAIN["Domain Model"]
    INDEX --> T_DOMAIN
    T_SETUP["Setup & Workflow"]
    INDEX --> T_SETUP
    T_OVERVIEW -.->|references| T_ARCH_TYPES
    T_ARCH_TYPES -.->|references| T_OVERVIEW
    T_ARCH_TYPES -.->|references| T_API
    T_API -.->|references| T_ARCH_TYPES
    T_API -.->|references| T_ADVANCED
    T_ADVANCED -.->|references| T_API
    T_ARCHITECTURE -.->|references| T_DOMAIN
    T_ARCHITECTURE -.->|references| T_SETUP
    T_ARCHITECTURE -.->|references| T_API
    T_ARCHITECTURE -.->|references| T_ADVANCED
    T_DOMAIN -.->|references| T_ARCHITECTURE
    T_DOMAIN -.->|references| T_SETUP
    T_DOMAIN -.->|references| T_API
    T_DOMAIN -.->|references| T_ADVANCED
    T_SETUP -.->|references| T_ARCHITECTURE
    T_SETUP -.->|references| T_DOMAIN
    T_SETUP -.->|references| T_API
    T_SETUP -.->|references| T_ADVANCED
```

---

## Articles

- **[Overview & Problem Analysis](./topic--01-overview-and-analysis.md)** (topic) `01-overview-and-analysis`
- **[Architecture & Types](./topic--02-architecture-and-types.md)** (topic) `02-architecture-and-types`
- **[API Reference](./topic--03-api-reference.md)** (topic) `03-api-reference`
- **[Advanced Patterns & Adapters](./topic--04-advanced-patterns.md)** (topic) `04-advanced-patterns`
- **[Architecture](./topic--architecture.md)** (topic) `architecture`
- **[Domain Model](./topic--domain-model.md)** (topic) `domain-model`
- **[Setup & Workflow](./topic--setup-and-workflow.md)** (topic) `setup-and-workflow`

---

## Related Context

- [AGENTS.md](../AGENTS.md): Active protocol conventions and rules.
- [.along/DECISIONS.md](../.along/DECISIONS.md): Architectural Decision Records.
- [.along/ISSUES.md](../.along/ISSUES.md): Active issue tracking board.
- [.along/HISTORY.md](../.along/HISTORY.md): Append-only project history log.