import type { AgentAdapter, Capability, RunRequest } from '../../core/src/index.ts';
import { CliError, CliProcess, classifyError, classifyStderr, inspect, type Command } from './process.ts';
import { promptFor } from './context.ts';
export interface HeadlessTiming { idleMs: number; progressMs: number; cleanupMs: number; totalMs: number }
export const headlessTiming: HeadlessTiming = { idleMs: 180000, progressMs: 15000, cleanupMs: 3000, totalMs: 900000 };
export function timingFromEnvironment(env: NodeJS.ProcessEnv = process.env): HeadlessTiming {
  const seconds = Number(env.AGENTDOCK_CLI_IDLE_TIMEOUT_SECONDS ?? 180);
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 900) throw new Error('AGENTDOCK_CLI_IDLE_TIMEOUT_SECONDS must be an integer from 30 to 900');
  return { ...headlessTiming, idleMs: seconds * 1000 };
}
export class HeadlessAdapter implements AgentAdapter {
  constructor(readonly id: 'claude' | 'gemini', private command: Command = { file: id }, private timing = timingFromEnvironment()) {}
  async probe(): Promise<Capability> {
    let version: string | null = null;
    try {
      version = (await inspect(this.command, ['--version'])).match(/\b\d+\.\d+\.\d+\b/)?.[0] ?? null;
      const help = await inspect(this.command, ['--help']);
      const required = this.id === 'claude' ? ['--print', '--output-format', '--verbose', '--tools', '--permission-mode', '--strict-mcp-config', '--mcp-config'] : ['--prompt', '--output-format', '--approval-mode'];
      const runnable = required.every(flag => help.includes(flag));
      return { id: this.id, installed: true, version, verified: false, runnable, supportsWrite: runnable, mode: 'headless · company validation required', approvalMode: 'native noninteractive policy; no browser approval bridge', quota: 'unknown', ...(runnable ? {} : { reason: 'unsupported_cli_version' }) };
    } catch { return { id: this.id, installed: version !== null, version, verified: false, runnable: false, mode: 'unavailable', quota: 'unknown', reason: version ? 'cli_probe_failed' : 'cli_unavailable' }; }
  }
  async start(request: RunRequest) {
    if (!request.options.providerConsent) throw new CliError('provider_consent_required');
    if (request.signal.aborted) throw new CliError('cancelled');
    const write = request.options.mode === 'workspace-write';
    const args = this.id === 'claude'
      ? ['--print', '--output-format', 'stream-json', '--verbose', '--permission-mode', write ? 'acceptEdits' : 'plan', '--tools', write ? 'Read,Glob,Grep,Edit,Write' : 'Read,Glob,Grep', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}']
      : ['--prompt', 'Follow the AgentDock task and context supplied on stdin.', '--output-format', 'stream-json', '--approval-mode', write ? 'auto_edit' : 'plan'];
    if (request.run.model) args.push('--model', request.run.model);
    const startedAt = Date.now();
    let lastSemanticAt = startedAt, phase = 'starting', terminal = false, settled = false, providerFailure = false, anyMessage = false;
    let finalText = '', buffer = '', failureCode = 'provider_reported_failure', lastDiagnostic = '';
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let resolve!: () => void, reject!: (error: Error) => void;
    const finished = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); void finished.catch(() => {});
    const fail = (error: Error) => { if (settled) return; settled = true; reject(error); };
    const progress = (next: string) => { phase = next; lastSemanticAt = Date.now(); request.emit('cli.progress', { agent: this.id, phase, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) }); };
    const flush = () => { if (buffer) { request.emit('message.delta', { agent: this.id, itemId: request.run.id, text: buffer }); buffer = ''; } };
    const complete = () => {
      if (settled) return;
      flush();
      if (providerFailure) { fail(new CliError(failureCode)); return; }
      if (!terminal) { fail(new CliError('cli_missing_result')); return; }
      if (!anyMessage && !finalText) { fail(new CliError('cli_empty_result')); return; }
      if (finalText) request.emit('message', { agent: this.id, itemId: request.run.id, text: finalText });
      settled = true; resolve();
    };
    const interval = setInterval(flush, 250);
    const cli = new CliProcess(this.command, args, request.project.path, value => {
      if (settled) return;
      const session = value.session_id ?? value.sessionId;
      if ((value.type === 'system' || value.type === 'init') && typeof session === 'string') {
        request.emit('session.started', { agent: this.id, providerSessionId: session, model: value.model ?? request.run.model });
        progress('session_initialized');
      }
      if (this.id === 'gemini' && value.type === 'message' && value.role === 'user') progress('waiting_for_model'); // Do not echo the input/prompt.
      if (this.id === 'gemini' && value.type === 'message' && value.role === 'assistant' && typeof value.content === 'string') {
        if (phase !== 'receiving_response') progress('receiving_response'); lastSemanticAt = Date.now();
        buffer += value.content; finalText += value.content; anyMessage = true;
      }
      if (this.id === 'claude' && value.type === 'assistant' && Array.isArray(value.message?.content)) {
        for (const part of value.message.content) if (part.type === 'text' && typeof part.text === 'string') { progress('receiving_response'); buffer += part.text; finalText += part.text; anyMessage = true; }
      }
      if (value.type === 'tool_use' || value.type === 'tool_result') {
        progress(value.type === 'tool_use' ? 'running_tool' : 'tool_finished');
        request.emit('tool.status', { agent: this.id, tool: value.tool_name ?? value.tool_type ?? null, toolId: value.tool_id ?? null, status: value.status ?? value.type });
        const code = classifyError(JSON.stringify(value.error ?? {}));
        if (value.type === 'tool_result' && value.status === 'error' && code === 'permission_required') { providerFailure = true; failureCode = code; request.emit('provider.error', { code, browserBridge: false }); }
      }
      if (value.type === 'error') {
        const code = classifyError(JSON.stringify(value.error ?? value));
        request.emit(value.severity === 'warning' ? 'provider.warning' : 'provider.error', { code });
        if (value.severity !== 'warning') { providerFailure = true; failureCode = code; }
      }
      if (value.type === 'result') {
        terminal = true; progress('result_received');
        providerFailure ||= value.is_error === true || value.status === 'error' || !!value.error;
        if (value.error || value.is_error) { const code = classifyError(JSON.stringify(value.error ?? value.result ?? '')); if (code !== 'cli_failed') failureCode = code; }
        if (Array.isArray(value.permission_denials) && value.permission_denials.length) { providerFailure = true; failureCode = 'permission_required'; request.emit('provider.error', { code: failureCode, browserBridge: false }); }
        if (typeof value.result === 'string') finalText = value.result;
        if (typeof value.response === 'string') finalText = value.response;
        // Some CLI versions leave background handles open after a terminal result.
        // Preserve the result but do not hold the project lock for 15 minutes.
        clearTimeout(cleanupTimer);
        cleanupTimer = setTimeout(() => { if (!settled) { request.emit('cli.cleanup', { reason: 'terminal_result_process_lingering' }); complete(); } }, this.timing.cleanupMs);
      }
    }, fail);
    const abort = () => { fail(new CliError('cancelled')); void cli.stop(); };
    request.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { fail(new CliError('run_timeout')); void cli.stop(); }, this.timing.totalMs);
    const monitor = setInterval(() => {
      if (settled || terminal) return;
      const code = classifyStderr(cli.stderr);
      if (cli.stderrBytes && code !== lastDiagnostic) {
        lastDiagnostic = code; request.emit('cli.diagnostic', { agent: this.id, code: code === 'cli_failed' ? 'stderr_output_observed' : code, stderrBytes: cli.stderrBytes });
      }
      const idleMs = Date.now() - lastSemanticAt;
      request.emit('cli.waiting', { agent: this.id, phase, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), idleSeconds: Math.floor(idleMs / 1000), transportIdleSeconds: Math.floor((Date.now() - cli.lastTransportAt) / 1000), stdoutBytes: cli.stdoutBytes, stderrBytes: cli.stderrBytes, note: 'No new answer/tool event; process liveness is not model progress.' });
      if (idleMs >= this.timing.idleMs) { fail(new CliError(code === 'cli_failed' ? 'cli_idle_timeout' : code)); void cli.stop(); }
    }, this.timing.progressMs);
    void cli.exited.then(({ code }) => {
      if (settled) return;
      if (code !== 0) { fail(new CliError(classifyStderr(cli.stderr))); return; }
      complete();
    });
    cli.child.stdin.end(promptFor(request));
    progress('input_sent');
    request.emit('cli.policy', { agent: this.id, mode: request.options.mode, browserApprovals: false, idleTimeoutSeconds: this.timing.idleMs / 1000, note: 'Native headless permissions apply; no bypass flags. Session initialization alone is not a model response.' });
    try { await finished; }
    finally { clearInterval(interval); clearInterval(monitor); clearTimeout(timeout); clearTimeout(cleanupTimer); request.signal.removeEventListener('abort', abort); await cli.stop(); }
  }
}
