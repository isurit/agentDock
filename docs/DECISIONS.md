# Decisions

## Confirmed user decisions — 2026-10-30

1. Private information is stored only on each PC. No personal information goes to GitHub.
2. The existing external-transfer prohibition is retained (explicit follow-up answer). Local filenames, extensions, paths, directories and raw imports cannot be transmitted to providers.
3. Accordingly actual provider-backed code analysis, editing and provider-to-provider handoff are blocked. This supersedes the original handoff's real Codex acceptance criterion for the current implementation. No consent toggle or environment bypass exists.
4. Distribution remains home macOS -> personal GitHub -> company Ubuntu. Runtime data is never distributed.

## Engineering decisions

- Independent repository within the existing checkout, no edits to the parent product. No remote or push configured automatically.
- npm workspaces, TypeScript, React/Vite, Express, ws, Zod and SQLite. Pin Node 22.22.2; commit package-lock.json. Node's built-in SQLite avoids platform native-addon installation, but remains experimental in Node 22. Upgrade and migration compatibility need explicit testing.
- Task owns History, runs, local Handoffs and user-confirmed Memory. Provider session ID is nullable and never synthesized for Mock.
- REST is authoritative. WebSocket sends authenticated invalidation notifications only. UI replays persisted events by sequence; no private events are placed in URLs.
- One active run per project, covering separate Tasks. Mock only; future real writers require sandbox and approval integration.
- CLI adapters implement local numeric version probes and a hard-denied start method. They are not functional real runtimes. Quotas remain Unknown.
- SQLite schema version 1, foreign keys and WAL. On startup unfinished runs become failed with interrupted_by_restart; no automatic retry.
- Context handoff uses the goal, applicable user Memory, recent terminal messages and source run references. This is deterministic context selection, not an LLM-generated summary. Raw event history stays available locally.
- No modal is required by the first UI: registration, editing and Memory use inline forms.
- Data lives outside Git repositories. No automatic retention/deletion. Manual backup while the app is stopped. Do not put data in cloud-synchronized folders.

## Deferred decisions

- Company Node/CLI versions, allowed accounts/models and GitHub access policies: company validation.
- GitHub visibility: owner verification before first push.
- Retention, at-rest encryption, OS backup exclusion and company machine permissions: agree with local policy before company use.
- Future default for write approval: recommend read-only initial mode, explicit write-run consent and separate dangerous-command consent. No write runtime exists now.
- Real CLI implementation can resume only after an explicit policy change. app-server is the preferred Codex integration candidate, but is not implemented or live-verified.
