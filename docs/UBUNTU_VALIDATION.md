# Company Ubuntu validation

Use only company-approved sources and synthetic inputs until local policy permits real projects.

- Confirm personal GitHub clone/fetch/pull and npm installation are allowed. No company Push.
- Install the pinned Node version; run npm ci (never copy macOS node_modules).
- Run npm test, npm run build and npm run privacy.
- Launch npm start and open the exact 127.0.0.1 URL locally.
- Confirm runtime data is outside all Git and synchronized folders, with approved permissions/backups.
- Register a policy-approved local test project; create Task, add Project/Task Memory, run Mock twice and inspect local Handoff.
- Cancel a run; restart server and confirm history persists. Interrupted runs must not silently retry.
- Check tracked/staged/untracked Git display without network calls.
- Start the server under the same OS account and PATH as the Enterprise CLI logins. Confirm actual CLI version/help capability indicators.
- Begin with a synthetic project. Choose one approved provider, read-only mode and an allowed model. Give explicit per-run provider consent.
- Confirm actual streamed messages, session/model recording and retained context after changing providers.
- For Codex, verify one small synthetic edit with workspace-write, then inspect local Git Diff. Verify inline additional-permission accept/decline and cancellation while awaiting approval.
- Claude/Gemini: record version and actual OAuth behavior. Their headless native permissions are not identical to Codex; unsupported permissions must fail instead of bypassing them.
- Confirm run cancellation kills spawned work; failed authentication/model/quota errors remain explicit; no silent fallback.
- Only after company policy approval and synthetic success, repeat a small code task in the company project. Keep all evidence local.
- Verify no runtime files appear in git status and no app action invokes fetch/push or unrelated provider execution.
- Record only general result categories; do not send company paths, filenames, prompts, code, logs or raw imports to the home PC or GitHub.

macOS tests and GitHub Ubuntu CI do not constitute company-environment validation.
