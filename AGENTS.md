# AgentDock development rules

Read docs/PROJECT_HANDOFF.md and docs/DECISIONS.md before changes.
The original handoff is historical; later user decisions recorded in DECISIONS take precedence.

## Local-only privacy (confirmed 2026-10-30)
- Personal information, registered project paths, Tasks, Session metadata, History, Memory, prompts, logs, diffs and artifacts stay on the current PC, outside Git repositories.
- Never transmit local filenames, extensions, paths, directory names, import source names or raw import lines to external APIs, models, agents or telemetry.
- Real Codex/Claude/Gemini analysis and modification are blocked. Version probes only are permitted. Do not add a hidden environment switch to bypass this policy.
- GitHub receives only generic product source, documentation, lockfiles and synthetic samples. No runtime DB, logs, credentials or company source. Never copy credentials across accounts.
- No automatic Git push, company feedback upload, telemetry, remote enrichment or cloud hosting.
- Home macOS -> personal GitHub -> company Ubuntu is the only distribution direction. Company changes remain local; general issues are reproduced at home without company data.

## Implementation
- Task is authoritative; provider sessions are separate optional execution records.
- Router, adapter, context, storage, project and UI responsibilities stay separate.
- One active run per registered project. No parallel writers until isolation exists.
- Execute local tools with argument arrays, shell disabled. Do not read CLI credential stores.
- Listen on 127.0.0.1 only. Validate Host, Origin, HTTP token and WebSocket handshake.
- All Mock results must identify simulation. Never claim real analysis, file changes or tests from Mock output.
- Unknown quotas and unverified capabilities remain explicit.
- Persist events before broadcasting. Recover interrupted runs explicitly; never silently rerun them.
- Keep popups inline where possible. Any future popup must satisfy the inherited Back/Escape contract.

## Verification
Run npm test, npm run build and npm run privacy before handoff. Document implementation, macOS verification, Ubuntu CI and company verification separately. A workflow definition does not mean CI passed.
Do not commit or push unless requested. Do not modify the parent Dashboard repository.
