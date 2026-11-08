---
protocol: along
protocol_version: "4.6.1"
date: 2026-11-08
slug: async-publish-and-backpressure
agent: claude-code
branch: main
commit: e85ece7
summary: 'Phase 1 flow control in msgmesh: per-channel flowControl { maxInFlight, overflow: wait|error, leaseTimeout }; slot taken in dispatch()/requestStream() before publish, released by out answer (any status), provider cancel, lease timeout or no subscribers; FIFO waiters with send timeout/abortSignal and request sendTimeout; ChannelBusyError, getFlowStats; fire-and-forget gate errors routed to MSGBUS.ERROR. 15 new tests (84 total) green; 100k send() micro-benchmark without flowControl unchanged vs HEAD (105-172 ms vs 130-156 ms, noise).'
milestone: v2.0.0-along-transition
issues_advanced: []
issues_completed: [feat--async-publish-and-backpressure]
decisions: []
files: [src/packages/msgmesh/AGENTS.md, src/packages/msgmesh/docs/topic--02-architecture-and-types.md, src/packages/msgmesh/docs/topic--03-api-reference.md, src/packages/msgmesh/docs/topic--04-advanced-patterns.md, src/packages/msgmesh/src/contracts.ts, src/packages/msgmesh/src/core.ts, src/packages/msgmesh/tests/flowControl.test.ts, src/packages/msgmesh/tests/perf.tmp.test.ts]
---

# Session: Async publish and backpressure

## Summary
Phase 1 flow control in msgmesh: per-channel flowControl { maxInFlight, overflow: wait|error, leaseTimeout }; slot taken in dispatch()/requestStream() before publish, released by out answer (any status), provider cancel, lease timeout or no subscribers; FIFO waiters with send timeout/abortSignal and request sendTimeout; ChannelBusyError, getFlowStats; fire-and-forget gate errors routed to MSGBUS.ERROR. 15 new tests (84 total) green; 100k send() micro-benchmark without flowControl unchanged vs HEAD (105-172 ms vs 130-156 ms, noise).

## Decisions
- None (confirmed at wrap: no architectural decisions).

## Blackboard Record

Execution mode: direct; plan revision 1; approved: true.

Plan: kept with the issue (`plan/plan.md`, 1 revision(s)).

### Execution Trace

#### Execution Trace: async-publish-and-backpressure
- 2026-11-08T19:24:05Z plan recorded: revision 1 (ExitPlanMode)
- 2026-11-08T19:24:05Z phase: planning -> execution
- 2026-11-08T19:24:05Z plan approved (ExitPlanMode) approved_via: exit-plan-mode, plan_sha256: eee99e62ff8e
- 2026-11-08T19:24:16Z edit src/packages/msgmesh/tests/perf.tmp.test.ts
- 2026-11-08T19:25:02Z edit src/packages/msgmesh/src/contracts.ts (x7)
- 2026-11-08T19:26:38Z edit src/packages/msgmesh/src/core.ts (x9)
- 2026-11-08T19:29:58Z edit src/packages/msgmesh/tests/flowControl.test.ts (x4)
- 2026-11-08T19:31:52Z edit src/packages/msgmesh/docs/topic--04-advanced-patterns.md (x2)
- 2026-11-08T19:31:55Z edit src/packages/msgmesh/docs/topic--03-api-reference.md (x4)
- 2026-11-08T19:31:57Z edit src/packages/msgmesh/docs/topic--02-architecture-and-types.md (x2)
- 2026-11-08T19:32:19Z edit src/packages/msgmesh/AGENTS.md (x2)
- 2026-11-08T19:32:53Z test pass (Pre-Commit Quality Gate)
