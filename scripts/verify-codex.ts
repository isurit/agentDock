// Opt-in live validation. Never run in CI. Sends only a disposable synthetic project.
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gitSnapshot } from '../packages/project/src/index.ts';
import { CodexAdapter } from '../packages/agent-adapters/src/codex.ts';
import type { Handoff, Project, Run, Task } from '../packages/core/src/index.ts';
if (!process.argv.includes('--live')) throw new Error('Explicit live invocation required: npm run verify:codex -- --live');
const directory = await realpath(await mkdtemp(join(tmpdir(), 'agentdock-live-')));
const timestamp = new Date().toISOString();
const project: Project = { id: randomUUID(), name: 'Synthetic validation', path: directory, createdAt: timestamp };
const task: Task = { id: randomUUID(), projectId: project.id, title: 'Synthetic validation', goal: 'Read greeting.txt and say its exact content. Do not change files. Do not use shell commands or external tools.', status: 'draft', createdAt: timestamp, updatedAt: timestamp };
const adapter = new CodexAdapter();
const controller = new AbortController();
const externalTimeout = setTimeout(() => controller.abort(), 120000);
async function run(mode: 'read-only' | 'workspace-write') {
  const run: Run = { id: randomUUID(), taskId: task.id, agent: 'codex', model: process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : null, status: 'running', startedAt: timestamp, endedAt: null, providerSessionId: null, error: null };
  const context: Handoff = { id: randomUUID(), taskId: task.id, sourceRunId: null, targetRunId: run.id, goal: task.goal, memories: [], recentResults: [], createdAt: timestamp };
  const events: { type: string; data: Record<string, unknown> }[] = [];
  await adapter.start({ run, project, task, context, options: { mode, providerConsent: true }, signal: controller.signal,
    requestApproval: async () => 'decline', // Never grant elevated permissions during automated validation.
    emit: (type, data) => { events.push({ type, data }); if (type !== 'message.delta') console.log('event:', type, type === 'provider.error' ? data : type === 'session.started' ? { model: data.model } : ''); },
  });
  assert.ok(events.some(e => e.type === 'session.started'));
  assert.ok(events.some(e => e.type === 'message'));
  return events;
}
try {
  const capability = await adapter.probe(); assert.equal(capability.runnable, true);
  console.log('Codex version:', capability.version);
  console.log('CLI model catalog:', await adapter.models(directory));
  if (process.argv.includes('--list-models')) process.exitCode = 0;
  if (!process.argv.includes('--list-models')) {
  await writeFile(join(directory, 'greeting.txt'), 'Hello sample\n');
  const git = (args: string[]) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  git(['init', '-b', 'main']); git(['add', 'greeting.txt']);
  git(['-c', 'user.name=Synthetic Sample', '-c', 'user.email=sample@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic baseline']);
  await run('read-only'); assert.equal(await readFile(join(directory, 'greeting.txt'), 'utf8'), 'Hello sample\n');
  console.log('Read-only validation passed.');
  task.goal = 'Edit greeting.txt so it contains exactly "Hello AgentDock" followed by one newline. Use the native file edit tool. Do not use shell commands. Modify no other file. Return a short summary.';
  await run('workspace-write'); assert.equal(await readFile(join(directory, 'greeting.txt'), 'utf8'), 'Hello AgentDock\n');
  assert.match((await gitSnapshot(directory)).diff, /Hello AgentDock/);
  console.log('Actual Codex edit and local Git Diff validation passed. Only synthetic source was sent.');
  }
} finally { clearTimeout(externalTimeout); await rm(directory, { recursive: true, force: true }); }
