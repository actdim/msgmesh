---
slug: kubb-orval-service-adapters
type: feat
status: open
priority: medium
created: 2026-08-27
updated: 2026-08-27
---

# Service Adapters for Kubb, Orval, and React Query OpenAPI Generators

- Source: `src/adapters.ts`
- Related: `docs/04-advanced-patterns.md`, `src/contracts.ts`

## Context

Currently, `@actdim/msgmesh/adapters` provides service adapter type transformers and runtime wrappers tailored for NSwag-generated TypeScript API client classes (`ToMsgChannelPrefix`, `ToMsgStruct`, `getMsgChannelSelector`, `MsgProviderAdapter`).

Modern OpenAPI client generation tools like **Kubb** (kubb.dev) and **Orval** (orval.dev) emit functional client modules, object-based method maps, or React Query / TanStack Query options and hooks. To allow developers using Kubb or Orval to seamlessly expose their generated API functions as typed MsgMesh channels, dedicated adapter utilities are required.

## Requirements

1. **Kubb & Orval Type Transformers**:
   - Implement type utilities (e.g. `ToKubbMsgStruct`, `ToOrvalMsgStruct`, `ToFunctionalMsgStruct`) that map functional client maps and OpenAPI function signatures into `MsgStruct` channels (`{ channel, in, out }`).
2. **Functional Client Adapter**:
   - Implement runtime adapter helper (`createFunctionalMsgAdapter`) that converts module exports or object maps of standalone async functions into MsgMesh channel providers (`provide()`).
3. **React Query / TanStack Query Bridge**:
   - Provide integration helpers to map generated React Query `queryOptions` and mutation functions directly to `msgBus.request()` calls.
4. **Documentation & Testing**:
   - Add unit tests in `tests/adapters.test.ts` verifying Kubb and Orval mock client wrapping.
   - Update `docs/04-advanced-patterns.md` with Kubb and Orval configuration examples.
