---
protocol: along
protocol_version: "4.4.1"
slug: msgbus-error-own-fields
type: bug
status: done
completed: 2026-10-01
priority: medium
created: 2026-10-01
updated: 2026-10-01
agent: claude-code
tags: [errors, msgbus]
milestone: v2.0.0-along-transition
blocked_by: []
related: []
---

# MSGBUS.ERROR payload drops own error fields outside DEV

Outside DEV, `createMsgBus` (`src/core.ts`) serialized a thrown `Error` into the `MSGBUS.ERROR` payload as only `name`, `message`, `stack`, `cause`. Own enumerable fields were lost (e.g. `HttpClientError.status`, `HttpNetworkError.kind` from `@actdim/dynstruct`), so consumers could not classify errors in production builds.

Fix: spread `Object.fromEntries(Object.entries(err))` into `errInfo` before the standard fields (which are non-enumerable on `Error`).

## Acceptance Criteria
- [x] Own error fields are kept in the `MSGBUS.ERROR` payload when `import.meta.env.DEV` is false
- [x] Regression test `keeps own error fields in MSGBUS.ERROR payload outside DEV` in `tests/msgBus.test.ts`
- [x] Automated tests passing (55/55)
