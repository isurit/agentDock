# AgentDock

A local Task workspace for Android development. Tasks, History and user-confirmed Memory live on the current PC. Android Studio remains responsible for build, run and debugging.

**Current policy: local-only. Actual Codex, Claude and Gemini execution is blocked.** Installed CLI versions can be checked locally. Mock runs are explicitly simulated; they do not analyze or modify source. The original goal of actual Codex editing remains deferred because the user retained the prohibition on sending local filenames, paths and source context to providers.

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

## Private state

Defaults:
- macOS: the current user's Library/Application Support/AgentDock directory.
- Linux: the current user's .local/share/agentdock directory.

`AGENTDOCK_DATA_DIR` may select an absolute local directory outside Git repositories. It must not be a synchronized/cloud folder. SQLite, WAL files and future artifacts belong there, never in the product checkout. Browser state uses memory only, with no persisted project data in localStorage. The UI contains no remote fonts, assets or analytics. Installed CLI probes run only `--version`; they do not inspect credentials.

The app does not push anything to GitHub. `.gitignore` and `npm run privacy` help detect accidental tracking of known private file types; they cannot classify arbitrary prose as personal information. Review the staged diff before every authorized push.

## Distribution

Develop at home on macOS. Push generic product changes from home only after review. On company Ubuntu use clone/fetch/pull only, then `npm ci` and the validation checklist. Do not synchronize the app-data directory or company source. Keep company changes local; manually report only policy-permitted generic reproduction steps.

See docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/ROADMAP.md, docs/SECURITY.md, docs/HANDOFF.md and docs/UBUNTU_VALIDATION.md.
