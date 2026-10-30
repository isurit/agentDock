# Architecture

Browser (React/Vite) -> same-origin HTTP + authenticated WebSocket -> Node local server -> SQLite and registered local Git projects.

- apps/web: project and Task navigation, timeline, Memory, local Git Diff, runtime diagnostics.
- apps/server: HTTP/WS policy, schema migration and persistence, startup recovery, application lifecycle.
- packages/core: domain types, input schemas and adapter contracts.
- packages/orchestrator: explicit provider selection (Auto defaults to Mock), project execution lock, cancellation, context selection and persisted events.
- packages/agent-adapters: Mock, Codex App Server RPC and Claude/Gemini headless JSONL adapters with capability probing.
- packages/project: canonical registration paths, contained path resolution and read-only Git snapshot commands.

## Contracts

Project(id, name, canonicalPath) -> Task(id, projectId, title, goal, status).
AgentRun(id, taskId, agent, model, status, providerSessionId?, timestamps, error?).
AgentEvent(seq, taskId, runId?, type, data, createdAt).
MemoryEntry(id, projectId, taskId?, content, source=user, updatedAt).
Handoff(id, taskId, sourceRunId?, targetRunId, goal, applicable memories, recent results, createdAt).

Tasks start draft and enter running on an accepted start. Real runs require providerConsent; mode defaults to read-only. Codex approval callbacks temporarily set awaiting_approval. Runs finish completed, cancelled or failed. A later explicit run may start from a terminal Task. Queued is a reserved contract value without a scheduler yet. Startup marks interrupted runs failed and records an interruption event.

The server persists an event before broadcasting an invalidation notification. Clients fetch events with a numeric sequence cursor, paging until caught up. Reconnecting fetches the full local Task history. The DB is the authority; network notifications are not the record.

## Process and privacy boundaries

The service binds only to 127.0.0.1. Exact Host/Origin checking, a per-server random HTTP token, and authenticated WebSocket subprotocols reject browser cross-origin access. Tokens are held in browser memory. Same-PC trusted processes and the current OS user remain outside this browser protection boundary.

Git commands use execFile, no shell, no external diff/textconv, no fsmonitor for snapshots. No git fetch/push commands exist in the application. The backend will not read arbitrary file paths from the browser. Registered paths are canonicalized; a contained-path helper rejects symlink escape for future file readers.

Actual adapters require explicit provider consent. Codex uses app-server stdio, initialize, ephemeral thread/start and turn/start. Workspace sandbox and user/on-request reviewer settings are validated; unexpected security responses fail closed. Session IDs and actual model are stored, while each new run starts a fresh native session and receives a bounded Task handoff. Mock remains local-only and never edits files. Probes are not authentication/entitlement verification.

## Approval and process lifecycle

Server-initiated Codex command/file approvals are scoped to the active thread/turn and recorded as local events. An inline browser panel accepts once or declines via a token-authenticated endpoint; stale and cross-Task responses are rejected. Read-only requests, outside-root write grants and unsupported input RPCs are not silently granted. Restart fails interrupted runs and expires pending callbacks without replay.

Each provider process is owned by a run. JSONL output and RPC responses are bounded. Cancellation, failure and a 15-minute timeout terminate the owned POSIX process group, including descendants surviving the parent. Completion does not release the project lock until cleanup finishes. Prompts use stdin. CLI error categories are explicit and diagnostics remove common credential/account/path patterns.

Claude/Gemini use their documented headless flags and native noninteractive policies. Success requires a terminal result and successful process exit; stdout output alone is not completion. Browser approvals and equivalent OS confinement are not available for these adapters yet.

## Deliberate limits

No provider-native resume across runs, approval bridge for Claude/Gemini, parallel review, Gradle runner, Logcat ingestion or artifact manager has been implemented. Codex's OS sandbox is distinct from model/provider network access and inherited CLI plugins/configuration. Do not claim all three adapters provide identical sandbox isolation. Future schema changes require migration and backup; this update retains schema v1 and uses durable events for execution policy/approvals.

## v0.3 diagnostics and Git Context

Headless execution now tracks input/session/model-wait/response/tool/result phases, bounded generic stderr categories and transport byte counts. The frontend shows elapsed time and refreshes active runs periodically; refresh requests are serialized/coalesced so streaming invalidations cannot continuously invalidate an in-flight render. Partial messages are combined per run/item without changing persisted evidence.

The default meaningful-event idle limit is 180 seconds (environment override 30–900), separate from the 15-minute total limit. Transport stderr alone does not reset semantic progress. A declared terminal result followed by lingering process handles emits cli.cleanup, preserves declared success/error and terminates the owned process group after a short grace period. A nonzero exit before that remains failure. These mechanisms do not diagnose the actual company's Gemini issue by themselves.

GET /api/projects/:id/history reads current HEAD's latest 10 hashes/subjects locally. Optional includeGitHistory on a run collects the same bounded data into Handoff before adapter execution; consent and provider selection stay unchanged. Context attachment failure is explicit git_history_unavailable, never invented history. This is not provider shell approval, full commit diff analysis or a Git fetch.

Doctor probes generic environment/capability information without source or credentials. Opt-in headless smoke exercises a disposable synthetic project and local Task orchestration; it is not part of CI. See COMPANY_START and KNOWN_ISSUES for continuation.
