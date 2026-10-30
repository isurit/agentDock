// Synthetic CLI protocol fixture. Does not contact a model or read credentials.
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
const [provider, scenario, ...flags] = process.argv.slice(2);
const out = value => process.stdout.write(JSON.stringify(value) + '\n');
if (flags.includes('--version')) { console.log('synthetic 0.154.0'); process.exit(0); }
if (flags.includes('--help')) { console.log('--stdio --print --prompt --output-format --verbose --tools --permission-mode --strict-mcp-config --mcp-config --approval-mode'); process.exit(0); }
if (provider === 'tree') {
  spawn(process.execPath, ['-e', 'const fs=require("node:fs");process.on("SIGTERM",()=>{});setInterval(()=>fs.appendFileSync(process.argv[1],"."),20)', scenario], { stdio: 'ignore' });
  process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);
} else if (provider === 'codex') {
  const lines = createInterface({ input: process.stdin }); let start;
  const finish = decision => {
    out({ method: 'item/completed', params: { threadId: 'thread-synthetic', turnId: 'turn-synthetic', item: { id: 'message-synthetic', type: 'agentMessage', text: JSON.stringify({ decision, received: start.input[0].text, sandbox: start.sandboxPolicy }) } } });
    out({ method: 'turn/completed', params: { threadId: 'thread-synthetic', turn: { id: 'turn-synthetic', status: 'completed' } } });
  };
  lines.on('line', raw => {
    const m = JSON.parse(raw);
    if (m.method === 'model/list') out({ id: m.id, result: { data: [{ model: 'synthetic-model', displayName: 'Synthetic', isDefault: true }], nextCursor: null } });
    if (m.method === 'initialize') out({ id: m.id, result: {} });
    if (m.method === 'thread/start') out({ id: m.id, result: { thread: { id: 'thread-synthetic' }, model: 'synthetic-model', approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: { type: scenario === 'bad-sandbox' ? 'dangerFullAccess' : m.params.sandbox === 'read-only' ? 'readOnly' : 'workspaceWrite' } } });
    if (m.method === 'turn/start') {
      start = m.params; out({ id: m.id, result: { turn: { id: 'turn-synthetic' } } });
      if (scenario === 'hang') return;
      if (scenario === 'approval' || scenario === 'outside') out({ id: 'approval-synthetic', method: 'item/fileChange/requestApproval', params: { threadId: 'thread-synthetic', turnId: 'turn-synthetic', itemId: 'file-synthetic', ...(scenario === 'outside' ? { grantRoot: '/' } : {}) } });
      else if (scenario === 'failed') out({ method: 'turn/completed', params: { threadId: 'thread-synthetic', turn: { id: 'turn-synthetic', status: 'failed', error: { message: 'synthetic usage limit' } } } });
      else finish('none');
    }
    if (m.id === 'approval-synthetic' && m.result) finish(m.result.decision);
  });
} else {
  let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    out({ type: provider === 'gemini' ? 'init' : 'system', session_id: 'headless-synthetic', model: 'synthetic-model' });
    if (provider === 'gemini') out({ type: 'message', role: 'user', content: 'DO_NOT_ECHO_INPUT' });
    if (scenario === 'session-only' || scenario === 'stderr-retry') {
      setInterval(() => { if (scenario === 'stderr-retry') process.stderr.write('ECONNRESET DO_NOT_PERSIST_DIAGNOSTIC_BODY\n'); }, 20); return;
    }
    if (scenario === 'warning') out({ type: 'error', severity: 'warning', message: 'synthetic recoverable warning' });
    if (scenario === 'permission-tool') {
      out({ type: 'tool_use', tool_name: 'run_shell_command', tool_id: 'synthetic-tool' });
      out({ type: 'tool_result', tool_id: 'synthetic-tool', status: 'error', error: { type: 'PERMISSION_DENIED', message: 'Tool approval required' } });
    }
    out(provider === 'gemini' ? { type: 'message', role: 'assistant', content: 'synthetic result' } : { type: 'assistant', message: { content: [{ type: 'text', text: 'synthetic result' }] } });
    if (scenario !== 'missing-result') out({ type: 'result', status: scenario === 'error' ? 'error' : 'success', is_error: scenario === 'error', result: scenario === 'error' ? 'Synthetic failure' : JSON.stringify({ input, flags }), ...(scenario === 'denied' ? { permission_denials: [{ tool_name: 'Edit' }] } : {}) });
    if (scenario === 'terminal-linger') setInterval(() => {}, 1000);
    if (scenario === 'nonzero-after-result') process.exitCode = 1;
  });
}
