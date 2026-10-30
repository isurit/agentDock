# Security and privacy

Current policy is local-only. No personal/company data is uploaded to GitHub or CLI providers. Real adapter starts are hard-denied. No telemetry, remote fonts, model SDK calls, Git push/fetch or credential-reading endpoints exist.

## Storage

Persist Tasks, History, Memory, project paths and runtime metadata only in the current user's app-data directory outside Git. The initial DB uses SQLite WAL and restrictive creation permissions. This is not encryption: the OS user, administrators, malware and configured backup/sync software can read data. Do not use shared or synchronized data directories. Check company disk encryption, backup and retention policies before use.

No automatic delete/retention is implemented. To back up, stop the server cleanly and copy the entire app-data folder to an approved local destination. Restore only while stopped. To roll back code, restore a compatible backup too; a future schema version is rejected by older code. Initial creation is schema migration 1; automatic pre-migration backup is not yet implemented.

## Browser

Only 127.0.0.1 is supported. Requests require the exact host; explicit foreign Origins and cross-site fetches are rejected. Private APIs require a random per-server token. WebSocket requires exact Origin/Host plus the same token in a subprotocol handshake. No CORS wildcard. No remote access mode.

Trusted local software can obtain the token; this is protection against hostile browser origins, not against compromised local accounts. Development Vite is for local development only. Do not expose this port via reverse proxy or port forwarding.

## Execution and Git

Only Mock executes Task requests. CLI probes call --version without shell or credentials. Read-only Git status/diff commands disable external diff/textconv and fsmonitor hooks. Output size and timeout limits fail closed with a generic local error. Untracked file contents are not collected. Project registration does not copy or synchronize source.

The app never pushes. Product .gitignore and privacy checks reject known runtime/credential file patterns. They are defense in depth: review staged content before every explicitly authorized push. Arbitrary text can contain personal data that a filename check cannot detect.

Company mode is an operational policy today; a hardened pull-only updater and outbound OS firewall are not implemented. Company users should not configure Push credentials for the personal product remote.
