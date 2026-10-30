# Requirements and current scope

The full original specification is PROJECT_HANDOFF.md. DECISIONS.md records later user constraints.

Current scope: local-first Project/Task Dashboard; durable Task History, runs and user-confirmed Memory; Mock and actual CLI lifecycle with explicit provider consent and Task Context handoff; read-only Git status/diff; local CLI version diagnostics; macOS/Ubuntu test workflow; private data outside Git.

Security acceptance: selected approved CLI providers only after per-run consent; no company/private data to personal GitHub or home PC; same-origin authenticated HTTP/WS; project execution lock; explicit interruption recovery; runtime-file Git exclusions.

Codex real synthetic analysis/editing is verified on macOS. Claude/Gemini runtime code is implemented but requires live company validation. Task Context supports changing providers; native Session resume across runs is deferred. Mock is not evidence of real execution.

Deferred product work: richer task templates, persisted approvals/artifacts, Logcat, Gradle result links, backup automation, retention UI, isolated parallel reviews and advanced routing.
