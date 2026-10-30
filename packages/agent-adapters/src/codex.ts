import { isAbsolute, relative } from 'node:path';
import type { AgentAdapter, Capability, RunRequest } from '../../core/src/index.ts';
import { CliError, RpcPeer, inspect, classifyError, safeDiagnostic, type Command } from './process.ts';
import { promptFor } from './context.ts';
export class CodexAdapter implements AgentAdapter {
  readonly id = 'codex';
  constructor(private command: Command = { file: 'codex' }) {}
  async probe(): Promise<Capability> {
    try {
      const version = (await inspect(this.command, ['--version'])).match(/\b\d+\.\d+\.\d+\b/)?.[0] ?? null;
      const help = await inspect(this.command, ['app-server', '--help']);
      const runnable = help.includes('stdio');
      return { id: this.id, installed: true, version, verified: false, runnable, supportsWrite: runnable, mode: 'App Server · native sandbox', approvalMode: 'browser, once per request', quota: 'unknown', ...(runnable ? {} : { reason: 'unsupported_cli_version' }) };
    } catch { return { id: this.id, installed: false, version: null, verified: false, runnable: false, mode: 'unavailable', quota: 'unknown', reason: 'cli_unavailable' }; }
  }
  async models(cwd: string): Promise<{ id: string; name: string; isDefault: boolean }[]> {
    const peer = new RpcPeer(this.command, ['app-server', '--stdio', '-c', 'analytics.enabled=false'], cwd, message => { if (message.id !== undefined) peer.unsupported(message.id); }, () => {});
    try {
      await peer.call('initialize', { clientInfo: { name: 'agentdock', title: 'AgentDock', version: '0.3.0' }, capabilities: {} }); peer.notify('initialized');
      const models: { id: string; name: string; isDefault: boolean }[] = []; let cursor: string | null = null;
      for (let page = 0; page < 10; page++) {
        const response = await peer.call('model/list', { cursor, limit: 100, includeHidden: false });
        if (!Array.isArray(response.data)) throw new CliError('cli_protocol_error');
        for (const m of response.data) if (typeof m.model === 'string') models.push({ id: m.model, name: typeof m.displayName === 'string' ? m.displayName : m.model, isDefault: m.isDefault === true });
        cursor = typeof response.nextCursor === 'string' ? response.nextCursor : null; if (!cursor) break;
      }
      return models;
    } finally { await peer.process.stop(); }
  }
  async start(request: RunRequest) {
    if (!request.options.providerConsent) throw new CliError('provider_consent_required');
    const { project, run, signal, emit, options } = request;
    if (signal.aborted) throw new CliError('cancelled');
    let threadId = '', turnId = '', settled = false;
    let finish!: () => void, fail!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
    // Start listening before the first RPC: turn notifications may precede its response.
    void finished.catch(() => {});
    const complete = (error?: Error) => { if (settled) return; settled = true; error ? fail(error) : finish(); };
    const textBuffers = new Map<string, string>();
    const flush = () => { for (const [itemId, text] of textBuffers) { if (text) emit('message.delta', { agent: this.id, itemId, text }); } textBuffers.clear(); };
    const flushTimer = setInterval(flush, 250);
    const peer = new RpcPeer(this.command, ['app-server', '--stdio', '-c', 'analytics.enabled=false', '-c', 'approvals_reviewer="user"'], project.path, message => {
      const p = message.params ?? {};
      if (p.threadId && threadId && p.threadId !== threadId) return;
      if (p.turnId && turnId && p.turnId !== turnId) return;
      if (message.id !== undefined) {
        void (async () => {
          if (!['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(message.method)) {
            emit('input.unsupported', { method: message.method }); peer.unsupported(message.id); return;
          }
          const grant = typeof p.grantRoot === 'string' ? relative(project.path, p.grantRoot) : '';
          if (options.mode === 'read-only' || (p.grantRoot && (grant === '..' || grant.startsWith('../') || isAbsolute(grant)))) {
            emit('approval.blocked', { method: message.method, reason: 'execution_scope' }); peer.respond(message.id, { decision: 'decline' }); return;
          }
          const decision = await request.requestApproval(message.method, { command: p.command ?? null, cwd: p.cwd ?? null, reason: p.reason ?? null, grantRoot: p.grantRoot ?? null, network: p.networkApprovalContext ?? null, itemId: p.itemId });
          peer.respond(message.id, { decision });
        })().catch(() => { peer.respond(message.id, { decision: 'decline' }); complete(new CliError('approval_failed')); });
        return;
      }
      if (message.method === 'item/agentMessage/delta' && typeof p.delta === 'string') textBuffers.set(p.itemId, (textBuffers.get(p.itemId) ?? '') + p.delta);
      if (message.method === 'item/completed' && p.item) {
        const item = p.item;
        if (item.type === 'agentMessage' && typeof item.text === 'string') { flush(); emit('message', { agent: this.id, itemId: item.id, text: item.text }); }
        else if (item.type === 'fileChange') emit('files.changed', { changes: item.changes, status: item.status });
        else if (item.type === 'commandExecution') emit('command.completed', { command: item.command, exitCode: item.exitCode, status: item.status, output: typeof item.aggregatedOutput === 'string' ? item.aggregatedOutput.slice(-16000) : null });
      }
      if (message.method === 'turn/completed') {
        if (p.turn?.status === 'completed') complete();
        else complete(new CliError(p.turn?.status === 'interrupted' ? 'cancelled' : classifyError(JSON.stringify(p.turn?.error ?? {}))));
      }
      if (message.method === 'error') emit('provider.error', { code: classifyError(JSON.stringify(p.error ?? {})), retrying: p.willRetry === true, detail: safeDiagnostic(p.error?.message), info: p.error?.codexErrorInfo ?? null });
    }, complete);
    const abort = () => { complete(new CliError('cancelled')); if (threadId && turnId) void peer.call('turn/interrupt', { threadId, turnId }).catch(() => {}); void peer.process.stop(); };
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { complete(new CliError('run_timeout')); void peer.process.stop(); }, 15 * 60 * 1000);
    try {
      await peer.call('initialize', { clientInfo: { name: 'agentdock', title: 'AgentDock', version: '0.3.0' }, capabilities: {} }); peer.notify('initialized');
      const sandbox = options.mode === 'workspace-write' ? 'workspace-write' : 'read-only';
      const thread = await peer.call('thread/start', { cwd: project.path, ...(run.model ? { model: run.model } : {}), approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox, ephemeral: true });
      threadId = thread.thread?.id;
      if (typeof threadId !== 'string' || !threadId) throw new CliError('cli_protocol_error');
      // Reject a CLI/config that fails to honor the requested security boundary.
      if ((thread.sandbox?.type !== (options.mode === 'workspace-write' ? 'workspaceWrite' : 'readOnly')) || thread.approvalPolicy !== 'on-request' || thread.approvalsReviewer !== 'user') throw new CliError('sandbox_policy_mismatch');
      emit('session.started', { agent: this.id, providerSessionId: threadId, model: thread.model ?? run.model, ephemeral: true });
      if (signal.aborted) throw new CliError('cancelled');
      const sandboxPolicy = options.mode === 'workspace-write' ? { type: 'workspaceWrite', writableRoots: [project.path], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true } : { type: 'readOnly', networkAccess: false };
      const started = await peer.call('turn/start', { threadId, input: [{ type: 'text', text: promptFor(request), text_elements: [] }], approvalPolicy: 'on-request', approvalsReviewer: 'user', sandboxPolicy });
      turnId = started.turn?.id;
      if (typeof turnId !== 'string') throw new CliError('cli_protocol_error');
      await finished;
    } finally {
      clearTimeout(timeout); clearInterval(flushTimer); flush(); signal.removeEventListener('abort', abort); await peer.process.stop();
    }
  }
}
