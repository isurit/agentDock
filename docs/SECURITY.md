# Security and privacy

Approved Enterprise CLI providers may receive the work-relevant source and selected Task context after explicit per-run consent. Company source and private runtime information must not be uploaded to personal GitHub or the home PC. No telemetry, remote fonts, model SDK calls, Git push/fetch or credential-reading endpoints exist.

## Storage

Persist Tasks, History, Memory, project paths and runtime metadata only in the current user's app-data directory outside Git. The initial DB uses SQLite WAL and restrictive creation permissions. This is not encryption: the OS user, administrators, malware and configured backup/sync software can read data. Do not use shared or synchronized data directories. Check company disk encryption, backup and retention policies before use.

No automatic delete/retention is implemented. To back up, stop the server cleanly and copy the entire app-data folder to an approved local destination. Restore only while stopped. To roll back code, restore a compatible backup too; a future schema version is rejected by older code. Initial creation is schema migration 1; automatic pre-migration backup is not yet implemented.

## Browser

Only 127.0.0.1 is supported. Requests require the exact host; explicit foreign Origins and cross-site fetches are rejected. Private APIs require a random per-server token. WebSocket requires exact Origin/Host plus the same token in a subprotocol handshake. No CORS wildcard. No remote access mode.

Trusted local software can obtain the token; this is protection against hostile browser origins, not against compromised local accounts. Development Vite is for local development only. Do not expose this port via reverse proxy or port forwarding.

## Execution and Git

Auto remains Mock. Explicit real selections use the existing CLI login and never collect credentials. Probes use version/help; Codex can list models through its protocol. No API-key fallback is implemented. Read-only Git status/diff commands disable external diff/textconv and fsmonitor hooks. Output size and timeout limits fail closed with a generic local error. Untracked file contents are not collected. Project registration does not copy or synchronize source.

The app never pushes. Product .gitignore and privacy checks reject known runtime/credential file patterns. They are defense in depth: review staged content before every explicitly authorized push. Arbitrary text can contain personal data that a filename check cannot detect.

Company mode is an operational policy today; a hardened pull-only updater and outbound OS firewall are not implemented. Company users should not configure Push credentials for the personal product remote.

## Real execution boundaries

The default mode is read-only. Per-run workspace-write consent permits native in-project editing. Codex runs with an OS sandbox, user/on-request approvals and turn-level command network disabled. Ordinary in-sandbox commands can run without individual prompts; escalation requests are shown inline. Read-only escalation, outside-project write grants and unsupported interactive RPCs fail closed. Approvals are one-time, scoped and expire when the process ends. A restart never resumes uncertain execution.

Claude/Gemini use plan or native edit policies without a browser approval bridge. Claude's built-in shell tools and MCP tools are excluded by this adapter; existing CLI hooks/settings may still execute. Gemini auto_edit does not imply every command is approved; unavailable headless permissions fail. These adapters do not provide a verified OS sandbox boundary equivalent to Codex on Ubuntu. Do not bypass them with yolo/full-access flags. They need company validation before relying on their restrictions.

AgentDock has no personal GitHub upload/sync/telemetry route. A selected CLI has its own tools/settings, so the prompt prohibits push/publish and unrelated exfiltration, but this is not an outbound OS firewall. Trust only company-approved CLI configuration, projects and provider endpoints. Managed settings can affect tool, hook, authentication and model behavior; a numeric version does not prove Enterprise entitlement. Browser sessions and company runtime data must stay on that PC.

Run processes have output/time limits and owned process-group termination. Known API-key environment variables are omitted to prefer existing OAuth; configured CLI helpers/provider settings still require company review. Sensitive raw stderr is not persisted; provider diagnostics are bounded/redacted. Never upload runtime evidence or logs to public CI.

## v0.3 observability and continuation

Generic stderr categories and byte counters may be persisted; raw stderr is not emitted into doctor/UI events. Known successful cached-credential notices are not authentication-failure evidence. No diagnostic report or live-smoke output is uploaded automatically. The opt-in smoke sends only its generated synthetic context to the user-selected provider through existing CLI authentication.

Optional Git context contains recent hashes/subjects, not author emails, bodies or arbitrary shell input. Subjects can still be sensitive or hostile: attachment requires explicit user selection/consent and company policy; prompt text treats them as untrusted data. Local viewing does not itself authorize provider transmission.

Timeout defaults can interrupt a legitimate long silent operation; inspect local state before retrying. A valid terminal result may require forced cleanup of lingering handles, which is recorded explicitly. Abrupt host failure/SIGKILL remains outside guaranteed controlled cleanup. No uncertain execution is automatically resent.

Company-token product development remains local; it is not authorization to push company changes/data to the public personal repository. Preserve existing company work and use a local branch. Future publication needs a separate policy-compliant instruction and content review.
