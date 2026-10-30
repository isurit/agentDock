# Decisions

## Confirmed user decisions — 2026-10-30

1. Private information is stored only on each PC. No personal information goes to GitHub.
2. The user clarified that existing company-approved Enterprise OAuth CLIs already analyze/edit local source, and explicitly authorized the same workflow in AgentDock. This replaces the earlier blanket provider-transfer ban for this approved workflow only.
3. Task-relevant source, filenames, relative paths, imports, diffs and applicable Memory/History may go to the user-selected approved CLI provider. Company policy remains authoritative. This is separate from GitHub publication.
4. Company source, private data, prompts, logs, DBs and runtime records must never go to personal GitHub or the home PC. Distribution remains home macOS -> product GitHub -> company Ubuntu.
5. Existing CLI OAuth stays with the current OS account. AgentDock does not collect credentials or introduce API billing. Enterprise entitlement is not inferred from a version probe.

## Engineering decisions

- Independent repository within the existing checkout, no edits to the parent product. No remote or push configured automatically.
- npm workspaces, TypeScript, React/Vite, Express, ws, Zod and SQLite. Pin Node 22.22.2; commit package-lock.json. Node's built-in SQLite avoids platform native-addon installation, but remains experimental in Node 22. Upgrade and migration compatibility need explicit testing.
- Task owns History, runs, local Handoffs and user-confirmed Memory. Provider session ID is nullable and never synthesized for Mock.
- REST is authoritative. WebSocket sends authenticated invalidation notifications only. UI replays persisted events by sequence; no private events are placed in URLs.
- One active run per project, covering separate Tasks. Each real run requires explicit provider consent and a mode. Read-only is the default. Selecting workspace-write authorizes project edits under the native CLI policy.
- Codex uses app-server stdio with native sandbox, on-request/user approvals and ephemeral threads. Claude/Gemini use headless JSONL and native plan/edit policies. Capability probes check supported flags; they do not prove authentication, entitlement or full version compatibility. Quotas remain Unknown.
- SQLite schema version 1, foreign keys and WAL. On startup unfinished runs become failed with interrupted_by_restart; no automatic retry.
- Context handoff uses the goal, current instruction, applicable user Memory, recent messages/user instructions and source run references. Prompt context is bounded; raw history and handoff snapshots remain local. This is deterministic context selection, not an LLM-generated summary. Raw event history stays available locally.
- No modal is required by the first UI: registration, editing and Memory use inline forms.
- Data lives outside Git repositories. No automatic retention/deletion. Manual backup while the app is stopped. Do not put data in cloud-synchronized folders.

## Deferred decisions

- Company Node/CLI versions, allowed accounts/models and GitHub access policies: company validation.
- Product GitHub is public. First delivery 103bbf4 passed macOS/Ubuntu CI; never include runtime records.
- Retention, at-rest encryption, OS backup exclusion and company machine permissions: agree with local policy before company use.
- Codex workspace-write permits in-sandbox edits/commands after run consent; native escalation requests appear inline and accept only once or decline. Read-only escalations and grants outside the project fail closed. This is not a prompt for every sandboxed command.
- Claude/Gemini headless approval bridging and OS-level isolation beyond native policies remain future work. Do not use yolo/bypass flags to make an unsupported request succeed.

## CLI compatibility and lifecycle

- Codex wire contract was generated locally from 0.154.0 and checked against official App Server docs. Thread security response must match requested sandbox and user/on-request approvals; mismatch fails before the turn. Turn-level writes are limited to the project and command network access is disabled by default.
- Real sample read/edit passed with the model explicitly selected from the CLI catalog. A configured default model was rejected by the account: model_unavailable remains explicit; no silent provider/model substitution.
- Claude runs with Read/Glob/Grep (plus Edit/Write in edit mode), plan/acceptEdits, and an empty strict MCP configuration. Shell tools are excluded in this first adapter. Gemini uses plan/auto_edit. Existing company settings/hooks can still matter; company validation is mandatory.
- Prompts go through stdio, not shell strings or process arguments. Known API-key environment variables are omitted to avoid accidental shell-key billing; managed CLI config still determines authentication.
- 15-minute run timeout; cancellation interrupts Codex when possible, then terminates the owned POSIX process group and surviving descendants. No process or approval waiter may survive completion. Unknown server input requests fail explicitly instead of hanging or auto-approving.
- Approval requests/decisions are durable events. Pending callbacks are live-process state, not resumable after restart. Interrupted runs fail, pending UI is cleared, and nothing auto-retries.
