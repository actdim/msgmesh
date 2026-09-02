---
protocol: along
protocol_version: "2.2.5"
slug: architecture
title: 01 Architecture
type: topic
created: 2026-08-27
updated: 2026-09-02
tags: [architecture]
---

# @actdim/msgmesh Architecture

## 1. System Overview

`@actdim/msgmesh` is an enterprise-grade, strictly typed asynchronous message mesh and event broker designed for frontend and full-stack TypeScript applications. It serves as the decoupled messaging backbone for the `@actdim/dynstruct` component system.

```
+-----------------------------------------------------------------------------------------+
|                                    @actdim/msgmesh                                      |
+-----------------------------------------------------------------------------------------+
|  Public Developer API (Zero-RxJS Surface)                                               |
|  - Fire & Forget: send({ channel, group?, payload, topic?, headers? })                  |
|  - Observer / PubSub: on(), once(), stream() (AsyncIterable)                            |
|  - Request / Response: request() (Promise<out>), requestStream() (Fan-in streaming)     |
|  - Provider Registration: provide() with Chain of Responsibility & Cancellation Handling|
|  - System Diagnostics: sendError(), MSGBUS.ERROR channel, typed error symbols          |
+-----------------------------------------------------------------------------------------+
|  Channel Pipeline Engine & Configuration                                                |
|  - Dynamic configuration: MsgBusConfig<TStruct> (supports '*' wildcard static or func)  |
|  - Reactive operators: ReplaySubject buffer/window, Throttle, Debounce, Delay           |
|  - Mandatory provider validation (NoProviderError)                                      |
+-----------------------------------------------------------------------------------------+
|  RxJS Foundation Under The Hood                                                         |
|  - Subjects & Observables managing decoupled pub/sub queues                             |
|  - AsyncScheduler preventing event loop blocking across components                      |
+-----------------------------------------------------------------------------------------+
```

## 2. Core Architectural Principles

### 2.1. Abstraction Over RxJS
RxJS provides battle-tested reactive stream primitives, but exposing raw Observables across application layers creates tight coupling, paradigm fragmentation, and high cognitive overhead. `@actdim/msgmesh` completely encapsulates RxJS internals behind standard TypeScript `Promise`, `AsyncIterable`, and typed callback interfaces.

### 2.2. Three-Tier Message Coordinate System
Every message in the mesh is addressed by three coordinates:
1. **Channel (`TChannel`)**: Domain boundary or task class (e.g. `'AUTH.LOGIN'`, `'UI.DIALOG'`).
2. **Group (`TGroup`)**: Message role within the channel:
   - `'in'` (default) / Custom input groups (`'in1'`, `'in2'`): Input payload shapes entering the channel (Input Overloading).
   - `'out'`: Output response payload shape.
   - `'error'`: Error payload shape (`ErrorPayload`).
3. **Topic (`string`, optional)**: Fine-grained subscription discriminator for targeted event routing without creating hundreds of channels.

### 2.3. Dual Communication Paradigms

```
  +------------------+                    +------------------+
  |    Publisher     | --- send() ------> |    Subscriber    |  (Fire-and-forget Pub/Sub)
  +------------------+                    +------------------+

  +------------------+ --- request() ---> +------------------+
  |    Requester     |                    |     Provider     |  (Request/Response Contract)
  +------------------+ <-- out payload -- +------------------+
```

1. **Fire-and-Forget (`send()`)**: Publishes to the input group without waiting for response.
2. **Request-Response (`request()`)**: Publishes and awaits resolution from a registered `provide()` handler via the `'out'` group.
3. **Fan-in Streaming (`requestStream()`)**: Awaits and aggregates responses from multiple distributed providers as an async iterator.

### 2.4. Chain of Responsibility Provider Architecture
Multiple providers can register on the same channel. A provider can inspect incoming messages and either process them or set `outMsg.status = 'skipped'`, passing execution to the next provider in the chain.

## 3. Cross-Links
- [[INDEX.md]] - Knowledge Base Root
- [[02-domain-model.md]] - Domain Contracts and Type Structures
- [[03-setup-and-workflow.md]] - Setup and Testing Instructions
- [[04-api-reference.md]] - Complete API Specification
- [[05-patterns-and-recipes.md]] - Advanced Messaging Recipes and Service Adapters
