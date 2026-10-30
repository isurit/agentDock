import type { AgentAdapter, Capability, RunRequest } from '../../core/src/index.ts';
import { CliError, CliProcess, classifyError, inspect, type Command } from './process.ts';
import { promptFor } from './context.ts';
export class HeadlessAdapter implements AgentAdapter {
  constructor(readonly id: 'claude' | 'gemini', private command: Command = { file: id }) {}
  async probe(): Promise<Capability> {
    try {
      const version = (await inspect(this.command, ['--version'])).match(/\b\d+\.\d+\.\d+\b/)?.[0] ?? null;
      const help = await inspect(this.command, ['--help']);
      const required = this.id === 'claude' ? ['--print', '--output-format', '--verbose', '--tools', '--permission-mode', '--strict-mcp-config', '--mcp-config'] : ['--prompt', '--output-format', '--approval-mode'];
      const runnable = required.every(flag => help.includes(flag));
      return { id: this.id, installed: true, version, verified: false, runnable, supportsWrite: runnable, mode: 'headless · company validation required', approvalMode: 'native noninteractive policy; no browser approval bridge', quota: 'unknown', ...(runnable ? {} : { reason: 'unsupported_cli_version' }) };
    } catch { return { id: this.id, installed: false, version: null, verified: false, runnable: false, mode: 'unavailable', quota: 'unknown', reason: 'cli_unavailable' }; }
  }
  async start(request: RunRequest) {
    if (!request.options.providerConsent) throw new CliError('provider_consent_required');
    if (request.signal.aborted) throw new CliError('cancelled');
    const write = request.options.mode === 'workspace-write';
    const args = this.id === 'claude'
      ? ['--print', '--output-format', 'stream-json', '--verbose', '--permission-mode', write ? 'acceptEdits' : 'plan', '--tools', write ? 'Read,Glob,Grep,Edit,Write' : 'Read,Glob,Grep', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}']
      : ['--prompt', 'Follow the AgentDock task and context supplied on stdin.', '--output-format', 'stream-json', '--approval-mode', write ? 'auto_edit' : 'plan'];
    if (request.run.model) args.push('--model', request.run.model);
    let settle!: () => void, reject!: (error: Error) => void, terminal = false, providerFailure = false, anyMessage = false;
    let finalText = '', buffer = '', failureCode = 'provider_reported_failure';
    const finished = new Promise<void>((resolve, fail) => { settle = resolve; reject = fail; }); void finished.catch(() => {});
    const flush = () => { if (buffer) { request.emit('message.delta', { agent: this.id, itemId: request.run.id, text: buffer }); buffer = ''; } };
    const interval = setInterval(flush, 250);
    const cli = new CliProcess(this.command, args, request.project.path, value => {
      const session = value.session_id ?? value.sessionId;
      if ((value.type === 'system' || value.type === 'init') && typeof session === 'string') request.emit('session.started', { agent: this.id, providerSessionId: session, model: value.model ?? request.run.model });
      if (this.id === 'gemini' && value.type === 'message' && value.role === 'assistant' && typeof value.content === 'string') { buffer += value.content; finalText += value.content; anyMessage = true; }
      if (this.id === 'claude' && value.type === 'assistant' && Array.isArray(value.message?.content)) {
        for (const part of value.message.content) if (part.type === 'text' && typeof part.text === 'string') { buffer += part.text; anyMessage = true; }
      }
      if (value.type === 'tool_use' || value.type === 'tool_result') request.emit('tool.status', { agent: this.id, tool: value.tool_name ?? value.tool_type ?? null, status: value.status ?? value.type });
      if (value.type === 'error') { const code = classifyError(JSON.stringify(value.error ?? value)); request.emit('provider.error', { code }); providerFailure = true; failureCode = code; }
      if (value.type === 'result') {
        terminal = true;
        providerFailure ||= value.is_error === true || value.status === 'error' || !!value.error || (Array.isArray(value.permission_denials) && value.permission_denials.length > 0);
        if (Array.isArray(value.permission_denials) && value.permission_denials.length) { failureCode = 'permission_required'; request.emit('provider.error', { code: 'permission_required', browserBridge: false }); }
        if (typeof value.result === 'string') finalText = value.result;
        if (typeof value.response === 'string') finalText = value.response;
      }
    }, reject);
    const abort = () => { reject(new CliError('cancelled')); void cli.stop(); };
    request.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { reject(new CliError('run_timeout')); void cli.stop(); }, 15 * 60 * 1000);
    void cli.exited.then(({ code }) => {
      flush();
      if (code !== 0 || providerFailure) { reject(new CliError(classifyError(cli.stderr) === 'cli_failed' && providerFailure ? failureCode : classifyError(cli.stderr))); return; }
      if (!terminal) { reject(new CliError('cli_missing_result')); return; }
      if (finalText) request.emit('message', { agent: this.id, itemId: request.run.id, text: finalText });
      else if (!anyMessage) { reject(new CliError('cli_empty_result')); return; }
      settle();
    });
    // Prompts stay out of process arguments and shell history.
    cli.child.stdin.end(promptFor(request));
    request.emit('cli.policy', { agent: this.id, mode: request.options.mode, browserApprovals: false, note: 'Native CLI noninteractive restrictions apply. Unavailable permissions fail; no yolo or bypass flags are used.' });
    try { await finished; }
    finally { clearInterval(interval); clearTimeout(timeout); request.signal.removeEventListener('abort', abort); await cli.stop(); }
  }
}
