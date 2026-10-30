import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, symlink, writeFile, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request } from 'node:http';
import { WebSocket } from 'ws';
import { Store } from '../apps/server/src/store.ts';
import { createApp } from '../apps/server/src/app.ts';
import { registry } from '../packages/agent-adapters/src/index.ts';
import { Orchestrator } from '../packages/orchestrator/src/index.ts';
import { within, gitSnapshot, recentGitHistory } from '../packages/project/src/index.ts';
import { execFileSync } from 'node:child_process';
import { prepareDataDirectory } from '../apps/server/src/data-dir.ts';

async function fixture() { const dir = await realpath(await mkdtemp(join(tmpdir(), 'agentdock-test-'))); return { dir, path: join(dir, 'state', 'test.sqlite'), cleanup: () => rm(dir, { recursive: true, force: true }) }; }

test('History, Memory and local handoff survive reopening; Mock never edits project files', async () => {
  const f = await fixture(); let store = new Store(f.path);
  try {
    await writeFile(join(f.dir, 'untouched.txt'), 'synthetic original');
    const p = store.addProject('sample', f.dir); const t = store.addTask({ projectId: p.id, title: 'local task', goal: 'Keep a decision' });
    store.addMemory({ projectId: p.id, content: 'Keep the UI accessible' });
    const unrelated = store.addProject('other', join(f.dir, 'other'));
    store.addMemory({ projectId: unrelated.id, content: 'Must not cross project boundaries' });
    const stream: number[] = []; const engine = new Orchestrator(store, registry(), e => stream.push(e.seq));
    engine.start(t.id, 'auto'); await Promise.all([...engine.active.values()].map(e => e.done));
    assert.equal(store.task(t.id).status, 'completed');
    engine.start(t.id, 'mock'); await Promise.all([...engine.active.values()].map(e => e.done));
    const handoff = store.handoffs(t.id).at(-1)!;
    assert.equal(handoff.memories.length, 1); assert.ok(handoff.sourceRunId); assert.ok(handoff.recentResults.length > 0);
    assert.deepEqual(stream, [...stream].sort((a, b) => a - b));
    const events = store.events(t.id); assert.ok(events.length > 5);
    assert.equal(store.events(t.id, events[2].seq)[0].seq, events[3].seq);
    store.close(); store = new Store(f.path);
    assert.equal(store.runs(t.id).length, 2); assert.equal(store.handoffs(t.id).length, 2); assert.equal(store.memories(p.id).length, 1);
    assert.equal(await readFile(join(f.dir, 'untouched.txt'), 'utf8'), 'synthetic original');
  } finally { store.close(); await f.cleanup(); }
});

test('Project lock covers separate Tasks; cancellation is persisted', async () => {
  const f = await fixture(); const store = new Store(f.path);
  try {
    const p = store.addProject('sample', f.dir);
    const a = store.addTask({ projectId: p.id, title: 'one', goal: 'one' }); const b = store.addTask({ projectId: p.id, title: 'two', goal: 'two' });
    const engine = new Orchestrator(store, registry(), () => {}); engine.start(a.id, 'mock');
    assert.throws(() => engine.start(b.id, 'mock'), /active run/);
    engine.cancel(a.id); await engine.stop(); assert.equal(store.task(a.id).status, 'cancelled');
    assert.equal(store.runs(a.id)[0].status, 'cancelled');
  } finally { store.close(); await f.cleanup(); }
});

test('Interrupted runs become failed with an explicit reason, never retried', async () => {
  const f = await fixture(); let store = new Store(f.path);
  try {
    const p = store.addProject('sample', f.dir); const t = store.addTask({ projectId: p.id, title: 'test', goal: 'test' });
    store.addRun(t.id, 'mock'); store.close(); store = new Store(f.path); store.recover();
    assert.equal(store.runs(t.id).length, 1); assert.equal(store.runs(t.id)[0].error, 'interrupted_by_restart');
    assert.equal(store.task(t.id).status, 'failed'); assert.equal(store.events(t.id).at(-1)?.type, 'run.interrupted');
  } finally { store.close(); await f.cleanup(); }
});

test('Actual providers require explicit consent before any process or run is created', async () => {
  const f = await fixture(); const store = new Store(f.path);
  try {
    const p = store.addProject('sample', f.dir), t = store.addTask({ projectId: p.id, title: 'test', goal: 'private' });
    const adapters = registry(); const engine = new Orchestrator(store, adapters, () => {});
    for (const agent of ['codex', 'claude', 'gemini'] as const) {
      assert.throws(() => engine.start(t.id, agent), /provider_consent_required/);
      await assert.rejects(adapters.get(agent)!.start({ options: { providerConsent: false } } as never), /provider_consent_required/);
    }
    assert.equal(store.runs(t.id).length, 0);
  } finally { store.close(); await f.cleanup(); }
});

test('Cross-project Memory cannot be attached and symlink escapes are rejected', async () => {
  const f = await fixture(); const store = new Store(f.path);
  try {
    const a = store.addProject('a', join(f.dir, 'a')), b = store.addProject('b', join(f.dir, 'b'));
    const t = store.addTask({ projectId: a.id, title: 'test', goal: 'test' });
    assert.throws(() => store.addMemory({ projectId: b.id, taskId: t.id, content: 'invalid' }), /mismatch/);
    await mkdir(join(f.dir, 'a')); await mkdir(join(f.dir, 'b')); await writeFile(join(f.dir, 'b', 'private'), 'private');
    await symlink(join(f.dir, 'b'), join(f.dir, 'a', 'escape'));
    await assert.rejects(within(join(f.dir, 'a'), join(f.dir, 'a', 'escape', 'private')), /Outside project/);
  } finally { store.close(); await f.cleanup(); }
});

