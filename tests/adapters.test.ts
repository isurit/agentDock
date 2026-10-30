import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, realpath, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { CodexAdapter } from '../packages/agent-adapters/src/codex.ts';
import { HeadlessAdapter } from '../packages/agent-adapters/src/headless.ts';
import { CliProcess } from '../packages/agent-adapters/src/process.ts';
import { Orchestrator } from '../packages/orchestrator/src/index.ts';
import { Store } from '../apps/server/src/store.ts';
import type { AgentAdapter, RunRequest } from '../packages/core/src/index.ts';
const fixture = fileURLToPath(new URL('./fixtures/fake-cli.mjs', import.meta.url));
function command(provider: string, scenario = 'normal') { return { file: process.execPath, args: [fixture, provider, scenario] }; }
async function request() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'agentdock-adapter-')));
  const store = new Store(join(dir, 'state.sqlite'));
  const project = store.addProject('Synthetic', dir), task = store.addTask({ projectId: project.id, title: 'Synthetic', goal: 'Goal preserved' });
  const run = store.addRun(task.id, 'codex'); const controller = new AbortController();
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const value: RunRequest = { project, task, run, options: { providerConsent: true, mode: 'workspace-write', instruction: 'Continue the previous decision' }, signal: controller.signal,
    context: { id: 'context', taskId: task.id, sourceRunId: null, targetRunId: run.id, goal: task.goal, memories: [{ id: 'm', projectId: project.id, taskId: null, content: 'Keep the UI accessible', source: 'user', updatedAt: '' }], recentResults: [], createdAt: '' },
    requestApproval: async () => 'accept', emit: (type, data) => events.push({ type, data }) };
  return { dir, store, project, task, controller, events, value, cleanup: async () => { store.close(); await rm(dir, { recursive: true, force: true }); } };
}
test('Codex protocol preserves Context, enforces the sandbox and records actual model/session', async () => {
  const f = await request();
  try {
    const adapter = new CodexAdapter(command('codex'));
    assert.equal((await adapter.probe()).runnable, true); assert.deepEqual(await adapter.models(f.dir), [{ id: 'synthetic-model', name: 'Synthetic', isDefault: true }]); await adapter.start(f.value);
    assert.equal(f.events.find(e => e.type === 'session.started')?.data.providerSessionId, 'thread-synthetic');
    const message = JSON.parse(String(f.events.find(e => e.type === 'message')?.data.text));
    assert.match(message.received, /Goal preserved/); assert.match(message.received, /Keep the UI accessible/); assert.match(message.received, /Continue the previous decision/);
    assert.equal(message.sandbox.type, 'workspaceWrite'); assert.equal(message.sandbox.networkAccess, false);
    await assert.rejects(new CodexAdapter(command('codex', 'bad-sandbox')).start(f.value), /sandbox_policy_mismatch/);
    await assert.rejects(new CodexAdapter(command('codex', 'failed')).start(f.value), /usage_limit/);
  } finally { await f.cleanup(); }
});
test('Codex approval decisions route once; read-only and outside-root grants fail closed', async () => {
  const f = await request(); let count = 0;
  try {
    f.value.requestApproval = async () => { count++; return 'decline'; };
    await new CodexAdapter(command('codex', 'approval')).start(f.value);
    assert.equal(count, 1); assert.match(String(f.events.find(e => e.type === 'message')?.data.text), /decline/);
    f.value.options.mode = 'read-only'; await new CodexAdapter(command('codex', 'approval')).start(f.value); assert.equal(count, 1);
    f.value.options.mode = 'workspace-write'; await new CodexAdapter(command('codex', 'outside')).start(f.value); assert.equal(count, 1);
    assert.equal(f.events.filter(e => e.type === 'approval.blocked').length, 2);
  } finally { await f.cleanup(); }
});
test('Claude/Gemini stream adapters use stdin, native edit policies and explicit terminal success', async () => {
  const f = await request();
  try {
    for (const provider of ['claude', 'gemini'] as const) {
      f.events.length = 0; const adapter = new HeadlessAdapter(provider, command(provider));
      assert.equal((await adapter.probe()).runnable, true); await adapter.start(f.value);
      const result = JSON.parse(String(f.events.find(e => e.type === 'message')?.data.text));
      assert.match(result.input, /Goal preserved/); assert.ok(!result.flags.some((arg: string) => /yolo|bypass|dangerously/.test(arg)));
      assert.ok(result.flags.includes(provider === 'gemini' ? 'auto_edit' : 'acceptEdits'));
      assert.ok(!result.flags.includes('Goal preserved'));
      await assert.rejects(new HeadlessAdapter(provider, command(provider, 'missing-result')).start(f.value), /cli_missing_result/);
      await assert.rejects(new HeadlessAdapter(provider, command(provider, 'error')).start(f.value), /provider_reported_failure/);
    }
    await assert.rejects(new HeadlessAdapter('claude', command('claude', 'denied')).start(f.value), /permission_required/);
  } finally { await f.cleanup(); }
});
test('Approval lifecycle persists decisions, rejects wrong/stale Task IDs and releases locks on cancellation', async () => {
  const f = await request();
  try {
    const adapter: AgentAdapter = { id: 'codex', probe: async () => ({ id: 'codex', installed: true, runnable: true, version: 'synthetic', verified: false, mode: 'synthetic', quota: 'unknown' }), start: async r => {
      const decision = await r.requestApproval('item/fileChange/requestApproval', { reason: 'synthetic' });
      r.emit('message', { text: decision });
    } };
    const engine = new Orchestrator(f.store, new Map([['codex', adapter]]), () => {});
    engine.start(f.task.id, 'codex', undefined, { providerConsent: true, mode: 'workspace-write' });
    for (let i = 0; i < 50 && !engine.approvals(f.task.id).length; i++) await delay(10);
    assert.equal(f.store.task(f.task.id).status, 'awaiting_approval'); const approval = engine.approvals(f.task.id)[0]; assert.ok(approval);
    assert.throws(() => engine.resolveApproval('wrong-task', approval.id, 'accept'), /no longer pending/);
    engine.resolveApproval(f.task.id, approval.id, 'accept');
    assert.throws(() => engine.resolveApproval(f.task.id, approval.id, 'accept'), /no longer pending/);
    await Promise.all([...engine.active.values()].map(e => e.done));
    assert.equal(f.store.task(f.task.id).status, 'completed'); assert.ok(f.store.events(f.task.id).some(e => e.type === 'approval.resolved'));
    engine.start(f.task.id, 'codex', undefined, { providerConsent: true, mode: 'workspace-write' });
    for (let i = 0; i < 50 && !engine.approvals(f.task.id).length; i++) await delay(10);
    engine.cancel(f.task.id); await engine.stop(); assert.equal(engine.approvals(f.task.id).length, 0); assert.equal(f.store.task(f.task.id).status, 'cancelled'); assert.equal(engine.active.size, 0);
  } finally { await f.cleanup(); }
});
test('Stopping a CLI also terminates descendants that ignore SIGTERM', async () => {
  const f = await request();
  try {
    const marker = join(f.dir, 'heartbeat'); const cli = new CliProcess(command('tree', marker), [], f.dir, () => {}, () => {});
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) { try { if ((await readFile(marker, 'utf8')).length) { ready = true; break; } } catch {} await delay(20); }
      assert.ok(ready); await cli.stop(); const stopped = await readFile(marker, 'utf8'); await delay(150); assert.equal(await readFile(marker, 'utf8'), stopped);
    } finally { await cli.stop(); }
  } finally { await f.cleanup(); }
});

