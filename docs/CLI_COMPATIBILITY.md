# CLI adapter compatibility

Use the same approved Enterprise account, OS user and PATH as the working terminal CLIs. AgentDock never copies credentials. A version/help probe is not an Enterprise, OAuth or model-entitlement check.

| Provider | Transport | Modes | Verification |
|---|---|---|---|
| Codex | app-server stdio JSON-RPC | readOnly / workspaceWrite; on-request/user approvals | Actual synthetic read/edit verified on macOS, CLI 0.154.0 |
| Claude | --print --output-format stream-json --verbose | plan / acceptEdits; built-in Read/Glob/Grep, plus Edit/Write; strict empty MCP config | Synthetic protocol tests passed; installed CLI and Enterprise OAuth not available at home |
| Gemini | --prompt with stdin, --output-format stream-json | plan / auto_edit | Synthetic protocol tests passed; installed CLI and Enterprise OAuth not available at home |

Model IDs are not hardcoded in the runtime. Codex offers its model/list suggestions; any provider can use an explicit model ID or the CLI default. Account rejection is a run error, never a silent fallback. A rejected configured default model was observed during live validation; explicit selection from the CLI catalog succeeded.

Codex uses ephemeral threads per run, recording the session ID and actual model locally. Subsequent runs/providers receive a bounded Task handoff rather than pretending to share a native session. Native session resume is not implemented.

Claude/Gemini headless permissions cannot be interactively approved in the Dashboard yet. Permission denials or a missing terminal result fail the run. Do not enable yolo, bypass-permissions, full-access or separate API-key billing to hide these limitations. Native plan/edit policies and inherited company settings are not an app-enforced OS sandbox equivalent to Codex. Inherited hooks, tools and provider configuration need company review.

Codex RPC schema was generated locally with the installed CLI; generated catalogs, live logs, account metadata and runtime paths are not committed. The opt-in live verification creates and deletes a synthetic temporary project and never runs in CI. Automated CI uses local synthetic CLI processes and no provider login.

References:
- https://learn.chatgpt.com/docs/app-server
- https://code.claude.com/docs/en/headless
- https://code.claude.com/docs/en/cli-reference
- https://geminicli.com/docs/cli/headless/
- https://geminicli.com/docs/cli/cli-reference/

## Company report and v0.3 diagnostic support

The user reports Gemini 0.66.0 creating a session but not producing an answer for a Git-history question. The actual company cause, elapsed duration and backend/model response were not established. The v0.66.0 upstream nonInteractiveCli source was inspected to distinguish init, user, assistant/tool and result events; this is source inspection, not a live Enterprise reproduction.

Headless now exposes these phases, generic stderr/error categories, bounded idle/total timeouts and result-followed-by-lingering-process cleanup. Warnings remain nonfatal; permission failures remain explicit. Native plan/auto_edit settings are unchanged. Optional locally collected Git hashes/subjects can be attached without allowing CLI shell tools.

Use npm run doctor, then npm run verify:headless -- --live --provider gemini on the company PC. See KNOWN_ISSUES and COMPANY_START for the precise reproduction matrix. Do not describe the adapter as fully company-verified until those live checks pass.
