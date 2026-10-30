# AgentDock

A local Task workspace for Android development. Tasks, History and user-confirmed Memory live on the current PC. Android Studio remains responsible for build, run and debugging.

**Approved Enterprise CLI execution is enabled.** Work-relevant source and context may be sent through the provider selected by the user using the existing CLI login on that PC. Company code, private information, DBs, prompts and logs never belong in personal GitHub or on the home PC. Mock remains a clearly labeled simulation.

Codex App Server has been live-tested on a disposable synthetic project on macOS. Claude/Gemini adapters are implemented with synthetic protocol tests but need actual company installation/OAuth validation.

## Run

Use Node 22.22.2 (see .nvmrc) and npm 10 or later.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4317 (use this exact loopback address).
Run `npm run sample` to create a disposable synthetic Kotlin/Git fixture, or register a policy-approved local project directory. Create a Task, add Memory, then run Mock. Run it again to inspect local Context handoff. The Git Diff tab reads tracked working-tree and staged diffs locally; untracked file contents are not read.

```sh
npm test
npm run build
npm run privacy
npm start
```

`npm start` serves the built Dashboard. Build first. Set `PORT` if needed. No Docker, external database, API key or OAuth login is required for the local workflow.

## Actual agents

Run the Dashboard under the same OS account and PATH as the working Enterprise CLIs. Select a Task and choose codex, claude or gemini. Installed compatible CLIs become selectable. Start with read-only analysis, choose an allowed model (or native default), and acknowledge provider transmission for that run. To edit, explicitly select project modification permission. The optional current instruction is stored with the run and handed to the next execution with applicable Memory and recent results. Auto defaults to Mock and never silently chooses a provider.

Codex additional permission requests appear inline for one-time accept/decline. In workspace-write mode, ordinary sandboxed project edits and commands do not prompt individually. Read-only escalation and out-of-project write grants are denied. Claude/Gemini have no browser approval bridge yet: unsupported noninteractive permissions fail rather than bypassing controls. Claude's first adapter excludes shell/MCP tools; Gemini uses native plan/auto_edit. Check the actual CLI and company settings before real source use.

Codex model suggestions come from model/list. A catalog is not proof of entitlement: if the account rejects its configured default, select an allowed model explicitly. There is no automatic fallback. CLI errors and the actual session/model appear in History. CLI quota remains Unknown.

Optional live verification, using only a disposable synthetic project and your existing login:

```sh
npm run verify:codex -- --live --list-models
npm run verify:codex -- --live --model YOUR_ALLOWED_MODEL
```

The live check sends synthetic source to the selected provider and edits only its temporary fixture. It does not run in CI or grant elevated approvals automatically.

## Private state

Defaults:
- macOS: the current user's Library/Application Support/AgentDock directory.
- Linux: the current user's .local/share/agentdock directory.

`AGENTDOCK_DATA_DIR` may select an absolute local directory outside Git repositories. It must not be a synchronized/cloud folder. SQLite, WAL files and future artifacts belong there, never in the product checkout. Browser state uses memory only, with no persisted project data in localStorage. The UI contains no remote fonts, assets or analytics. Real CLI runs communicate with their configured provider; their managed settings and company policies still apply. CLI probes run version/help, and Codex model listing uses its official protocol. They do not inspect credential stores.

The app does not push anything to GitHub. `.gitignore` and `npm run privacy` help detect accidental tracking of known private file types; they cannot classify arbitrary prose as personal information. Review the staged diff before every authorized push.

## Distribution

Develop at home on macOS. Push generic product changes from home only after review. On company Ubuntu use clone/fetch/pull only, then `npm ci` and the validation checklist. Do not synchronize the app-data directory or company source. Keep company changes local; manually report only policy-permitted generic reproduction steps.

See docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/ROADMAP.md, docs/SECURITY.md, docs/HANDOFF.md and docs/UBUNTU_VALIDATION.md.
