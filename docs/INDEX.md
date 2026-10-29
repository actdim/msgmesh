---
protocol: along
slug: INDEX
title: '@actdim/msgmesh - Knowledge Base Topic Index'
type: index
created: 2026-09-07
updated: 2026-10-29
tags: [index, kb, topics, map]
---

# @actdim/msgmesh - Knowledge Base Topic Index

Central entry point and cross-linked topic catalog for project documentation:

## Knowledge Graph & Topic Map

```mermaid
flowchart TD
    INDEX["Knowledge Base (INDEX)"]
    T_01_OVERVIEW_AND_ANALYSIS["Overview & Problem Analysis"]
    INDEX --> T_01_OVERVIEW_AND_ANALYSIS
    T_02__ARCHITECTURE____ARCHITECTURE_MD__AND_TYPES["Architecture & Types"]
    INDEX --> T_02__ARCHITECTURE____ARCHITECTURE_MD__AND_TYPES
    T_03_API_REFERENCE["API Reference"]
    INDEX --> T_03_API_REFERENCE
    T_04_ADVANCED_PATTERNS["Advanced Patterns & Adapters"]
    INDEX --> T_04_ADVANCED_PATTERNS
    T_ALONG_PROTOCOL["Along Protocol Reference"]
    INDEX --> T_ALONG_PROTOCOL
    T_ARCHITECTURE["01 Architecture"]
    INDEX --> T_ARCHITECTURE
    T_DEPENDENCIES["Dependencies & Submodules AI Documentation and Rules"]
    INDEX --> T_DEPENDENCIES
    T_DOMAIN_MODEL["02 Domain Model"]
    INDEX --> T_DOMAIN_MODEL
    T_LICENSE["License"]
    INDEX --> T_LICENSE
    T_SETUP_AND_WORKFLOW["03 Setup And Workflow"]
    INDEX --> T_SETUP_AND_WORKFLOW
    T_01_OVERVIEW_AND_ANALYSIS -.->|references| T_02__ARCHITECTURE____ARCHITECTURE_MD__AND_TYPES
    T_02__ARCHITECTURE____ARCHITECTURE_MD__AND_TYPES -.->|references| T_01_OVERVIEW_AND_ANALYSIS
    T_02__ARCHITECTURE____ARCHITECTURE_MD__AND_TYPES -.->|references| T_03_API_REFERENCE
    T_03_API_REFERENCE -.->|references| T_02__ARCHITECTURE____ARCHITECTURE_MD__AND_TYPES
    T_03_API_REFERENCE -.->|references| T_04_ADVANCED_PATTERNS
    T_04_ADVANCED_PATTERNS -.->|references| T_03_API_REFERENCE
    T_ARCHITECTURE -.->|references| T_DOMAIN_MODEL
    T_ARCHITECTURE -.->|references| T_SETUP_AND_WORKFLOW
    T_ARCHITECTURE -.->|references| T_03_API_REFERENCE
    T_ARCHITECTURE -.->|references| T_04_ADVANCED_PATTERNS
    T_ARCHITECTURE -.->|references| T_LICENSE
    T_DOMAIN_MODEL -.->|references| T_ARCHITECTURE
    T_DOMAIN_MODEL -.->|references| T_SETUP_AND_WORKFLOW
    T_DOMAIN_MODEL -.->|references| T_03_API_REFERENCE
    T_DOMAIN_MODEL -.->|references| T_04_ADVANCED_PATTERNS
    T_DOMAIN_MODEL -.->|references| T_LICENSE
    T_SETUP_AND_WORKFLOW -.->|references| T_ARCHITECTURE
    T_SETUP_AND_WORKFLOW -.->|references| T_DOMAIN_MODEL
    T_SETUP_AND_WORKFLOW -.->|references| T_03_API_REFERENCE
    T_SETUP_AND_WORKFLOW -.->|references| T_04_ADVANCED_PATTERNS
    T_SETUP_AND_WORKFLOW -.->|references| T_LICENSE
```

---

## Articles

- **[Overview & Problem Analysis](./topic--01-overview-and-analysis.md)** (topic) `01-overview-and-analysis`
- **[Architecture & Types](./topic--02-architecture-and-types.md)** (topic) `02-architecture-and-types`
- **[API Reference](./topic--03-api-reference.md)** (topic) `03-api-reference`
- **[Advanced Patterns & Adapters](./topic--04-advanced-patterns.md)** (topic) `04-advanced-patterns`
- **[Along Protocol Reference](./topic--along-protocol.md)** (reference) `protocol`, `agents-md`, `checklist`, `routing`, `concurrency`, `along-team`, `conventions`
- **[01 Architecture](./topic--architecture.md)** (topic) `architecture`
- **[Dependencies & Submodules AI Documentation and Rules](./topic--dependencies.md)** (topic) `dependencies`, `ai-context`, `submodules`, `vendor`, `rules`
- **[02 Domain Model](./topic--domain-model.md)** (topic) `domain-model`
- **[License](./topic--license.md)** (license) `license`, `mit`
- **[03 Setup And Workflow](./topic--setup-and-workflow.md)** (topic) `setup-and-workflow`

---

## Related Context

- [AGENTS.md](../AGENTS.md): Active protocol conventions and rules.
- [Decisions (ADRs)](./decisions/INDEX.md): Architectural Decision Records.
- [Domain Model & Entity Ecosystem](./topic--domain-model.md): Specifications for active issues and project history.
