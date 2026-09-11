---
protocol: along
slug: domain-model
title: 02 Domain Model
type: topic
created: 2026-08-27
updated: 2026-09-02
tags: [domain-model]
---

# @actdim/msgmesh Domain Model & Type Hierarchy

## 1. Domain Types Overview

The domain model of `@actdim/msgmesh` defines strict compile-time contracts for message buses, channel structures, payload group definitions, and runtime execution headers.

## 2. Core Entities & Type Schemas

### 2.1. Structural Message Bus Definition (`MsgStruct`)
The core message bus schema is defined by extending `MsgStructBase`:
```typescript
import { MsgStruct } from '@actdim/msgmesh/contracts';

export type AppBusStruct = MsgStruct<{
    'USER.LOGIN': {
        in: { username: string; passwordHash: string };
        out: { token: string; userId: string; roles: string[] };
    };
    'DATA.REFRESH': {
        in: { entity: string };
        out: void; // Confirms execution without payload
    };
    'MEDIA.PROCESS': {
        inImage: { url: string; width: number; height: number };
        inVideo: { url: string; bitrate: number };
        out: { assetId: string };
    };
}>;
```

### 2.2. Reserved Constants & Channel Names
- **`$CG_IN = 'in'`**: Standard input group.
- **`$CG_OUT = 'out'`**: Standard output response group.
- **`$CG_ERROR = 'error'`**: Channel-level error group.
- **`$C_ERROR = 'MSGBUS.ERROR'`**: Global system bus error channel.
- **`$C_ANY = '*'`**: Wildcard configuration target.
- **`$SYSTEM_TOPIC = 'msgbus'`**: Reserved internal topic identifier.

### 2.3. Message Wrapper (`Msg<TStruct, TChannel, TGroup, THeaders>`)
Every message delivered through subscriptions or providers is wrapped in a `Msg` envelope:
```typescript
interface Msg<TStruct, TChannel, TGroup, THeaders> {
    channel: TChannel;
    group: TGroup;
    payload: PayloadType;
    topic?: string;
    headers?: THeaders;
    status?: 'success' | 'error' | 'skipped' | 'cancelled';
    timestamp?: number;
}
```

### 2.4. Error Domain Model
- **`BaseError`**: Foundation error class with proper prototype link.
- **`TimeoutError`** (`$isTimeoutError`): Thrown when `timeout` option is exceeded during `request()`, `once()`, or `lock()`.
- **`AbortError`** (`$isAbortError`): Thrown when an `AbortSignal` is triggered.
- **`OperationCanceledError`** (`$isOperationCanceledError`): Emitted when a provider signals operation cancellation.
- **`NoProviderError`** (`$isNoProviderError`): Thrown when `mandatoryProvider: true` and no active handler is registered for the requested channel.
- **`ErrorPayload`**: `{ error: any; source?: any; handled?: boolean }`.

### 2.5. Channel Pipeline Configuration (`MsgBusConfig<TStruct>`)
```typescript
type ChannelConfig = {
    replayBufferSize?: number;
    replayWindowTime?: number; // ms
    delay?: number; // ms
    throttle?: number | {
        duration: number; // ms
        leading?: boolean;
        trailing?: boolean;
    };
    debounce?: number; // ms
    mandatoryProvider?: boolean;
};

type MsgBusConfig<TStruct> = {
    '*'?: ChannelConfig | ((channel: keyof TStruct) => ChannelConfig);
} & {
    [C in keyof TStruct]?: ChannelConfig;
};
```

## 3. Cross-Links
- [[INDEX.md]] - Knowledge Base Root
- [[01-[architecture](./topic--architecture.md).md]] - System Architecture
- [[03-[setup-and-workflow](./topic--setup-and-workflow.md).md]] - Setup and Workflow
- [[04-api-reference.md]] - Exhaustive [API Reference](./topic--03-api-reference.md)
- [[05-patterns-and-recipes.md]] - Practical Recipes and Messaging Patterns
