// Opt-in integration smoke on a disposable synthetic Git project. No company input.
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { Store } from '../apps/server/src/store.ts';
import { Orchestrator } from '../packages/orchestrator/src/index.ts';
import { HeadlessAdapter } from '../packages/agent-adapters/src/headless.ts';
if (!process.argv.includes('--live')) throw new Error('Explicit opt-in required: npm run verify:headless -- --live --provider gemini');
function option(name: string) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
const provider = option('--provider');
if (provider !== 'gemini' && provider !== 'claude') throw new Error('Choose --provider gemini or --provider claude');
const root = await realpath(await mkdtemp(join(tmpdir(), 'agentdock-smoke-')));
const path = join(root, 'project'); await mkdir(path);
await writeFile(join(path, 'sample.txt'), 'Synthetic verification only.\n');
const git = (args: string[]) => execFileSync('git', args, { cwd: path, stdio: 'pipe' });
git(['init', '-b', 'main']); git(['add', 'sample.txt']);
git(['-c', 'user.name=Synthetic Sample', '-c', 'user.email=sample@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic verification baseline']);
const store = new Store(join(root, 'state', 'smoke.sqlite'));
const project = store.addProject('Synthetic CLI smoke', path);
const adapter = new HeadlessAdapter(provider);
const engine = new Orchestrator(store, new Map([[provider, adapter]]), event => {
  // Do not print model responses, source, prompts, session IDs, raw stderr or paths.
  console.log(JSON.stringify({ type: event.type, phase: event.data.phase ?? null, code: event.data.code ?? event.data.reason ?? null }));
});
try {
  const probe = await adapter.probe(); console.log(JSON.stringify({ provider, version: probe.version, protocolFlagsDetected: probe.runnable }));
  assert.ok(probe.runnable, 'CLI missing or required flags not detected');
  for (const [label, goal, includeGitHistory] of [
    ['plain-response', 'Reply with one brief greeting. Do not use tools or read project files.', false],
    ['git-context', 'Summarize the newest commit in the supplied recent Git history. Use only the supplied data; do not run shell tools or change files.', true],
  ] as const) {
    console.log('case:', label);
    const task = store.addTask({ projectId: project.id, title: label, goal });
    engine.start(task.id, provider, option('--model'), { mode: 'read-only', providerConsent: true, includeGitHistory });
    await Promise.all([...engine.active.values()].map(entry => entry.done));
    const result = store.runs(task.id).at(-1)!;
    console.log(JSON.stringify({ case: label, status: result.status, error: result.error, hasSession: result.providerSessionId !== null }));
    assert.equal(result.status, 'completed', result.error ?? 'Live smoke failed');
  }
  console.log('Both synthetic live cases completed; company-project behavior still requires separate validation.');
} catch { console.error(JSON.stringify({ error: 'live_smoke_failed', note: 'Use the phase/error categories above for local investigation; no automatic retry was performed.' })); process.exitCode = 1; } finally { await engine.stop(); store.close(); await rm(root, { recursive: true, force: true }); }
