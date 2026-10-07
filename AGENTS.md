<!-- BEGIN ALONG-PROTOCOL root (managed by along-init - do not edit by hand) -->
# ALONG-PROTOCOL v4.4.7

This repo carries its own agent context, provider-agnostically. Follow it every session, whatever tool you are.

## Scope, Precedence & Subproject Placement
- **Nearest Context Boundary**: Any folder may carry its own `AGENTS.md` + `.along/`; use the NEAREST ones for the area you're working in. On conflict, the more specific wins.
- **Subproject Localization** [gate: subproject-boundary]: In submodules, nested repos or symlinked folders: all entities (issues, sessions, ADRs, history) MUST be created in the NEAREST `.along/`. Agents are STRICTLY FORBIDDEN from dumping subproject changes into the workspace root `.along/`.
- **Multi-Subproject Work** [gate: subproject-boundary]: A change spanning subprojects needs an issue in each touched `.along/`, or a root umbrella issue whose child issues there carry `parent: <umbrella key>`. Edits under a subproject `.along/` are checked by path.
- **Subproject Boundary**: only a nested `.git` or a user-run `along init` makes a subproject; never init a manifest folder.
- **Precedence**: Nearest `.along/` > higher-level `.along/` > global config (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/config/GEMINI.md`).

## At session start - read these yourself (they are NOT auto-loaded)
Use the NEAREST `.along/` for the area you're working in (fall back to a higher-level one if the folder has none):
1. `AGENTS.md` (nearest) - conventions to follow.
2. `.along/ISSUES.md` - active issue board (or query `/along-kb-search`).
3. `.along/CONSTRAINTS.md` - active architectural constraints (or full log in `.along/DECISIONS.md` / `.along/DECISIONS/`).
4. Active Issue file `.along/ISSUES/<type>--<slug>.md` for your task.
Also, when relevant: `.along/VISION.md`, `.along/GLOSSARY.md`. These reflect the state WHEN WRITTEN - verify any named file/API/flag against the real code first.

## Multi-Agent & Multi-Branch Concurrency
- **Zero-Manual-Merge Rule** [gate: projection-protection]: On merge conflicts in derived projections (`ISSUES.md`, `INDEX.md`, `DECISIONS.md`), accept either side and run `/along-issue-sync`, `/along-kb-sync`, or `/along-decision-sync` to recompile. `along git setup` registers merge drivers that do this automatically; afterwards run `along git sync`.
- **Append-Only Merge Driver**: `.along/HISTORY.md` and legacy monolithic `.along/DECISIONS.md` are append-only. Configure `.gitattributes` with `merge=union`. Modular ADR files in `.along/DECISIONS/` are isolated per-file to eliminate merge collisions.
- **Untracked Exports** [gate: untracked-exports]: `.along/dashboard.html`, `.along/DASHBOARD.md` and per-machine `.along/diagnostics/` stay out of Git.
- **Context Isolation**: Context is localized to the target issue file, session-scoped blackboard (`.along/.session/<slug>/`), and completed session logs.
- **Parallel Closeout**: `along session list`; on the user's yes `along plan approve --closeout --ready`, then `along session close --ready`.

## Mandatory Issue Anchoring
- **No Code Without Issue** [gate: require-active-issue]: Before modifying source code, agents MUST identify or create an issue in `.along/ISSUES/<type>--<slug>.md` and set `status: in-progress`.
- **Session Binding & Plan Approval** [gate: require-plan-approval]: `along start <slug>` binds THIS agent session to the issue; parallel sessions keep their own bindings. Source edits unlock after the user approves the plan (Claude Code: `ExitPlanMode`; elsewhere `along plan approve` only after the user's explicit yes). `along plan status` shows the binding.
- **Exemptions**: Read-only Q&A and 1-line micro-edits (typo fixes, comments) do not require issues.
- **Commit Binding** [gate: commit-issue-binding]: Every commit via `/along-commit` MUST bind to the active issue slug.
- **No AI Co-Authors** [gate: commit-no-ai-coauthor]: Commit messages MUST NOT carry `Co-Authored-By:` trailers naming an AI agent (GitHub lists the vendor as a contributor). `along hook install` turns runtime attribution off; opt out via `.along/config.json` `commits.allow_ai_coauthor: true`.

## Entity Ecosystem
- **Entity types**: Issues (`feat`, `bug`, `debt`, `task`, `docs`), Decisions (ADRs), Milestones, Risks, Spikes, Checklists, Sessions. Full YAML schemas: `docs/topic--domain-model.md`.
- **Canonical keys**: `<type>--<slug>` (e.g. `feat--token-refresh`). Reference by key, NEVER by file path.
- **ADRs**: Modular records in `.along/DECISIONS/ADR-YYYY-MM-DD--<slug>.md` (with legacy fallback to monolithic `DECISIONS.md`). Never edit past entries - mark superseded. Recompile projections (`.along/DECISIONS.md` board and `.along/CONSTRAINTS.md`) via `/along-decision-sync` or `along decision sync`.
- **Issue lifecycle** [gate: issue-lifecycle]: Close with `along issue done <slug>` (`status: done`, `completed`, moved to `.along/ISSUES/done/`).
- **Entity references** [gate: entity-reference-integrity]: Never delete an entity other entities reference; use `along issue rename` / `along issue supersede`.
- **Auto-entity creation**: Agents MUST automatically detect user intent (build/fix/refactor -> Issue, blocked/rate-limit -> Risk, compare/benchmark -> Spike, release/sprint -> Milestone) and create entities without prompting the user.

## Knowledge Base & Documentation
- **Stable Entry Point** [gate: stable-entry-point]: `README.md` and `docs/` never link into `.along/`; route through `docs/INDEX.md` or `docs/topic--<slug>.md`.
- **Portable Links** [gate: portable-links]: Relative Markdown links only.
- **Fact Grounding**: Agents MUST extract facts from actual code, `README.md`, `docs/`, and `package.json`. Generic LLM placeholders are strictly prohibited.
- **Fast Retrieval** [gate: fast-retrieval]: Agents MUST query `/along-kb-search` before reading whole documentation files.
- **Doc Blast Radius**: After non-trivial code changes, agents MUST map affected symbols to `docs/topic--*.md` articles and update them before completing the task.
- **Manual Document Lock** [gate: doc-manual-lock]: Documents marked with `write_policy: manual` (or `locked: true`) are protected from automated agent modification during blast radius sweeps. Modifications require an explicit documentation issue (`docs--<slug>`).
- **Managed Rule Packs** [gate: rule-pack-protection]: Never edit `.along/rules/**/*.md`; `along rules attach` owns them. Project guidelines go to `docs/topic--<slug>.md` or "Project specifics"; revert with `along rules restore`. `.along/rules/gates.yaml` and `.along/scripts/` stay repo-owned.
- **Documentation Routing Tree**:
  - Architectural choice / trade-off -> `.along/DECISIONS/` (ADR)
  - Public overview / pitch / landing page -> `README.md`
  - Technical interface contract / CLI spec -> `docs/topic--<slug>.md` (`type: reference`)
  - Conceptual explanation / comparison / philosophy -> `docs/topic--<slug>.md` (`type: explanation`, `write_policy: manual`)
  - Procedural walkthrough / runbook -> `docs/topic--<slug>.md` (`type: guide`)

## While working
- **Decisions**: Create new ADRs via `/along-decision-sync` or `along decision create <slug> --title "..."`. Add terms to `.along/GLOSSARY.md`.
- **Token hygiene**: Use quiet flags (`pytest -q`, `dotnet test -v q`), filter outputs, inspect targeted line ranges.
- **Lifecycle hooks first**: Agents MUST use `/along-test`, `/along-build`, `/along-dev` (or `.along/scripts/*.py`) before raw shell commands.
- **Post-change review**: Agents MUST inspect diffs and evaluate blast radius via `along graph-impact` (or static search fallback). Silent skips are forbidden.

## Stage & Session Completion Checklist
When a stage or session completes, agents MUST execute in this order:
1. [ ] **Tests** [gate: test_before_stop]: Run via `/along-test` with quiet flags. Zero failures.
2. [ ] **File Integrity**: `git status -u` - all new/modified files non-zero size, no empty placeholders.
3. [ ] **Code Review**: Inspect diff for side effects, verify REQ-N coverage, evaluate blast radius via `along graph-impact` (or static search), verify architectural decision compliance.
4. [ ] **Entity Reconciliation**: Close issues (`done` + move to `done/`), update milestones, resolve risks, conclude spikes.
5. [ ] **Doc Blast Radius**: Update affected `docs/topic--*.md`, `README.md` and Project specifics; add new terms to `.along/GLOSSARY.md`; touch `.along/VISION.md` only if scope/roadmap changed; run `/along-kb-sync`.
6. [ ] **Session Log** [gate: wrap_before_stop]: `along wrap <slug> --decisions <ADR...> | --no-decisions` writes `.along/SESSIONS/<YYYY>/<date>--<slug>.md` with the blackboard record; answer the decisions question explicitly.
7. [ ] **Projections** [gate: projection_sync_before_stop]: Run `/along-issue-sync` and `/along-decision-sync`.
8. [ ] **HISTORY**: Append line to `.along/HISTORY.md`.
9. [ ] **Compaction**: Advise user to run `/compact`.

## Rules
- **Contract-First Lifecycle**:
  - Agents MUST execute `.along/scripts/<action>.py` or `/along-test`, `/along-build`, `/along-dev` before raw shell commands.
  - When `.along/scripts/` is missing, `along test`/`along build` auto-detects and synthesizes hooks.
  - In submodules, execute the hook from that subproject's own `.along/scripts/`.
- **Environment Isolation**:
  - Agents MUST NOT install system-wide or global packages when a script fails. Fix the architecture (missing `bootstrap.ensure_deps()`, incorrect `uv` wrapper), not the environment.
- **Workspace Containment** [gate: workspace-containment]: Read and write only inside the workspace. Writes elsewhere are limited to the temp dir and runtime artifact dirs. Other repos need `allowed_roots` (`.along/rules/gates.yaml`, issue frontmatter, `along start --allow-root`). Never touch credential stores (`~/.ssh`, `~/.aws`).
- **Runtimes Without Along Hooks** (Claude Cowork, Cursor, OpenCode, plain shells): gates are advisory there. Agents MUST self-apply every gate-tagged rule and use the `along` CLI for tests, commits, entity changes, and wrap instead of raw tools. `along doctor` reports the enforcement level.
- **File Modification & Anti-Deletion**:
  - Never delete, truncate, or overwrite existing documentation, comments, or code unless explicitly instructed.
  - After batch edits or migrations, agents MUST run `git diff --stat` and inspect unexpected size reductions.
  - No stubs or skeletons in place of populated code [gate: anti_stub_injection].
  - Anchor edits on minimal unique chunks. Restore unintended deletions immediately.
- **Clean ASCII** [gate: typography]: ASCII punctuation only (no typographic dashes, quotes, ellipsis, bullets, NBSP/zero-width chars or BOM); `along sanitize --write` fixes them.
- **Markdown** [gate: code-fence-language]: Every code fence names a language.
- **File Content Via Tools Only** [gate: cli_safety]: Create/edit files with the agent's file tools. NEVER carry content in heredocs, `python -c`, or inline shell. Write scripts to a file first.
- **Verify Written Files**: After writing/patching, confirm parsing (`python -m compileall -q`, `bash -n`, etc.) before moving on.
- **Hermetic Tests**: Tests MUST target throwaway fixtures (`tempfile.mkdtemp()`), never the live repository. Read-only access to live state is allowed. Keep a meta-test that verifies `git status --porcelain -u` stays clean.
- **Inquiry Read-Only Invariance (Zero-Mutation Rule on Questions)** [gate: require-plan-approval]: On interrogative prompts ("is X done?", "why did Y fail?"), write/modify tools are STRICTLY PROHIBITED. Return a read-only audit report and ask for confirmation before modifying anything.
- **Mandatory Adaptive Complexity Escalation & Execution Mode Routing**: When scope touches > 3 files, crosses subsystems, or refactors core engines: single-agent execution is forbidden - route to `along-team`. Plans MUST declare `Execution Mode: Direct` or `Role-Based`. Role-based blackboards (`along scratch init`) are held to the step loop [gate: team-step-active] [gate: team-reviews-before-stop]; dropping it needs `along scratch fallback <slug> --reason "..."`.
- Windows-safe filenames [gate: windows-safe-filenames]: dates `YYYY-MM-DD`, date first.
- Keep `ISSUES.md` compact: `along context-budget --check` enforces the limit.
- Never write secrets into tracked files [gate: no-tracked-secrets].
<!-- END ALONG-PROTOCOL -->

# AGENTS.md - AI Context for @actdim/msgmesh

## Project

Type-safe message bus for TypeScript. Built on RxJS (Subjects + pipe operators), but RxJS is an implementation detail - the public API is simple pub/sub + request/response.

Part of the @actdim/dynstruct architectural framework.

## File Structure

```
src/
  contracts.ts   - All types, interfaces, error classes (MsgStruct, MsgBus, MsgHeaders, Msg, etc.)
  core.ts        - Implementation (createMsgBus): publish, subscribe, provide, dispatch, request, requestStream, stream
  adapters.ts    - Service adapter system: registerAdapters, ToMsgStruct, ToMsgChannelPrefix, getMsgChannelSelector
  util.ts        - Helpers (delay, throttle options)
tests/
  msgBus.test.ts - Main test suite (vitest)
  testDomain.ts  - Test bus structure (TestBusStruct) and shared bus instance
```

## Commands

```bash
pnpm test              # Run tests (vitest)
pnpm test:w            # Watch mode
pnpm build             # type-check (build mode) + Vite build → dist/
pnpm typecheck         # type-check (build mode)
pnpm lint              # ESLint (max-warnings 0)
pnpm format            # Prettier write
pnpm format:check      # Prettier check
```

## TypeScript Config Layout

Solution-style split - do not collapse it back into one config:

- `tsconfig.base.json` - shared `compilerOptions` only. `moduleResolution: "bundler"` (this is a Vite package; do NOT switch to `"node"`/`node10` (deprecated) or `nodenext` (would force `.js` import extensions)). No `baseUrl` (deprecated in TS 6.0) - `paths` targets are relative: `"@/*": ["./src/*"]`. `extends` inherits only `compilerOptions`, not `include`/`files`/`references`.
- `tsconfig.json` - pure orchestrator: `{ "files": [], "references": [...] }`. It compiles nothing itself; it only wires the leaf projects.
- `tsconfig.build.json` - library build; emits `.d.ts` to `dist`. Consumed by `vite-plugin-dts` via its `tsconfigPath` (must stay a config WITHOUT `references`, else the plugin emits zero declarations).
- `tsconfig.dev.json` - editor/dev + tests; broad `types` (node, vitest/globals, vite/client, ...).

Rules:

- Root Node files (`packageConfig.ts`, `vite.config.ts`, `vitest*.config.ts`) get node types via `types: ["node"]` in the build/dev projects - NOT by editing includes elsewhere or adding `node` to a shared `types` array (that leaks node globals into browser `src`). If the editor shows "Cannot find name 'path'/'\_\_dirname'" on such a file, it means the file isn't routed to a project - check the `references` chain, don't hack the source with `/// <reference>`.
- Always type-check the solution with `tsc -b` (build mode), never `tsc -p` - `-p` sees `files: []` and checks nothing. Both `typecheck` and `build` scripts already use `tsc -b tsconfig.json`.

## Architecture

### Message Addressing: Channel → Group → Topic

Every message has an address: `{ channel, group, topic }`.

- **Channel** - logical namespace (e.g. `"User.Login"`, `"Api.FetchData"`). String with dot notation.
- **Group** - defines message role within a channel. Two semantic kinds:
    - **Input groups** - any name except `"out"` and `"error"`. Declare the payload type coming _into_ the channel.
        - `"in"` - conventional primary input group; used as default in `send`, `on`, `provide`, `request` when group is omitted.
        - Custom names (`"in1"`, `"in2"`, etc.) - additional input payload types on the same channel (**input type overloading**). Each input group is an independent subscription target; a `provide()` handler must specify which group it listens to.
    - **Output group** - always named `"out"`. Declares the payload type of the channel's response. One per channel, shared across all input groups. If omitted, `MsgStruct<>` adds `out?: void` implicitly.
    - `"error"` - reserved; auto-published on provider throw.
    - **`send()` vs `request()`**: `send()` publishes and returns immediately (fire-and-forget - no confirmation of handling). `request()` / `requestStream()` awaits the handler's response via `out`. Even `out: void` is meaningful: it confirms the message was _processed_, not just dispatched. A handler can set `msgOut.status = 'skipped'` to produce no `out` response and let another handler take it (chain of responsibility).
- **Topic** - optional sub-filter. Exact match by default. Regex if wrapped in slashes: `"/^task-.*/"`.
- **Reserved**: `"MSGBUS.ERROR"` channel for system-level errors.

### Type Structure

Bus should be defined via generic `MsgStruct<...>` - it augments your structure with system channel groups (for example, `error`) and is the same base type used across the API:

```typescript
type MyBus = MsgStruct<{
    'Order.Create': {
        in: { items: Item[] }; // request payload
        out: OrderResult; // response payload
    };
}>;
```

`out` types should NOT be wrapped in `Promise` - async is handled at the API level.

`MsgStruct<>` adds three implicit groups to every channel if not declared explicitly:

- `error?: ErrorPayload` - always added (channel-specific errors)
- `out?: void` - added when `out` is missing; `void` enforces explicit type declaration when payload matters
- `in?: void` - added when `in` is missing; same rationale

This means `group: "out"` is always a valid subscription target even if `out` is not in the channel struct.

### Public API vs Internal Functions

Both `send()` and `request()` use internal `dispatch()`. `publish()` is a lower-level internal function.

| Public method     | Internal function                                         | Notes                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `send()`          | `dispatch()`                                              | Effectively just publish (no `callback` in `MsgSenderParams`, so `dispatch` skips `out` subscription). Generates `requestId` in headers                                |
| `on()`            | `subscribe()`                                             | Direct subscription                                                                                                                                                    |
| `once()`          | `subscribe()` with `fetchCount: 1` + Promise wrapper      |
| `stream()`        | `subscribe()` + async generator with manual Promise queue |
| `provide()`       | `subscribe()` + auto-publish to `out`                     |
| `request()`       | `dispatch()` + Promise.race with timeout                  |
| `requestStream()` | `subscribe(out)` + `publish(in)` + async generator        | Generates `requestId` upfront; subscribes to `out` filtered by `requestId` before publishing; no `fetchCount: 1` on subscription - all provider responses flow through |

`publish()` is a purely internal function - not exposed in the public API. It generates `msg.id`, sets `publishedAt`, and calls `Subject.next()`. It does not set a default `status`.

### Internal Flow

#### Channel Config Inheritance

`getChannelConfig(channel)` merges `config["*"]` (base) with `config[channel]` (specific). Channel-specific always wins:

```typescript
const base = config?.[$C_ANY];
const defaults = typeof base === 'function' ? base(channel) : base;
return { ...defaults, ...config?.[channel] };
```

`$C_ANY` is the exported constant for the `"*"` key. Use it, or write `"*"` directly in the config object, to set defaults for all channels:

```typescript
// Static default
createMsgBus<MyStruct>({
    '*': { mandatoryProvider: true },
    'Order.Create': { mandatoryProvider: false }, // overrides for this channel
});

// Dynamic default - function receives the channel name
createMsgBus<MyStruct>({
    '*': (channel) => ({ mandatoryProvider: channel.startsWith('Api.') }),
    'Order.Create': { mandatoryProvider: false },
});
```

`"*"` is reserved - cannot be used as a channel name. Enforced at the type level via `"*"?: never` in `SystemMsgStruct`.

#### Subject Routing

Messages are routed via RxJS Subjects stored in `Map<string, Subject>`.

- **Routing key**: `"channel:group"` (e.g. `"User.Login:in"`, `"User.Login:out"`)
- One Subject per channel+group pair, created lazily by `getOrCreateSubject()`
- `ReplaySubject` used when config has `replayBufferSize` or `replayWindowTime`; plain `Subject` otherwise

#### Pipe Chain Order

Each subscription builds an RxJS pipe chain in this exact order:

```
filter(topic match + custom filter)
  → channel throttle (from config)
    → subscription throttle (from options)
      → channel debounce (from config)
        → subscription debounce (from options)
          → channel delay (from config)
            → observeOn(asyncScheduler)
              → take(fetchCount)
```

The `asyncScheduler` ensures message delivery is always async (never synchronous in the same microtask as `publish()`).

#### dispatch() - Critical Ordering

`dispatch()` (which is exposed as public `send()`):

1. **First**: subscribes to `out` group with filter `outMsg.headers.inResponseToId === msg.headers.requestId`
2. **Then**: publishes message to `in` group via `publish()`
3. Returns the published message (with `headers.requestId`)

This order is critical - subscribing after publishing could miss the response if it arrives synchronously.

#### provide() - Headers Merge & Cancel Logic

```typescript
const msgOut: Msg<TStructN, keyof TStructN, 'out'> = {
    address: { channel: msgIn.address.channel, group: 'out', topic: msgIn.address.topic },
    headers: { ...msgIn.headers, ...params.headers, inResponseToId: msgIn.headers?.requestId },
};
// msgIn.headers first, then provider's static headers override, inResponseToId always wins
```

On cancel: `provide()` **awaits** the callback, then checks `msgIn.status === 'canceled'` OR `msgOut.status === 'skipped'` OR `msgOut.status === 'canceled'` and does NOT publish `out`:

```typescript
const payload = await Promise.resolve(params.callback(msgIn, msgOut));
if (msgIn.status === 'canceled' || msgOut.status === 'skipped' || msgOut.status === 'canceled') {
    return; // skip publish to out
}
msgOut.payload = payload;
publish(msgOut);
```

Provider-initiated cancellation: set `msgOut.status = 'canceled'` inside the callback - `provide()` will skip publishing `out`, and `request()` will reject with `OperationCanceledError`.

Chain of responsibility: set `msgOut.status = 'skipped'` - `provide()` skips publishing, the next provider handles the message.

#### request() - No-Provider Check

Before setting up the timeout/promise, `request()` checks for a registered provider if either `options.throwIfNoProvider` is set or the channel config has `mandatoryProvider: true`:

```typescript
if (options.throwIfNoProvider || channelConfig.mandatoryProvider) {
    if (!inSubject.observed) throw new NoProviderError(channel);
}
```

This is a synchronous snapshot check - it does not guarantee delivery. Use ack for delivery guarantees (planned).

#### request() - Response Handling

`request()` checks response `status` in this order:

1. `'canceled'` → reject with `OperationCanceledError`
2. `'error'` → reject with `Error` (message from `headers.error`)
3. Else → set `status = 'ok'`, resolve

**Default timeout**: 5 seconds (`defaultPromiseTimeout = 1000 * 5`). Override globally: `import { defaultPromiseTimeout } from '@actdim/msgmesh/core'; defaultPromiseTimeout = 10000;`

#### request() - Abort Timing

Abort listener is set up AFTER `await dispatch()` completes (not before). Then checks `abortSignal.aborted` for early abort. This means: if abort fires during publish, it's caught by the `aborted` check after dispatch returns.

#### Error Routing

On error in `provide()` callback, errors are published to BOTH:

1. `channel:error` group (channel-specific, topic: `"msgbus"`)
2. `MSGBUS.ERROR:in` channel (global, topic: `"msgbus"`)

AND - if the message had a `requestId` - also published to `out` with `status: 'error'` so `request()` rejects immediately instead of timing out.

On error in `subscribe()` callback, only routes to error channels (no `out` response).

Payload: `{ error, source: { id, address, headers } }`

## Key Concepts

### msg.id vs headers.requestId

- `msg.id` - **transport ID**. Unique per published message. Generated by `publish()`. Every message gets a new one.
- `headers.requestId` - **logical request ID**. Generated once per `dispatch()` call: `params.headers?.requestId || uuid()`. Shared between the original request and its cancel message. Used to correlate request → response.

The cancel message has the SAME `requestId` as the original but a DIFFERENT `msg.id`.

### headers.inResponseToId

Set by `provide()` on the `out` response headers: `msgOut.headers.inResponseToId = msgIn.headers.requestId`. This is how `dispatch()` filters the correct response for a given request.

### Cancellation Flow

1. Caller calls `request({ ..., options: { abortSignal } })`
2. On abort: `request()` publishes a cancel message to `in` group with `{ requestId: <same>, status: 'canceled' }` - so the provider can stop in-flight work
3. `provide()` callback receives the cancel message - provider can clean up (e.g. abort fetch)
4. `provide()` does NOT publish `out` for cancel messages
5. `request()` rejects with `OperationCanceledError`

Provider-side pattern for cancelable work:

```typescript
const activeRequests = new Map<string, AbortController>();
msgBus.provide({
    channel: '...',
    callback: async (msg, msgOut) => {
        if (msg.status === 'canceled') {
            activeRequests.get(msg.headers.requestId)?.abort();
            activeRequests.delete(msg.headers.requestId);
            return;
        }
        const ctrl = new AbortController();
        activeRequests.set(msg.headers.requestId, ctrl);
        try {
            return await doWork({ signal: ctrl.signal });
        } finally {
            activeRequests.delete(msg.headers.requestId);
        }
    },
});
```

### msg.status (MsgStatus)

`'handled' | 'failed' | 'canceled' | 'skipped' | 'timeout' | 'pending'`

`status` lives on the top-level `Msg` object, not in `headers`.

- `publish()` sets no default status (undefined by default)
- `request()` sends `status: 'canceled'` on abort (cancel message to provider)
- `provide()` errors set `status: 'failed'` and publish to `out` with `inResponseToId` - so `request()` rejects with `Error` (message from `headers.error`)
- Provider can set `msgOut.status = 'canceled'` to initiate provider-side cancellation - `provide()` will skip publishing `out`, and `request()` will reject with `OperationCanceledError`
- Provider can set `msgOut.status = 'skipped'` to skip publishing - lets the next provider handle the message (chain of responsibility)

### Error Types

- `TimeoutError` - timeout exceeded (request, once). Default: 5 seconds (`defaultPromiseTimeout`).
- `AbortError` - subscription aborted via AbortSignal (on, once, stream)
- `OperationCanceledError` - request canceled (request with abortSignal)
- `NoProviderError` - no provider registered on channel at time of request. Has `.channel` property.

All extend `BaseError`. Use `isTimeoutError()`, `isAbortError()`, `isOperationCanceledError()`, `isNoProviderError()` type guards.

### stream() Specifics

- Async generator (`async function*`) with manual Promise-based message queue
- Uses sentinel value `Symbol("stream-end")` for clean shutdown
- **Timeout is inactivity timeout** (resets on each message), NOT total duration
- Supports `fetchCount` (max messages) and `abortSignal`

### requestStream() Specifics

Fan-in pattern: one request, multiple provider responses collected as an async stream.

**Critical ordering** (same invariant as `dispatch()`):

1. Generate `requestId` upfront (`params.headers?.requestId ?? uuid()`)
2. **Subscribe to `out`** with filter `inResponseToId === requestId` - no `fetchCount: 1`, all provider responses pass through
3. **Publish to `in`** - providers receive the message and each publishes their response to `out`
4. Yield each response through the async generator

This subscribe-before-publish order is critical - reversing it would miss responses that arrive synchronously.

**Response status handling** (checked per message, unlike `request()` which checks once):

- `status: 'error'` → throw `Error`, stop iteration
- `status: 'canceled'` → throw `OperationCanceledError`, stop iteration

**Timeout** is inactivity timeout (same as `stream()`): resets on each received response. Use `AbortSignal.timeout()` for a hard total limit.

**`throwIfNoProvider`** works the same as in `request()`: synchronous snapshot check on `inSubject.observed`. Also triggered by `mandatoryProvider: true` in channel config.

### Chain of Responsibility

Multiple providers on the same channel each get an independent copy of the message envelope (via `structuredClone` on the envelope - payload is shared by reference). A provider can opt out of handling by setting `msgOut.status = 'skipped'` - `provide()` will skip publishing `out` for that invocation, and the next provider handles normally.

```typescript
msgBus.provide({
    channel: 'Order.Create',
    callback: (msg, msgOut) => {
        if (!canHandle(msg.payload)) {
            msgOut.status = 'skipped';
            return;
        }
        return handle(msg.payload);
    },
});
```

### settled Pattern

`once()` and `request()` use a `settled` boolean flag to prevent double resolution of the Promise. Always check `if (settled) return` before resolving/rejecting, and set `settled = true` immediately after.

### Service Adapters (adapters.ts)

Automatically wraps a service object (e.g. NSwag / Swagger generated API client or custom service class) as a bus provider. All wiring is compile-time type-safe.

### Strict Rules for Backend / API Client Integration:
1. **Zero Manual Channels for API**: When connecting REST, FastAPI, OpenAPI, Swagger, or gRPC endpoints to MsgMesh, **NEVER** write manual `MsgStruct` channel maps (`{ in: ..., out: ... }`) and **NEVER** write manual `fetch` / `axios` handlers inside `provide()`.
2. **Always Use Service Adapters**: Use NSwag, OpenAPI, or gRPC generated client classes combined with `ToMsgChannelPrefix`, `ToMsgStruct`, and `registerAdapters`.
3. **String Literal in `ToMsgChannelPrefix`**: Always pass an explicit string literal type (e.g. `'DashboardApiClient'`) as the first argument:
   ```typescript
   export type DashboardChannelPrefix = ToMsgChannelPrefix<'DashboardApiClient', 'API'>;
   ```
   **Important**: Do NOT pass `typeof Class.name` without `as const`, because in standard TypeScript `Class.name` has type `string`, which evaluates to a generic `${string}` and breaks compile-time literal channel resolution.

**Type transformation chain:**

```
Class: OrderApiClient                    Bus struct:
  .createOrder(a: Item[], b: number)  ->  "API.ORDER.CREATEORDER": { in: [Item[], number]; out: Promise<OrderResult> }
  .getOrder(id: string)               ->  "API.ORDER.GETORDER": { in: [string]; out: Promise<Order> }
```

Key types:

- `ToMsgChannelPrefix<ServiceName, Prefix, Suffix>` - generates channel prefix from a string literal or class name. Removes known suffixes (CLIENT, API, SERVICE, etc.) and uppercases. E.g. `ToMsgChannelPrefix<'OrderApiClient', 'API'>` -> `"API.ORDER."`. Static `.name` property on the class is NOT required.
- `ToMsgStruct<Service, Prefix, Skip>` - maps service methods to bus struct. Method params -> `in` tuple (`Parameters<>`), return type -> `out` (`ReturnType<>`). `Skip` excludes methods from the type.
- `MsgStruct<T>` - adds system channel groups (including `error`) to each channel in struct.

Runtime:

- `getMsgChannelSelector(services)` - creates a channel resolver from service map (`Record<Prefix, ServiceInstance>`).
- `registerAdapters(msgBus, adapters, abortSignal?)` - registers each method as `provide()` handler. Callback spreads `msg.payload` tuple as method arguments: `service[method] (...msg.payload)`.

**Standard Adapter Recipe for AI Agents:**

```typescript
import { createMsgBus } from '@actdim/msgmesh';
import {
    ToMsgChannelPrefix,
    ToMsgStruct,
    getMsgChannelSelector,
    registerAdapters,
    type MsgProviderAdapter,
} from '@actdim/msgmesh/adapters';

// 1. Any service class (generated or handwritten)
export class MediaApiClient {
    getStreamUrl(mediaId: string): Promise<string> { ... }
}

// 2. Generate prefix and bus struct at compile time (zero manual channel typing)
type MediaPrefix = ToMsgChannelPrefix<'MediaApiClient', 'API'>; // 'API.MEDIA.'
type MediaBusStruct = ToMsgStruct<MediaApiClient, MediaPrefix>;

// 3. Register service on bus
const services: Record<MediaPrefix, any> = {
    'API.MEDIA.': new MediaApiClient(),
};
const adapters = Object.entries(services).map(([prefix, service]) => ({
    service,
    channelSelector: getMsgChannelSelector(services),
})) as MsgProviderAdapter[];

const msgBus = createMsgBus<MediaBusStruct>();
registerAdapters(msgBus, adapters);

// 4. Request via typed channel using payloadFn for tuple arguments
const streamUrl = await msgBus.request({
    channel: 'API.MEDIA.GETSTREAMURL',
    payloadFn: (fn) => fn('video-42'),
});
```

**Functional API Modules (Orval / Kubb style):**

For modules with standalone exported functions (`import * as MediaApi from './mediaApi'`), name the namespace in PascalCase and use `typeof MediaApi`:

```typescript
import * as MediaApi from './mediaApi';

type MediaPrefix = ToMsgChannelPrefix<'MediaApi', 'API'>; // 'API.MEDIA.'
type MediaBusStruct = ToMsgStruct<typeof MediaApi, MediaPrefix>;

const services: Record<MediaPrefix, any> = { 'API.MEDIA.': MediaApi };
const adapters = Object.entries(services).map(([prefix, service]) => ({
    service,
    channelSelector: getMsgChannelSelector(services),
})) as MsgProviderAdapter[];

const msgBus = createMsgBus<MediaBusStruct>();
registerAdapters(msgBus, adapters);
```

**Combining Dynamic API Structs with Local UI Events:**

Complete, canonical recipe for merging NSwag-generated API structs with local UI event channels and `BaseAppMsgStruct`:

```typescript
import { createMsgBus } from '@actdim/msgmesh';
import type { MsgBus, MsgStruct } from '@actdim/msgmesh/contracts';
import {
    type ToMsgChannelPrefix,
    type ToMsgStruct,
    type BaseServiceSuffix,
    registerAdapters,
    getMsgChannelSelector,
    type MsgProviderAdapter,
} from '@actdim/msgmesh/adapters';
import { type BaseAppMsgStruct } from '@actdim/dynstruct/appDomain/appContracts';
import { type KeysOf } from '@actdim/utico/typeCore';
import { DashboardApiClient } from './api/client'; // NSwag generated client

// 1. Dynamic API prefix: 'DashboardApiClient' + 'API' -> 'API.DASHBOARD.'
export type ApiPrefix = 'API';
export type DashboardApiClientName = 'DashboardApiClient';
export type DashboardChannelPrefix = ToMsgChannelPrefix<
    DashboardApiClientName,
    ApiPrefix,
    BaseServiceSuffix
>;

// 2. Dynamic API struct: compile-time generated from DashboardApiClient methods
export type DashboardApiStruct = ToMsgStruct<
    DashboardApiClient,
    DashboardChannelPrefix
>;

// 3. Local UI state and event channels
export type DashboardLocalChannels = {
    'APP.DATA.UPDATED': { in: any; out: void };
    'APP.TAB.SET': { in: string; out: void };
    'APP.ENTITY.SELECT': { in: { id: string; type?: string }; out: void };
    'APP.ENTITY.CLOSE': { in: void; out: void };
    'APP.SSE.STATUS': { in: { connected: boolean }; out: void };
};

// 4. Combined Application Bus Struct
export type DashboardAppMsgStruct = DashboardApiStruct &
    MsgStruct<DashboardLocalChannels> &
    BaseAppMsgStruct;

export type DashboardMsgChannels<
    TChannel extends keyof DashboardAppMsgStruct | Array<keyof DashboardAppMsgStruct>,
> = KeysOf<DashboardAppMsgStruct, TChannel>;

export const dashboardBus: MsgBus<any> = createMsgBus<any>();

// 5. Automatic registration of all API methods
export function setupApiAdapters(bus: MsgBus<any>) {
    const services: Record<DashboardChannelPrefix, any> = {
        'API.DASHBOARD.': new DashboardApiClient(),
    };

    const adapters = Object.entries(services).map(
        ([_, service]) =>
            ({
                service,
                channelSelector: getMsgChannelSelector(services),
            }) as MsgProviderAdapter,
    );

    registerAdapters(bus, adapters);
}
```

**Channel Name Resolution & Invocation Cheatsheet:**

| Service Method | Prefix | Resulting Bus Channel | Invocation Example |
|---|---|---|---|
| `getFullData()` | `'API.DASHBOARD.'` | `'API.DASHBOARD.GETFULLDATA'` | `bus.request({ channel: 'API.DASHBOARD.GETFULLDATA' })` |
| `searchKb(q, tag, type)` | `'API.DASHBOARD.'` | `'API.DASHBOARD.SEARCHKB'` | `bus.request({ channel: 'API.DASHBOARD.SEARCHKB', payload: [q, tag, type] })` |
| `listIssues(status, ...)` | `'API.DASHBOARD.'` | `'API.DASHBOARD.LISTISSUES'` | `bus.request({ channel: 'API.DASHBOARD.LISTISSUES', payload: ['open'] })` |
| `getIssue(id)` | `'API.DASHBOARD.'` | `'API.DASHBOARD.GETISSUE'` | `bus.request({ channel: 'API.DASHBOARD.GETISSUE', payload: ['iss-1'] })` |

**Important**: `ToMsgStruct` enforces type safety at compile time (wrong channel names will not compile), but `registerAdapters` registers ALL prototype/own methods at runtime (including skipped ones). The `Skip` parameter only affects the TypeScript type, not runtime registration.

`payloadFn` is the natural way to call adapted methods since payload types are tuples:

```typescript
msgBus.request({ channel: 'API.ORDER.CREATEORDER', payloadFn: (fn) => fn(items, priority) });
```

## Code Conventions

- TypeScript strict mode
- Vitest for tests
- Path alias `@/` → `src/`
- RxJS is internal only - never exposed in public API
- All public API is on the `MsgBus` interface returned by `createMsgBus<TStruct>(config?)`
- Generic type parameters: `TStruct` (bus structure), `TStructN` (normalized, Awaited), `TChannel`, `TGroup`, `THeaders`
- Payload types are resolved from the struct: `in` group → `InStruct<TStruct, TChannel>`, `out` group → `OutStruct<TStruct, TChannel>`
- `MsgStructNormalized<TStruct>` applies `Awaited<>` to all payload types (unwraps Promises)

## Testing

Tests are in `tests/msgBus.test.ts`. Test domain defined in `tests/testDomain.ts`:

```typescript
type TestBusStruct = {
    'Test.ComputeSum': { in: { a: number; b: number }; out: number };
    'Test.DoSomeWork': { in: string; out: void };
    'Test.TestTaskWithRepeat': { in: string; out: void };
    'Test.Multiplexer': { in1: string; in2: number; out: number };
};
```

`createTestMsgBus()` creates a fresh bus instance. `sharedMsgBus` is a shared instance used across tests.

Ignore `mocha.test.ts` - it's a legacy file, fails with "describe is not defined" (Mocha globals not available in vitest). Not related to the library.

## Change Policy

1. Prefer minimal diffs that preserve public API compatibility.
2. Do not expose RxJS types/operators in external API contracts.
3. Keep cancellation and timeout semantics backward-compatible.
4. Add/adjust tests in `tests/msgBus.test.ts` for any behavioral changes.
5. If changing typings, ensure tests and typecheck still pass.

## Validation Checklist

Before finishing any task, run:

1. `pnpm run typecheck`
2. `pnpm run test`

If change affects API shape or build artifacts, also run:

3. `pnpm run build`

## Common Pitfalls

- **`send()` uses `dispatch()` internally** but without callback - so it's effectively just a publish with `requestId` generation. The `out` subscription in `dispatch()` only activates when `request()` passes a callback.
- **Headers spread order in `provide()`**: `{ ...inMsg.headers, ...params.headers, inResponseToId }` - provider's static headers override incoming, but `inResponseToId` always wins.
- **`provide()` callback signature**: second parameter is `msgOut: Msg<TStruct, TChannel, "out">` - the pre-initialized outgoing message. Write `msgOut.status = 'skipped'` or `msgOut.status = 'canceled'` to control publish behavior. Cancel check is `msgIn.status === 'canceled'` (on the incoming message), not `msgOut.status`.
- **Message envelope is cloned per subscriber**: `subscribe()` calls `structuredClone` on the message envelope (everything except `payload`) before delivering to each callback. Mutations to `msg.status`, `msg.headers`, `msg.address` do not leak between subscribers. `payload` is the same reference for all.
- **Cancel message has no payload**: only `{ requestId, status: 'canceled' }` in headers. Provider must handle `msg.payload` being `undefined` for cancel messages.
- **`throwIfNoProvider`** in `request()` options and **`mandatoryProvider`** in channel config both cause immediate `NoProviderError` if no provider is subscribed at call time. They check `subject.observed` - a snapshot, not a delivery guarantee.
- **`dispatch()` subscribe-before-publish**: changing this order breaks request-response correlation.
- **`request()` abort after dispatch**: abort listener is attached after `await dispatch()`, not before. Immediate abort is handled by checking `abortSignal.aborted`.
- **`asyncScheduler` makes delivery async**: callbacks are never called synchronously within the same `publish()` call. Tests use `await delay()` to let the scheduler process messages.
- **Conflating `msg.id` with `headers.requestId`**: `msg.id` is transport ID (unique per publish), `requestId` is logical request ID (shared between request and its cancel message).
- **`stream()` timeout is inactivity timeout**, not total duration - resets on each received message. Same applies to `requestStream()`.
- **Provider exceptions propagate to `request()`**: `provide()` catch publishes to `out` with `status: 'error'` when `requestId` is present, so `request()` rejects immediately instead of timing out. Same for `requestStream()` - a provider error throws from the generator and stops iteration.
- **`requestStream()` subscribe-before-publish**: `requestId` is generated upfront so the `out` subscription filter can be set before publishing to `in`. Reversing this order would miss synchronous responses.
- **`requestStream()` vs `request()`**: `request()` uses `fetchCount: 1` on the subscription (takes first response only). `requestStream()` has no `fetchCount` on the subscription - all provider responses arrive; `fetchCount` in options controls how many the generator yields before stopping.

## Dynstruct UI Integration & Pure Event-Driven Architecture

When building applications with `@actdim/dynstruct` and `@actdim/msgmesh`:
- **MsgMesh is the Single Source of Truth for Cross-Component Events**:
  - Never pass callback props (`onSelect*`, `onNavigate*`, `onOpen*`, `onClose*`, `onChange*`) between Dynstruct components to coordinate state.
  - Classical React callback prop drilling causes dual sources of truth, timing races, and state desynchronization.
  - Dynstruct `actions` are internal model mutators (MobX transactions) for component-local state, NOT cross-component event props.
  - All feature-to-feature, cross-component, navigation, and domain state changes must flow through typed MsgMesh channels (`c.msgBus.send`, `msgBroker.subscribe`).
  - Modular channel structures can be defined in feature-specific files and intersected into the global `AppMsgStruct` (`AppMsgStruct = BaseAppMsgStruct & VfsMsgStruct & ...`).

## Project specifics

<!-- BEGIN ALONG-RULES -->
See the following engineering guidelines:
- `[languages/typescript.md](.along/rules/languages/typescript.md)`
- `[platforms/web.md](.along/rules/platforms/web.md)`
<!-- END ALONG-RULES -->
