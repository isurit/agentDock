import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let count = 0;
for (const path of paths) {
  const forbidden = /(?:^|\/)(?:node_modules|\.agentdock|artifacts|backups|logs|company-source)(?:\/|$)/i.test(path)
    || /(?:^|\/)(?:\.env(?:\..*)?|auth\.json|credentials(?:\..*)?)$/i.test(path) && !path.endsWith('.env.example')
    || /\.(?:db|sqlite|sqlite3|log|pem|key)(?:-(?:wal|shm))?$/i.test(path);
  let sqlite = false;
  try { sqlite = readFileSync(path).subarray(0, 16).toString() === 'SQLite format 3\0'; } catch { throw new Error('Cannot inspect a tracked file'); }
  if (forbidden || sqlite) count++;
}
if (count) { console.error(`Privacy check failed: ${count} runtime or credential files in tracked/candidate sources. Review locally.`); process.exit(1); }
console.log(`Privacy check passed for ${paths.length} tracked/candidate product files. Manually review staged prose for personal data.`);