test('HTTP and WebSocket enforce origin and session token; replay works after reconnect', async () => {
  const f = await fixture(); const runtime = createApp(f.path);
  runtime.server.listen(0, '127.0.0.1'); await once(runtime.server, 'listening');
  const address = runtime.server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(base + '/api/projects')).status, 401);
    assert.equal((await fetch(base + '/api/bootstrap', { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
    const badHost = await new Promise<number | undefined>((resolve, reject) => { const r = request(base + '/api/bootstrap', { headers: { Host: 'untrusted.invalid' } }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', reject); r.end(); });
    assert.equal(badHost, 403);
    const { token } = await (await fetch(base + '/api/bootstrap')).json() as { token: string };
    const headers = { 'X-AgentDock-Token': token, 'Content-Type': 'application/json', Origin: base };
    const p = await (await fetch(base + '/api/projects', { method: 'POST', headers, body: JSON.stringify({ name: 'sample', path: f.dir }) })).json() as { id: string };
    const t = await (await fetch(base + '/api/tasks', { method: 'POST', headers, body: JSON.stringify({ projectId: p.id, title: 'sample', goal: 'local goal' }) })).json() as { id: string };
    const blocked = await fetch(base + `/api/tasks/${t.id}/runs`, { method: 'POST', headers, body: JSON.stringify({ agent: 'codex' }) }); assert.equal(blocked.status, 403);
    const rejected = new WebSocket(base.replace('http:', 'ws:') + '/events', ['agentdock', 'wrong'], { origin: base });
    rejected.on('error', () => {}); await once(rejected, 'close').catch(() => {});
    const socket = new WebSocket(base.replace('http:', 'ws:') + '/events', ['agentdock', token], { origin: base }); await once(socket, 'open');
    const eventPromise = once(socket, 'message');
    assert.equal((await fetch(base + `/api/tasks/${t.id}/runs`, { method: 'POST', headers, body: JSON.stringify({ agent: 'mock' }) })).status, 201);
    const [raw] = await eventPromise; assert.equal(JSON.parse(raw.toString()).taskId, t.id); socket.close();
    await Promise.all([...runtime.orchestrator.active.values()].map(e => e.done));
    const history = await (await fetch(base + `/api/tasks/${t.id}/events?after=1`, { headers })).json() as { seq: number }[];
    assert.ok(history.length > 0); assert.ok(history.every(e => e.seq > 1));
    const invalid = await fetch(base + '/api/tasks', { method: 'POST', headers, body: JSON.stringify({ projectId: p.id, title: '', goal: 'test' }) }); assert.equal(invalid.status, 400);
  } finally { await runtime.close(); await f.cleanup(); }
});

 test('Private state directories cannot be placed inside Git, including symlinked ancestors', async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.dir, 'repo')); await mkdir(join(f.dir, 'repo', '.git'));
    await symlink(join(f.dir, 'repo'), join(f.dir, 'alias'));
    assert.throws(() => prepareDataDirectory(join(f.dir, 'repo', 'private')), /outside Git/);
    assert.throws(() => prepareDataDirectory(join(f.dir, 'alias', 'nested', 'private')), /outside Git/);
    assert.equal(prepareDataDirectory(join(f.dir, 'local')), await realpath(join(f.dir, 'local')));
    assert.throws(() => prepareDataDirectory('relative'), /absolute/);
  } finally { await f.cleanup(); }
});

test('Git snapshot includes local staged/working diffs and only names for untracked files', async () => {
  const f = await fixture();
  try {
    const git = (args: string[]) => execFileSync('git', args, { cwd: f.dir, stdio: 'pipe' });
    git(['init', '-b', 'main']); await writeFile(join(f.dir, 'example.kt'), 'val message = "initial"\n'); git(['add', 'example.kt']);
    git(['-c', 'user.name=Sample', '-c', 'user.email=sample@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-m', 'sample']);
    await writeFile(join(f.dir, 'example.kt'), 'val message = "staged"\n'); git(['add', 'example.kt']);
    await writeFile(join(f.dir, 'example.kt'), 'val message = "working"\n');
    await writeFile(join(f.dir, 'untracked.txt'), 'UNTRACKED_CONTENT_MUST_NOT_BE_COLLECTED');
    const snapshot = await gitSnapshot(f.dir);
    assert.match(snapshot.diff, /working/); assert.match(snapshot.staged, /staged/); assert.match(snapshot.status, /untracked.txt/);
    const history = await recentGitHistory(f.dir); assert.equal(history[0].subject, 'sample'); assert.ok(/^[a-f0-9]+$/.test(history[0].hash)); assert.ok(!JSON.stringify(history).includes('sample@example.invalid'));
    assert.equal(snapshot.untrackedContentsIncluded, false); assert.ok(!JSON.stringify(snapshot).includes('UNTRACKED_CONTENT_MUST_NOT_BE_COLLECTED'));
  } finally { await f.cleanup(); }
});
