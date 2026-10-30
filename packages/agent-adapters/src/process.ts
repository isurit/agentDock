import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
export interface Command { file: string; args?: string[] }
export class CliError extends Error { constructor(readonly code: string) { super(code); } }
export function safeDiagnostic(value: unknown): string {
  return String(value ?? '').replace(/(?:sk-|gh[pousr]_)[A-Za-z0-9_-]+/g, '[credential]').replace(/Bearer\s+\S+/gi, '[credential]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[account]').replace(/\/(?:Users|home|private|var)\/[^\s"']+/g, '[local path]').slice(0, 1200);
}
export function classifyError(value: string): string {
  if (/model.*(?:not supported|not found|does not exist|unavailable)/i.test(value)) return 'model_unavailable';
  if (/quota|usage.?limit|rate.?limit|429|exhausted/i.test(value)) return 'usage_limit';
  if (/auth|oauth|login|sign.?in|401|403|credential/i.test(value)) return 'authentication_required';
  if (/permission|approval|not allowed|denied|not trusted/i.test(value)) return 'permission_required';
  if (/network|connect|ENOTFOUND|fetch failed|timeout/i.test(value)) return 'connection_failed';
  return 'cli_failed';
}
export function cliEnvironment() {
  const env = { ...process.env };
  // Existing CLI-managed OAuth only; avoid accidental API-key billing from inherited shells.
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete env[key];
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  return env;
}
export async function inspect(command: Command, args: string[]) {
  return (await promisify(execFile)(command.file, [...(command.args ?? []), ...args], { timeout: 7000, maxBuffer: 262144, env: cliEnvironment() })).stdout;
}
export class CliProcess {
  child: ChildProcessWithoutNullStreams;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  stderr = '';
  private stopped?: Promise<void>;
  constructor(command: Command, args: string[], cwd: string, line: (value: Record<string, any>) => void, failure: (error: Error) => void) {
    this.child = spawn(command.file, [...(command.args ?? []), ...args], { cwd, shell: false, detached: process.platform !== 'win32', stdio: 'pipe', env: cliEnvironment() });
    let pending = '', bytes = 0;
    this.child.stdout.setEncoding('utf8'); this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => { this.stderr = (this.stderr + chunk).slice(-32768); });
    this.child.stdin.on('error', () => failure(new CliError('cli_transport_closed')));
    this.child.stdout.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk); pending += chunk;
      if (bytes > 32 * 1024 * 1024 || Buffer.byteLength(pending) > 2 * 1024 * 1024) { failure(new CliError('cli_output_limit')); void this.stop(); return; }
      for (;;) {
        const index = pending.indexOf('\n'); if (index < 0) break;
        const raw = pending.slice(0, index).trim(); pending = pending.slice(index + 1); if (!raw) continue;
        try { const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); line(value); }
        catch { failure(new CliError('cli_protocol_error')); void this.stop(); return; }
      }
    });
    this.exited = new Promise(resolve => {
      this.child.once('error', () => { failure(new CliError('cli_unavailable')); resolve({ code: null, signal: null }); });
      this.child.once('close', (code, signal) => { if (pending.trim()) failure(new CliError('cli_protocol_error')); resolve({ code, signal }); });
    });
  }
  send(value: unknown) { if (!this.child.stdin.destroyed) this.child.stdin.write(JSON.stringify(value) + '\n'); }
  stop() {
    if (this.stopped) return this.stopped;
    this.stopped = (async () => {
      const pid = this.child.pid;
      const kill = (signal: NodeJS.Signals) => { if (!pid) return; try { process.platform === 'win32' ? this.child.kill(signal) : process.kill(-pid, signal); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e; } };
      kill('SIGTERM');
      // Descendants may survive a cooperative parent exit; always finish the owned process group.
      await delay(300); kill('SIGKILL'); await this.exited;
    })();
    return this.stopped;
  }
}
export class RpcPeer {
  process: CliProcess;
  private nextId = 0;
  private pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  failure?: Error;
  constructor(command: Command, args: string[], cwd: string, receive: (message: Record<string, any>) => void, failed: (error: Error) => void) {
    const fail = (error: Error) => { if (this.failure) return; this.failure = error; for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); } this.pending.clear(); failed(error); };
    this.process = new CliProcess(command, args, cwd, message => {
      if (typeof message.method === 'string') { receive(message); return; }
      const p = this.pending.get(message.id); if (!p) return;
      this.pending.delete(message.id); clearTimeout(p.timer);
      message.error ? p.reject(new CliError(classifyError(JSON.stringify(message.error)))) : p.resolve(message.result);
    }, fail);
    void this.process.exited.then(() => fail(new CliError(classifyError(this.process.stderr))));
  }
  call(method: string, params: unknown): Promise<any> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new CliError('cli_rpc_timeout')); }, 30000);
      this.pending.set(id, { resolve, reject, timer }); this.process.send({ id, method, params });
    });
  }
  notify(method: string) { this.process.send({ method, params: {} }); }
  respond(id: unknown, result: unknown) { this.process.send({ id, result }); }
  unsupported(id: unknown) { this.process.send({ id, error: { code: -32601, message: 'AgentDock does not support this request' } }); }
}
