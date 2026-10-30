import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineEvents, createRefreshQueue } from '../packages/core/src/timeline.ts';
import { classifyStderr } from '../packages/agent-adapters/src/process.ts';
import { recentGitHistory } from '../packages/project/src/index.ts';
import { Store } from '../apps/server/src/store.ts';
import { Orchestrator } from '../packages/orchestrator/src/index.ts';
import { registry } from '../packages/agent-adapters/src/index.ts';
import { promptFor } from '../packages/agent-adapters/src/context.ts';
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { execFileSync } from 'node:child_process';
import type { Event } from '../packages/core/src/index.ts';
function event(seq: number, runId: string, type: string, text: string): Event { return { seq, taskId: 'task', runId, type, data: { itemId: 'same-item-id', text }, createdAt: '' }; }
test('Streaming UI groups chunks without losing evidence or suppressing another run', () => {
  const source = [event(1, 'one', 'message.delta', 'Hello '), event(2, 'one', 'message.delta', 'world'), event(3, 'two', 'message.delta', 'Second')];
  assert.deepEqual(timelineEvents(source).map(e => e.data.text), ['Hello world', 'Second']);
  assert.equal(source[0].data.text, 'Hello ');
  assert.deepEqual(timelineEvents([...source, event(4, 'one', 'message', 'Final')]).map(e => e.data.text), ['Second', 'Final']);
});
test('Streaming refresh bursts coalesce without concurrent requests and use the latest callback', async () => {
  const queue = createRefreshQueue(); let release!: () => void; const pending = new Promise<void>(resolve => release = resolve); const visited: string[] = [];
  const first = queue(async () => { visited.push('initial'); await pending; });
  void queue(async () => { visited.push('obsolete'); });
  const last = queue(async () => { visited.push('latest'); });
  assert.equal(first, last); assert.deepEqual(visited, ['initial']); release(); await last;
  assert.deepEqual(visited, ['initial', 'latest']);
  await assert.rejects(queue(async () => { throw new Error('synthetic'); }), /synthetic/);
  await queue(async () => { visited.push('recovered'); }); assert.equal(visited.at(-1), 'recovered');
});
test('Cached credential notices are not misreported as failed authentication', () => {
  assert.equal(classifyStderr('Loaded cached credentials.'), 'cli_failed');
  assert.equal(classifyStderr('Loaded cached credentials.\nECONNRESET retrying'), 'connection_failed');
  assert.equal(classifyStderr('OAuth authentication failed'), 'authentication_required');
});
test('Selected local Git history is persisted in Handoff and available without a CLI shell', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentdock-history-'))); const path = join(root, 'project'); await mkdir(path);
  const git = (args: string[]) => execFileSync('git', args, { cwd: path, stdio: 'pipe' });
  git(['init', '-b', 'main']); await writeFile(join(path, 'example'), 'synthetic'); git(['add', 'example']);
  git(['-c', 'user.name=Synthetic', '-c', 'user.email=sample@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Latest synthetic change']);
  const store = new Store(join(root, 'state', 'test.sqlite'));
  try {
    const project = store.addProject('Synthetic', path), task = store.addTask({ projectId: project.id, title: 'History', goal: 'Summarize latest commits' });
    const engine = new Orchestrator(store, registry(), () => {});
    engine.start(task.id, 'mock', undefined, { mode: 'read-only', providerConsent: false, includeGitHistory: true });
    await Promise.all([...engine.active.values()].map(e => e.done));
    const context = store.handoffs(task.id).at(-1)!;
    assert.equal(context.gitHistory?.[0].subject, 'Latest synthetic change'); assert.ok(!JSON.stringify(context.gitHistory).includes('sample@example.invalid'));
    const run = store.runs(task.id).at(-1)!;
    assert.match(promptFor({ project, task, context, run, options: { mode: 'read-only', providerConsent: true } } as never), /Latest synthetic change/);
    engine.start(task.id, 'mock'); await Promise.all([...engine.active.values()].map(e => e.done)); assert.equal(store.handoffs(task.id).at(-1)?.gitHistory, undefined);
    await assert.rejects(recentGitHistory(root));
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test('Company headless smoke runs both synthetic cases without printing prompts, sessions or local paths', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'agentdock-smoke-shim-')));
  try {
    const fixture = fileURLToPath(new URL('./fixtures/fake-cli.mjs', import.meta.url));
    const wrapper = '#!/usr/bin/env node\nprocess.argv = [process.argv[0], ' + JSON.stringify(fixture) + ', "gemini", "normal", ...process.argv.slice(2)]; import(' + JSON.stringify(new URL('./fixtures/fake-cli.mjs', import.meta.url).href) + ');\n';
    await writeFile(join(root, 'gemini'), wrapper, { mode: 0o700 });
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/verify-headless.ts', '--live', '--provider', 'gemini'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, PATH: root + delimiter + process.env.PATH }, timeout: 15000, maxBuffer: 65536 });
    assert.equal((stdout.match(/"status":"completed"/g) ?? []).length, 2);
    assert.ok(stdout.includes('Both synthetic live cases completed'));
    assert.ok(!stdout.includes('headless-synthetic')); assert.ok(!stdout.includes('Synthetic verification baseline')); assert.ok(!stdout.includes(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});
