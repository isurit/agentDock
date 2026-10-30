# AgentDock development rules

Start with README.md, then docs/COMPANY_START.md and docs/DECISIONS.md. Read docs/PROJECT_HANDOFF.md for the full original product requirements.
The original handoff is historical; later user decisions recorded in DECISIONS take precedence.

## Approved provider execution and local private storage (confirmed 2026-10-30)
- The user's latest explicit clarification supersedes the earlier blanket external-transfer prohibition for AgentDock's approved CLI workflow.
- Work-relevant source, filenames, relative paths, imports, diffs and selected Task context may be sent to the provider chosen by the user through the existing, company-approved Enterprise CLI on that PC.
- Company policy and managed CLI restrictions still apply. AgentDock cannot verify Enterprise entitlement from a version probe.
- Personal information, registered project paths, Tasks, Session metadata, History, Memory, prompts, logs, diffs and artifacts are persisted only on the current PC, outside Git repositories. No remote telemetry or home synchronization.
- GitHub receives only generic product source, documentation, lockfiles and synthetic samples. Never upload company source, runtime records or credentials, or send them to the home PC.
- Use the current OS account's existing CLI OAuth. Never read, collect or copy credential stores. Do not require separate API keys or add paid API fallbacks.
- No automatic Git push, company feedback upload, remote enrichment or cloud hosting.
- Home macOS -> personal GitHub -> company Ubuntu remains the only distribution direction. Company feedback must be generic and permitted by company policy.

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

## Company continuation
- The owner requested development continuation using company-approved CLI tokens. Product development on the company PC is allowed locally; this does not authorize company-to-personal-GitHub Push or source/log transfer to the home PC.
- Create a local development branch if needed. Company fixes and runtime evidence remain on the company machine until a separate policy-compliant publication instruction exists.
- Begin with the known Gemini 0.66.0 session-initialized/no-response issue in docs/KNOWN_ISSUES.md. Its actual company root cause is not established. Do not call a synthetic fixture a reproduced Enterprise service failure.
- Never disable managed policies, read credentials, add yolo/bypass flags or silently switch provider/model to make a test pass.
- Record verified behavior, synthetic verification and remaining company checks separately. Use doctor and opt-in synthetic live smokes; do not commit their outputs or company runtime files.
- Update README, WORK_LOG, KNOWN_ISSUES and HANDOFF after substantive changes; README must remain the next agent's entry point.