test('Real-adapter protocol results update local Run sessions and Handoff across agent selection', async () => {
  const f = await request();
  try {
    const adapters = new Map<import('../packages/core/src/index.ts').AgentId, AgentAdapter>([
      ['codex', new CodexAdapter(command('codex'))], ['gemini', new HeadlessAdapter('gemini', command('gemini'))],
    ]);
    const engine = new Orchestrator(f.store, adapters, () => {});
    f.store.addMemory({ projectId: f.project.id, content: 'Preserve the decision' });
    engine.start(f.task.id, 'codex', undefined, { providerConsent: true, mode: 'read-only', instruction: 'Initial user direction' });
    await Promise.all([...engine.active.values()].map(e => e.done));
    let latest = f.store.runs(f.task.id).at(-1)!;
    assert.equal(latest.status, 'completed'); assert.equal(latest.providerSessionId, 'thread-synthetic'); assert.equal(latest.model, 'synthetic-model');
    engine.start(f.task.id, 'gemini', undefined, { providerConsent: true, mode: 'read-only' });
    await Promise.all([...engine.active.values()].map(e => e.done));
    latest = f.store.runs(f.task.id).at(-1)!;
    assert.equal(latest.status, 'completed'); assert.equal(latest.providerSessionId, 'headless-synthetic');
    const h = f.store.handoffs(f.task.id).at(-1)!;
    assert.equal(h.memories.length, 1); assert.ok(h.recentResults.some(e => e.data.instruction === 'Initial user direction'));
    assert.ok(f.store.events(f.task.id).some(e => e.type === 'cli.detected'));
  } finally { await f.cleanup(); }
});
