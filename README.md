# @actdim/msgmesh

> **Type-Safe Async Message Mesh & Service Bus for Scalable TypeScript Applications**

[![npm version](https://img.shields.io/npm/v/@actdim/msgmesh.svg)](https://www.npmjs.com/package/@actdim/msgmesh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/~/github.com/actdim/msgmesh)

---

## What is MsgMesh?

**`@actdim/msgmesh`** is a high-performance, type-safe messaging framework and service mesh for TypeScript. It bridges the gap between raw `EventEmitter` callbacks, complex RxJS streams, and tightly-coupled state managers by providing a unified message bus for **Pub/Sub Events**, **RPC Request/Response**, **Fan-in Streams**, and **Automated Service Adapters**.

### The Problem It Solves
- **Untyped Events**: Fatigued by string typos, missing payload types, and runtime crashes when emitting events?
- **RxJS Complexity Overload**: Want the power of reactive streams and debouncing without forcing your entire team into complex RxJS operators?
- **Tightly-Coupled Services**: Want UI components to invoke backend APIs or cross-module services without hard-coded class imports or prop callback chains?

### The Output You Get
- 🔒 **100% Compile-Time Verification**: Channels, input/output groups, and headers are checked by TypeScript with full IDE autocomplete.
- ⚡ **RPC & Cancellation**: Built-in `request()` / `provide()` with `AbortSignal` cancellation support out-of-the-box.
- 🔌 **Service Adapters**: Automatically wrap NSwag / OpenAPI / gRPC API clients directly into typed message channels.
- 🚀 **Built on RxJS**: Enterprise-grade scheduler under the hood, clean imperative API on top.

---

## 15-Second Code Snippet

```typescript
import { MsgStruct, createMsgBus } from '@actdim/msgmesh';

// 1. Declare contract (Channels, Inputs, Outputs)
type AppBusStruct = MsgStruct<{
    'USER.GET_PROFILE': { in: { userId: string }; out: { name: string; email: string } };
}>;

// 2. Instantiate bus
const msgBus = createMsgBus<AppBusStruct>();

// 3. Register RPC provider
msgBus.provide({
    channel: 'USER.GET_PROFILE',
    callback: async (msg) => ({ name: 'Alice', email: 'alice@example.com' }),
});

// 4. Request data from anywhere in the app with 100% type safety
const profile = await msgBus.request({
    channel: 'USER.GET_PROFILE',
    payload: { userId: 'usr-123' },
});

console.log(profile.payload.name); // "Alice"
```

---

## Installation

```bash
pnpm add @actdim/msgmesh @actdim/utico rxjs
```

---

## Documentation Index

Explore the complete guide step-by-step from core concepts to advanced service adapters:

| Section | Description |
|---|---|
| 📖 [**01. Overview & Problem Analysis**](./docs/01-overview-and-analysis.md) | Motivation, comparison with EventEmitters, RxJS, and global state managers. |
| 🧩 [**02. Architecture & Types**](./docs/02-architecture-and-types.md) | Channels, Input/Output groups, type contracts, and bus instantiation. |
| 🛠️ [**03. API Reference**](./docs/03-api-reference.md) | Complete method reference (`send`, `on`, `once`, `stream`, `provide`, `request`, `requestStream`). |
| 🚀 [**04. Advanced Patterns & Adapters**](./docs/04-advanced-patterns.md) | Message replay, debouncing, chain-of-responsibility, and automated service adapters. |

---

## Interactive Browser Sandbox

Try `@actdim/msgmesh` instantly in StackBlitz:

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/~/github.com/actdim/msgmesh)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
