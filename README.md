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
- 🎯 **Pure Event-Driven UI Architecture**: Seamless single source of truth for `@actdim/dynstruct` apps, eliminating callback prop drilling and UI timing desynchronization.
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
| 📖 [**01. Overview & Problem Analysis**](./docs/topic--01-overview-and-analysis.md) | Motivation, comparison with EventEmitters, RxJS, and global state managers. |
| 🧩 [**02. Architecture & Types**](./docs/topic--02-architecture-and-types.md) | Channels, Input/Output groups, type contracts, and bus instantiation. |
| 🛠️ [**03. API Reference**](./docs/topic--03-api-reference.md) | Complete method reference (`send`, `on`, `once`, `stream`, `provide`, `request`, `requestStream`). |
| 🚀 [**04. Advanced Patterns & Adapters**](./docs/topic--04-advanced-patterns.md) | Message replay, debouncing, Dynstruct pure event-driven UI integration, and automated service adapters. |

---

## Interactive Browser Sandbox

Try `@actdim/msgmesh` instantly in StackBlitz:

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/~/github.com/actdim/msgmesh)

---

## AI-Assisted Development
 
Developed with [Along](https://github.com/actdim/along) - a provider-agnostic context and memory system for AI coding agents.

### AI Coding Assistants (Cursor, Claude Code, Copilot, Antigravity)

To enable AI coding agents in your project to follow MsgMesh channel structures, type-safe RPC, pub/sub, and streaming patterns, add a reference to the bundled LLM documentation in your project's `AGENTS.md`, `CLAUDE.md`, or `.cursorrules`:

```markdown
## MsgMesh Guidelines
- Reference: `node_modules/@actdim/msgmesh/llms.txt`
```

This gives agents instant access to channel contracts and patterns in `node_modules/@actdim/msgmesh/docs/` matching your installed version.

---

## Changelog

### 1.8.0 (2026-10-01)
- `core`: outside DEV the `MSGBUS.ERROR` payload keeps the error's own enumerable fields (e.g. `status`, `kind`); `name`, `message`, `stack` and `cause` are still set explicitly
- Along protocol 4.4.1; AI commit attribution disabled

### 1.7.2 (2026-09-27)
- Docs: channel group semantics (`in`, `out`, `ex`) in contracts, adapters and domain structures
- Source cleanup for ESLint (type-only imports, `let` -> `const`, formatting); no API changes
- `@actdim/utico` peer range aligned with the published npm version (`>=1.7.0`); documentation CI workflow and lockfile fixed

### 1.7.1 (2026-09-11)
- VitePress documentation portal and GitHub Pages workflow; no library changes

### 1.7.0 (2026-09-11)
- Package description and keywords updated, `@actdim/utico` peer range `>=1.7.0`; no library changes

### 1.5.15 (2026-09-07)
- `@actdim/utico` peer dependency set to `>=1.5.15` (was `workspace:*`)

### 1.5.10 - 1.5.14 (2026-08-28 - 2026-09-07)
- Docs, unit tests (`delay`, `debounce`, `throttle`) and tooling only; no library changes

### 1.5.9 (2026-08-28)
- `core`: provider callbacks may return nothing and set `outMsg.payload` directly
- `adapters`: `registerAdapters` also discovers methods on plain objects and namespace imports (functional API modules), not only class prototypes

### 1.5.7 - 1.5.8 (2026-08-27)
- Docs split into `docs/`, Along/agent metadata and tooling only; no library changes

### 1.5.6 (2026-08-27)
- `package.json` `exports`: `types` condition listed before `import`
- Agent skills, `AGENTS.md` and Knowledge Base added

### 1.5.5 (2026-07-01)
- New `globals` module: `getGlobalFlags()`; debug logs and "no subscribers/handlers" warnings are emitted only when `globalThis.__MSGMESH__.debug` is set
- TypeScript config split (`tsconfig.base`, `tsconfig.build`, `tsconfig.dev`), `@/` import alias

### 1.5.4 (2026-07-01)
- Docs only; no library changes

### 1.5.3 (2026-07-01)
- `core`: an already aborted `abortSignal` is honored up front (no subscription is created; awaitable calls reject with `OperationCanceledError`)

### 1.5.2 (2026-06-11)
- **Breaking:** `Outcome` and `headers.outcome` replaced by `Msg.status` (`MsgStatus`: `handled`, `failed`, `canceled`, `skipped`, `timeout`, `pending`)
- **Breaking:** provider callback signature is now `(inMsg, outMsg)`; setting `outMsg.status` to `skipped` lets the next provider handle the request (chain of responsibility)
- `core`: each subscriber receives its own `structuredClone` of the message envelope (independent messages)

### 1.5.1 (2026-06-08)
- **Breaking:** `$C_INHERIT` symbol replaced by `$C_ANY` (`"*"`) channel config, which accepts a static config or a `(channel) => config` resolver
- **Breaking:** `MsgHeaders` reworked: `status`/`ResponseStatus` replaced by `outcome` (`Outcome`), `publishedAt` renamed to `timestamp`, `auth` and `originId` removed, `spanId`, `name`, `severity` added
- `MsgStructNormalized` drops channels without keys

### 1.5.0 (2026-06-05)
- MIT `LICENSE` text and `@actdim/utico` peer range update; no library changes

### 1.4.9 (2026-06-04)
- `contracts`: `MsgStruct` declares implicit `in`/`out` groups as `void` when a channel does not define them
- `publishConfig.access: public`

### 1.4.8 (2026-05-15)
- License changed to MIT in `package.json`; dependency updates; no library changes

### 1.4.6 (2026-05-03)
- `core`: `requestStream()` added (publish a request and consume a stream of responses), with `MsgRequestStreamParams` and `MsgRequestStreamOptions` (`throwIfNoProvider`)

### 1.4.2 - 1.4.5 (2026-04-24 - 2026-04-30)
- `@actdim/utico` peer range updates; no library changes

### 1.4.1 (2026-04-22)
- `core`: outside DEV the `MSGBUS.ERROR` payload carries a plain `{ name, message, stack, cause }` object (or a JSON string for non-`Error` values) instead of the raw error

### 1.4.0 (2026-04-18)
- `core`: an exception thrown by a provider is answered to the requester with an `error` response, so `request()` rejects instead of waiting for a timeout

### 1.3.9 (2026-04-18)
- `NoProviderError` and `isNoProviderError()`; `mandatoryProvider` channel config and `throwIfNoProvider` request option
- `$C_INHERIT` default channel config applied to all channels
- Default promise timeout lowered from 2 minutes to 5 seconds, exported as `defaultPromiseTimeout`
- Warning when a message is published to a channel without subscribers or handlers

### 1.3.8 (2026-04-01)
- `contracts`: `ErrorChannelStruct` is partial again in `MsgStruct`

### 1.3.7 (2026-04-01)
- `contracts`: `MsgStructBase` is the generic constraint across the API (`MsgBus`, `createMsgBus`, params types, `registerAdapters`); IntelliSense fixes
- Peer dependency ranges widened to `>=` (`@actdim/utico`, `rxjs`, `uuid`)

### 1.3.3 - 1.3.4 (2026-02-16 - 2026-02-21)
- Docs and `@actdim/utico` dependency updates only; no library changes

### 1.3.2 (2026-02-16)
- `contracts`: `MsgStructBase` channel keys typed as `string` instead of `PropertyKey`

### 1.3.1 (2026-02-16)
- **Breaking:** `MsgStructFactory` removed; `MsgStruct<T>` is now the struct factory type, the former `MsgStruct` is `MsgStructBase` and the former `MsgStructBase` is `SystemMsgStruct`

### 1.3.0 (2026-02-16)
- **Breaking:** `InParam`, `OutParam`, `ErrorParam` renamed to `InChannelStruct`, `OutChannelStruct`, `ErrorChannelStruct`; `SystemChannelStruct` added
- Group IntelliSense fixes in `contracts`

### 1.2.9 (2026-02-15)
- New `adapters` module: `registerAdapters`, `MsgProviderAdapter`, `ToMsgStruct`, `ToMsgChannelPrefix`, `getMsgChannelSelector` (expose service clients as bus providers)

### 1.2.8 (2026-02-15)
- `core`: request cancellation propagates to the provider (a `canceled` message is published, the provider skips the response); `request()` rejects on provider `error`/`canceled` responses
- `send()` returns the published `Msg` (was `Promise<void>`); requests correlate via `headers.requestId` / `inResponseToId`; `status` and `error` headers added

### 1.2.7 (2026-02-11)
- `core`: `stream()` reimplemented as an async generator with `timeout` and abort handling
- `OperationCanceledError`, `isTimeoutError()`, `isAbortError()`, `isOperationCanceledError()`; abort listeners are removed when a subscription ends

### 1.2.6 (2026-02-10)
- Docs only; no library changes

### 1.2.5 (2026-02-07)
- `$SYSTEM_TOPIC` (`"msgbus"`) exported; error payload typed as `ErrorPayload`; unused `replayCount` channel config removed

### 1.2.4 (2026-01-21)
- **Breaking:** `$C_ERROR` channel name changed from `"error"` to `"MSGBUS.ERROR"`

### 1.2.3 (2026-01-13)
- **Breaking:** modules renamed `msgBusCore` -> `contracts`, `msgBusFactory` -> `core`
- **Breaking:** `onceAsync` -> `once`, `dispatch` -> `send` (returns a promise), `dispatchAsync` -> `request`; per-call `config` replaced by `options` (`MsgSubOptions`, `PromiseOptions`, `MsgRequestOptions` with `sendTimeout`/`responseTimeout`)
- Optional `config` handled safely when channel config is missing

### 1.2.1 - 1.2.2 (2026-01-06 - 2026-01-08)
- `@actdim/utico` dependency updates only; no library changes

### 1.1.7 (2026-01-02)
- `payloadFn` passes all tuple arguments (rest args fix)

### 1.1.6 (2025-12-31)
- **Breaking:** provider callback receives `(msgIn, headers)` instead of `(msgIn, msgOut)`; provider params accept `headers` merged into the response
- Fixed `delay` when a channel has no config

### 1.1.2 (2025-12-29)
- Fixed `throttle`/`debounce` when a channel has no config

### 1.1.1 (2025-12-29)
- **Breaking:** `MsgBus*` types renamed to `Msg*` (`MsgBusStruct` -> `MsgStruct`, `MsgBusSubscriber` -> `MsgSubscriber`, ...)
- **Breaking:** `requestId`, `traceId`, `priority`, `persistent` moved from the message into typed `MsgHeaders`
- `throttle` and `debounce` on channel and subscriber config; `timeout` for awaitable calls with `BaseError`, `TimeoutError`, `AbortError`

### 1.1.0 (2025-12-19)
- Dispatch param `ext` renamed to `headers`; `$TypeArgStruct` / `$TypeArgHeaders` type markers on `MsgBus`

### 1.0.6 (2025-12-18)
- Message headers support: `THeaders` type parameter, `headers`, `version`, `tags` on `Msg`; provider callback also receives the outgoing message

### 1.0.5 (2025-12-16)
- **Breaking:** abort signal moved from `params.signal` to `params.config.abortSignal`; error channel made optional in `MsgBusStruct`

### 1.0.2 (2025-11-10)
- Dependency and build config updates only; no library changes

### 1.0.0 (2025-11-03)
- Replay channels via `replayBufferSize` / `replayWindowTime` channel config (`ReplaySubject`); message `id` may be supplied by the caller
- Test setup for Node and browser (Vitest, Mocha)

### 0.9.3 (2025-10-06)
- Dependency updates (`rxjs`, `uuid` 13, `@actdim/utico`) and build scripts; no library changes

### 0.9.1 (2025-07-08)
- `@actdim/utico` moved to peer dependencies; package description updated

### 0.9.0 (2025-07-08)
- Initial release: `createMsgBus` with `on`, `onceAsync`, `stream`, `provide`, `dispatch`, `dispatchAsync`

---

## License

MIT License. See [LICENSE](LICENSE) for details.
