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
- Confirm all real CLI run requests are denied even if a CLI is installed.
- Verify no runtime files appear in git status and no app action invokes fetch/push or provider execution.
- Record only general result categories; do not send company paths, filenames, prompts, code, logs or raw imports to the home PC or GitHub.

macOS tests and GitHub Ubuntu CI do not constitute company-environment validation.
