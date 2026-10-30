# Architecture

Browser (React/Vite) -> same-origin HTTP + authenticated WebSocket -> Node local server -> SQLite and registered local Git projects.

- apps/web: project and Task navigation, timeline, Memory, local Git Diff, runtime diagnostics.
- apps/server: HTTP/WS policy, schema migration and persistence, startup recovery, application lifecycle.
- packages/core: domain types, input schemas and adapter contracts.
- packages/orchestrator: deterministic local-only routing, project execution lock, cancellation, context selection and persisted events.
- packages/agent-adapters: Mock and hard-blocked provider adapters with local version probing.
- packages/project: canonical registration paths, contained path resolution and read-only Git snapshot commands.

## Contracts

Project(id, name, canonicalPath) -> Task(id, projectId, title, goal, status).
AgentRun(id, taskId, agent, model, status, providerSessionId?, timestamps, error?).
AgentEvent(seq, taskId, runId?, type, data, createdAt).
MemoryEntry(id, projectId, taskId?, content, source=user, updatedAt).
Handoff(id, taskId, sourceRunId?, targetRunId, goal, applicable memories, recent results, createdAt).

Tasks start draft and enter running on an accepted Mock start. Runs finish completed, cancelled or failed. A later explicit run may start from a terminal Task. Queued and awaiting_approval are reserved contract values with no active workflow yet. Startup marks interrupted runs failed and records an interruption event.

The server persists an event before broadcasting an invalidation notification. Clients fetch events with a numeric sequence cursor, paging until caught up. Reconnecting fetches the full local Task history. The DB is the authority; network notifications are not the record.

## Process and privacy boundaries

The service binds only to 127.0.0.1. Exact Host/Origin checking, a per-server random HTTP token, and authenticated WebSocket subprotocols reject browser cross-origin access. Tokens are held in browser memory. Same-PC trusted processes and the current OS user remain outside this browser protection boundary.

Git commands use execFile, no shell, no external diff/textconv, no fsmonitor for snapshots. No git fetch/push commands exist in the application. The backend will not read arbitrary file paths from the browser. Registered paths are canonicalized; a contained-path helper rejects symlink escape for future file readers.

Actual CLI start paths always throw external_transfer_forbidden, even when directly invoked. Mock is local-only and never edits files. Version probes are local processes, not authentication or model-access verification.

## Deliberate limits

No real provider Session, approval RPC bridge, model execution, file writer, semantic memory summarizer, parallel review, Gradle runner, Logcat ingestion, artifact manager or OS sandbox has been implemented. The source tree and SQLite are separate; DB schema changes must add a versioned migration and backup procedure before deployment.
