import { randomUUID } from 'node:crypto';
import type { AgentAdapter, AgentId, Event, Handoff } from '../../core/src/index.ts';
import type { Store } from '../../../apps/server/src/store.ts';
export class Orchestrator {
  active = new Map<string, { runId: string; taskId: string; controller: AbortController; done: Promise<void> }>();
  constructor(private store: Store, private adapters: Map<AgentId, AgentAdapter>, private broadcast: (event: Event) => void) {}
  emit(taskId: string, runId: string | null, type: string, data: Record<string, unknown>) { const event = this.store.event(taskId, runId, type, data); this.broadcast(event); }
  start(taskId: string, selection: AgentId | 'auto', model?: string) {
    const task = this.store.task(taskId), project = this.store.project(task.projectId);
    if (this.active.has(project.id)) throw new Error('Project already has an active run');
    const agent = selection === 'auto' ? 'mock' : selection;
    if (agent !== 'mock') throw new Error('external_transfer_forbidden');
    const adapter = this.adapters.get(agent)!;
    const previous = this.store.runs(taskId).at(-1);
    const run = this.store.addRun(taskId, agent, model);
    const context: Handoff = { id: randomUUID(), taskId, sourceRunId: previous?.id ?? null, targetRunId: run.id, goal: task.goal, memories: this.store.memories(project.id, taskId), recentResults: this.store.recentResults(taskId), createdAt: new Date().toISOString() };
    this.store.handoff(context);
    this.emit(taskId, run.id, 'run.started', { agent, model: model ?? null, reason: selection === 'auto' ? 'Local-only policy: Mock is the only permitted runtime' : 'Manual selection', handoffId: context.id });
    const controller = new AbortController();
    const entry = { runId: run.id, taskId, controller, done: Promise.resolve() };
    this.active.set(project.id, entry);
    entry.done = Promise.resolve().then(async () => {
      try {
        await adapter.start({ run, project, task, context, signal: controller.signal, emit: (type, data) => this.emit(taskId, run.id, type, data) });
        const status = controller.signal.aborted ? 'cancelled' : 'completed';
        this.store.finish(run.id, status); this.emit(taskId, run.id, `run.${status}`, { simulated: true });
      } catch {
        const status = controller.signal.aborted ? 'cancelled' : 'failed';
        this.store.finish(run.id, status, status === 'failed' ? 'adapter_failed' : null);
        this.emit(taskId, run.id, `run.${status}`, { reason: status === 'failed' ? 'adapter_failed' : 'user_cancelled' });
      } finally { this.active.delete(project.id); }
    });
    return run;
  }
  cancel(taskId: string) {
    const entry = [...this.active.values()].find(entry => entry.taskId === taskId);
    if (!entry) throw new Error('No active run');
    entry.controller.abort();
  }
  async stop() { const entries = [...this.active.values()]; entries.forEach(entry => entry.controller.abort()); await Promise.all(entries.map(entry => entry.done)); }
}
