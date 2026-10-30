# Implementation handoff — v0.2.0

## Current authorization

The user clarified and authorized company-approved Enterprise OAuth CLI execution. Task-relevant code, filenames, paths, imports, diffs and applicable context may go to the selected CLI provider. This supersedes v0.1's blanket provider-transfer prohibition for the approved workflow. Company source, private runtime data and credentials must never go to personal GitHub or the home PC. Storage remains PC-local and outside Git.

## Implemented

- Existing Project/Task/History/Memory/Git Dashboard preserved, using the same SQLite schema v1. No data migration/deletion required.
- Explicit actual Codex/Claude/Gemini selection when installed CLI options probe compatible; read-only default, per-run provider consent and optional model/current instruction. Auto stays Mock.
- Codex App Server stdio: validated sandbox/user approval configuration, ephemeral thread, streamed responses, actual session/model persistence, commands/files events, one-time browser approval decisions and explicit error categories.
- Claude/Gemini headless JSONL adapters: stdin prompts, native plan/edit policies, terminal success validation, permission failures, local session metadata. No bypass flags or browser approval bridge.
- Goal, applicable user Memory, recent results and previous/current instructions handed off between runs/providers; raw History and context snapshots remain local.
- Project execution lock, output/run time limits, process-group/descendant termination on handled cancellation/failure/completion, approval expiration and no automatic retry after restart.
- Product/runtime Git privacy checks preserved; known shell API keys omitted from child environments; credentials remain CLI-managed.

## Verification

| Area | Evidence/status |
|---|---|
| v0.1 macOS + Ubuntu CI | Passed for delivery 103bbf4 |
| v0.1 company Ubuntu | User confirmed server/UI, Project/Task/Mock/Git Diff and restart persistence |
| v0.2 TypeScript + production build | Passed locally |
| v0.2 offline unit/integration tests | 14 passed locally, no model account needed |
| Codex 0.154.0 macOS real provider | Actual synthetic read-only read and workspace-write file change passed; existing CLI login, model selected explicitly from catalog |
| Codex actual local Git Diff | Synthetic changed-file check included in opt-in live smoke |
| v0.1 DB opened with v0.2 | Existing Project/Task/History restored in browser |
| v0.2 browser provider selection | Codex enabled; absent Claude/Gemini disabled; consent required before real execution |
| Claude/Gemini live Enterprise execution | Not verified at home; executables absent |
| Company Ubuntu real CLI execution | Not yet verified; follow UBUNTU_VALIDATION.md |
| v0.2 GitHub CI | Not yet run at this local verification point |

Tests include storage/restoration, memory/project isolation, Mock non-modification, real-run consent, Codex security contract/model catalog, stdin/context correctness, headless terminal success/failure, one-time/stale/cross-Task approval decisions, cancellation of pending approval, process-group cleanup including a child ignoring SIGTERM, provider Session persistence and Task context across adapter selection. Fixtures are synthetic local processes, not real model evidence.

## Limits and next work

- Claude/Gemini require actual CLI/version/OAuth validation in the approved company environment. Their native permissions and isolation differ from Codex.
- Codex's initial configured model was rejected by the account; an explicit CLI catalog selection succeeded. No runtime hardcoded model or silent fallback is introduced.
- No native session resume across runs, parallel review/worktrees, Logcat, Gradle artifact manager, retention/delete UI or automatic migration backup.
- In-sandbox Codex commands do not all require prompts; workspace-write run consent authorizes them. Extra permissions use the inline bridge; read-only escalation and out-of-project write grants are refused.
- Provider quota remains Unknown. Enterprise entitlement is not inferred from probes.
- Abrupt OS/server SIGKILL may prevent controlled process cleanup. Restart records interrupted execution and expires approvals without auto-retrying; inspect uncertain CLI work before manually starting another run. No unsafe PID-based orphan killing is attempted.
- AgentDock has no company-to-home or personal GitHub sync feature. Native CLI configuration/hooks remain subject to company policy; this app is not an outbound OS firewall.

Public deliveries include only generic source/docs/lockfiles/synthetic fixtures. Live source, diagnostic payloads, prompts, runtime paths, account metadata and DBs stay local. See DECISIONS.md, SECURITY.md and CLI_COMPATIBILITY.md for the current rules.
