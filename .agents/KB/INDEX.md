# @actdim/msgmesh Knowledge Base Index

Welcome to the **@actdim/msgmesh** Knowledge Base. This knowledge base provides comprehensive architectural documentation, domain models, API references, workflows, and practical patterns for the enterprise message mesh and event bus library.

## Knowledge Base Articles

- [[01-architecture.md]] — **Architecture & Design Principles**: Three-tier coordinate system (`Channel`, `Group`, `Topic`), zero-RxJS public surface, dual communication paradigms (`send` vs `request`).
- [[02-domain-model.md]] — **Domain Model & Type Contracts**: `MsgStruct`, `Msg`, error classes (`TimeoutError`, `AbortError`, `NoProviderError`), and pipeline configuration schemas.
- [[03-setup-and-workflow.md]] — **Setup, Build & Workflow**: Build scripts, Vitest test suites, browser runner, and developer workflow.
- [[04-api-reference.md]] — **Exhaustive API Reference**: Complete documentation for `createMsgBus`, `send`, `on`, `once`, `stream`, `provide`, `request`, `requestStream`, and `sendError`.
- [[05-patterns-and-recipes.md]] — **Patterns & Recipes**: Production recipes for Request/Response with `AbortController`, Chain of Responsibility fallback handlers, debouncing/throttling, and input type overloading.

## Core Coordinates & Concepts

| Coordinate | Role | Default |
|---|---|---|
| **Channel** | Logical task class or domain subsystem | *Required* |
| **Group** | Message role: `'in'` (input), `'out'` (response), `'error'` (error), custom input groups (`'in1'`, `'in2'`) | `'in'` |
| **Topic** | Fine-grained subscription discriminator | `undefined` |
| **Headers** | Metadata dictionary (`correlationId`, `traceId`, user session) | `{}` |
