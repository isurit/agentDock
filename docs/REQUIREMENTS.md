# Requirements and current scope

The full original specification is PROJECT_HANDOFF.md. DECISIONS.md records later user constraints.

Current scope: local-first Project/Task Dashboard; durable Task History, runs and user-confirmed Memory; Mock lifecycle and local Context handoff; read-only Git status/diff; local CLI version diagnostics; macOS/Ubuntu test workflow; private data outside Git.

Security acceptance: no provider model calls or outbound data routes; actual CLI starts hard-denied; same-origin authenticated HTTP/WS; project execution lock; explicit interruption recovery; runtime-file Git exclusions.

Deferred by explicit privacy policy: real Codex analysis/editing, actual Claude/Gemini execution, provider session resume, provider-to-provider Context handoff. Their original acceptance criteria are not fulfilled by Mock.

Deferred product work: richer task templates, persisted approvals/artifacts, Logcat, Gradle result links, backup automation, retention UI, isolated parallel reviews and advanced routing.
