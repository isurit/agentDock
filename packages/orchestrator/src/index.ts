import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import type { AgentAdapter, AgentId, Approval, Event, Handoff, RunOptions } from '../../core/src/index.ts';
import { CliError } from '../../agent-adapters/src/process.ts';
import type { Store } from '../../../apps/server/src/store.ts';
export class Orchestrator {
  active = new Map<string, { runId: string; taskId: string; controller: AbortController; done: Promise<void> }>();
  private pending = new Map<string, { approval: Approval; resolve(decision: 'accept' | 'decline'): void }>();
  constructor(private store: Store, private adapters: Map<AgentId, AgentAdapter>, private broadcast: (event: Event) => void) {}
  emit(taskId: string, runId: string | null, type: string, data: Record<string, unknown>) {
    if (type === 'session.started' && runId && typeof data.providerSessionId === 'string') this.store.session(runId, data.providerSessionId, typeof data.model === 'string' ? data.model : undefined);
    const event = this.store.event(taskId, runId, type, data); this.broadcast(event);
  }
  start(taskId: string, selection: AgentId | 'auto', model?: string, options: RunOptions = { mode: 'read-only', providerConsent: false }) {
    const task = this.store.task(taskId), project = this.store.project(task.projectId);
    if (this.active.has(project.id)) throw new Error('Project already has an active run');
    // Auto never silently chooses a paid/provider-backed run or changes the recipient.
    const agent = selection === 'auto' ? 'mock' : selection;
    if (agent !== 'mock' && !options.providerConsent) throw new CliError('provider_consent_required');
    if (realpathSync(project.path) !== project.path) throw new Error('Project path changed; register its canonical directory again');
    const adapter = this.adapters.get(agent);
    if (!adapter) throw new CliError('cli_unavailable');
    const previous = this.store.runs(taskId).at(-1);
    const run = this.store.addRun(taskId, agent, model);
    const context: Handoff = { id: randomUUID(), taskId, sourceRunId: previous?.id ?? null, targetRunId: run.id, goal: task.goal, memories: this.store.memories(project.id, taskId), recentResults: this.store.recentResults(taskId), createdAt: new Date().toISOString() };
    this.store.handoff(context);
    const controller = new AbortController();
    const entry = { runId: run.id, taskId, controller, done: Promise.resolve() };
    this.active.set(project.id, entry);
    this.emit(taskId, run.id, 'run.started', { agent, model: model ?? null, mode: options.mode, providerConsent: options.providerConsent, instruction: options.instruction ?? null, reason: selection === 'auto' ? 'Auto defaults to Mock; choose a provider explicitly' : 'Manual provider selection', handoffId: context.id });
    entry.done = Promise.resolve().then(async () => {
      try {
        if (controller.signal.aborted) throw new CliError('cancelled');
        if (agent !== 'mock') { const capability = await adapter.probe(); if (!capability.runnable) throw new CliError(capability.reason ?? 'cli_unavailable'); this.emit(taskId, run.id, 'cli.detected', { agent, version: capability.version, approvalMode: capability.approvalMode ?? null }); }
        if (controller.signal.aborted) throw new CliError('cancelled');
        await adapter.start({ run, project, task, context, options, signal: controller.signal,
          requestApproval: (method, details) => this.requestApproval(taskId, run.id, controller.signal, method, details),
          emit: (type, data) => this.emit(taskId, run.id, type, data) });
        const status = controller.signal.aborted ? 'cancelled' : 'completed';
        this.store.finish(run.id, status); this.emit(taskId, run.id, `run.${status}`, { simulated: agent === 'mock' });
      } catch (error) {
        const status = controller.signal.aborted || (error instanceof CliError && error.code === 'cancelled') ? 'cancelled' : 'failed';
        const reason = status === 'cancelled' ? 'user_cancelled' : error instanceof CliError ? error.code : 'adapter_failed';
        this.store.finish(run.id, status, status === 'failed' ? reason : null);
        this.emit(taskId, run.id, `run.${status}`, { reason, simulated: agent === 'mock' });
      } finally {
        // Never leave approval waiters after completion, cancellation or process failure.
        for (const [id, p] of this.pending) if (p.approval.runId === run.id) { this.pending.delete(id); this.emit(taskId, run.id, 'approval.expired', { id }); p.resolve('decline'); }
        this.active.delete(project.id);
      }
    });
    return run;
  }
  approvals(taskId: string) { return [...this.pending.values()].map(p => p.approval).filter(a => a.taskId === taskId); }
  private requestApproval(taskId: string, runId: string, signal: AbortSignal, method: string, details: Record<string, unknown>): Promise<'accept' | 'decline'> {
    if (signal.aborted) return Promise.resolve('decline');
    const approval: Approval = { id: randomUUID(), taskId, runId, method, details };
    return new Promise(resolve => {
      const abort = () => this.resolveApproval(taskId, approval.id, 'decline', 'cancelled');
      this.pending.set(approval.id, { approval, resolve: decision => { signal.removeEventListener('abort', abort); resolve(decision); } });
      signal.addEventListener('abort', abort, { once: true }); this.store.runStatus(runId, 'awaiting_approval');
      this.emit(taskId, runId, 'approval.requested', { ...approval });
    });
  }
  resolveApproval(taskId: string, id: string, decision: 'accept' | 'decline', source: 'user' | 'cancelled' = 'user') {
    const pending = this.pending.get(id);
    if (!pending || pending.approval.taskId !== taskId) throw new Error('Approval is no longer pending');
    this.pending.delete(id);
    if (!this.approvals(taskId).length) this.store.runStatus(pending.approval.runId, 'running');
    this.emit(taskId, pending.approval.runId, 'approval.resolved', { id, decision, source }); pending.resolve(decision);
  }
  cancel(taskId: string) {
    const entry = [...this.active.values()].find(entry => entry.taskId === taskId);
    if (!entry) throw new Error('No active run'); entry.controller.abort();
  }
  async stop() { const entries = [...this.active.values()]; entries.forEach(entry => entry.controller.abort()); await Promise.all(entries.map(entry => entry.done)); }
}
