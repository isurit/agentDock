# Implementation handoff — 2026-10-30

## Policy and scope

The user confirmed PC-local private storage and explicitly retained the existing external-transfer prohibition. Real provider code execution is therefore blocked. This overrides the original real Codex milestone for now; do not bypass it or claim Mock as real integration.

## Implemented

- Independent local Git repository, npm workspaces and pinned Node 22.22.2.
- React Dashboard and loopback Node HTTP/WebSocket service.
- Local project registration; Task create/rename; durable goal, lifecycle, run history and timeline.
- SQLite schema v1, event sequence replay and explicit interruption recovery.
- User-confirmed Project/Task Memory and deterministic local Mock handoff with original references.
- Mock run/stream/cancel; project-wide lock across Tasks.
- Local tracked/staged Git Diff and untracked names, with no source synchronization.
- Local numeric version probes for Codex/Claude/Gemini. Actual starts hard-denied at orchestrator and adapter boundaries.
- Origin/Host/session-token checks, authenticated WebSocket invalidation, production CSP.
- App data rejected inside Git repositories, including symlinked ancestors; runtime Git exclusions and privacy scan.
- Synthetic Kotlin/Git sample generator, macOS/Ubuntu CI definition, architecture/security/operations documentation.

## Verification evidence (local verification before first GitHub delivery)

| Area | Status |
|---|---|
| macOS clean lockfile install (`npm ci`) | Passed |
| TypeScript + production web build (`npm run build`) | Passed |
| Local unit/integration tests (`npm test`) | 8 passed |
| Product/runtime separation scan (`npm run privacy`) | Passed; manual personal-data review still required before Push |
| Browser Project -> Task -> Memory -> Mock twice -> Context | Passed using synthetic inputs |
| Browser local Git Diff | Passed with synthetic working-tree change |
| Browser reload and full server restart -> saved History | Passed |
| Production browser console error check | No errors observed during final restart check |
| Codex CLI installation | Local version 0.154.0 confirmed; model/OAuth execution not tested |
| Claude/Gemini installation | Executables absent from current server PATH |
| GitHub Actions macOS/Ubuntu | Workflow written, not run; no Push performed |
| Company Ubuntu | Not verified |
| Real provider analysis/editing and provider handoff | Blocked by confirmed policy, not implemented |
| Android Gradle build/run | Not attempted; sample is not a buildable Android app |

Tests cover persistence and Context isolation, Mock source non-modification, cancellation/project lock, interrupted-run recovery, hard-denied provider starts, cross-project Memory rejection, symlink escape, HTTP/WS authentication, event replay, Git-contained data rejection and staged/working/untracked snapshot behavior.

## Remaining work

- Browser smoke automation in CI, efficient large timeline pagination and retention/delete tooling.
- Backup/restore UI and automatic backup before future DB migrations.
- Artifacts, Approval persistence, Logcat ingestion, Gradle result linking and richer task templates.
- Hardened company pull-only update tooling. The current app has no Git push/fetch function, but does not restrict the user's independent terminal.
- Actual CLI adapters, provider Session resume, sandbox and browser approval integration only if the owner explicitly changes external-transfer policy.
- Company machine/backup/model policy and actual Ubuntu verification.

The owner authorized the first GitHub delivery after local verification. Only product code, documentation, lockfiles and synthetic samples are included; runtime data stays local. Git history identifies the delivered revision. The CI results in this table describe the pre-push verification point; inspect GitHub Actions for the delivered revision. No cloud app deployment or credential-store access was performed. Preview data and the synthetic Git fixture remained outside the product repository. The preview server was stopped after verification. New development should follow DECISIONS.md and AGENTS.md.
