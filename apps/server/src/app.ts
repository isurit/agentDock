import express from 'express';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { projectInput, taskInput, runInput, memoryInput } from '../../../packages/core/src/index.ts';
import { registerPath, gitSnapshot } from '../../../packages/project/src/index.ts';
import { registry } from '../../../packages/agent-adapters/src/index.ts';
import { Orchestrator } from '../../../packages/orchestrator/src/index.ts';
import { Store } from './store.ts';
export function createApp(databasePath: string) {
  const store = new Store(databasePath); store.recover();
  const app = express(), server = createServer(app);
  const token = randomBytes(32).toString('hex');
  const equals = (value: unknown) => typeof value === 'string' && value.length === token.length && timingSafeEqual(Buffer.from(value), Buffer.from(token));
  const ws = new WebSocketServer({ noServer: true, maxPayload: 4096, handleProtocols: () => 'agentdock' });
  const adapters = registry();
  const orchestrator = new Orchestrator(store, adapters, event => {
    const message = JSON.stringify({ type: 'invalidate', taskId: event.taskId, seq: event.seq });
    for (const client of ws.clients) if (client.readyState === WebSocket.OPEN) client.send(message);
  });
  let origin = '';
  server.on('listening', () => { const address = server.address(); if (address && typeof address !== 'string') origin = `http://127.0.0.1:${address.port}`; });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') res.setHeader('Content-Security-Policy', `default-src 'self'; connect-src 'self' ${origin.replace('http:', 'ws:')}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (!origin || req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') { res.status(403).json({ error: 'Origin rejected' }); return; }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/bootstrap', (_req, res) => res.json({ token, policy: 'local-only', externalExecution: false }));
  app.use('/api', (req, res, next) => { if (!equals(req.headers['x-agentdock-token'])) { res.status(401).json({ error: 'Session token required' }); return; } next(); });
  app.get('/api/health', (_req, res) => res.json({ ok: true, policy: 'local-only' }));
  app.get('/api/projects', (_req, res) => res.json(store.projects()));
  app.post('/api/projects', async (req, res) => { const input = projectInput.parse(req.body); res.status(201).json(store.addProject(input.name, await registerPath(input.path))); });
  app.get('/api/projects/:id/git', async (req, res) => {
    const project = store.project(req.params.id);
    try { res.json({ available: true, ...await gitSnapshot(project.path) }); }
    catch { res.json({ available: false, reason: 'Git unavailable, output too large, or project is not the repository root' }); }
  });
  app.get('/api/tasks', (_req, res) => res.json(store.tasks()));
  app.post('/api/tasks', (req, res) => res.status(201).json(store.addTask(taskInput.parse(req.body))));
  app.get('/api/tasks/:id', (req, res) => {
    const task = store.task(req.params.id);
    res.json({ task, runs: store.runs(task.id), memories: store.memories(task.projectId, task.id), handoffs: store.handoffs(task.id) });
  });
  app.patch('/api/tasks/:id', (req, res) => { const { title } = z.object({ title: z.string().trim().min(1).max(200) }).strict().parse(req.body); res.json(store.rename(req.params.id, title)); });
  app.get('/api/tasks/:id/events', (req, res) => {
    store.task(req.params.id);
    const after = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(req.query.after ?? 0);
    res.json(store.events(req.params.id, after));
  });
  app.post('/api/tasks/:id/runs', (req, res) => { const input = runInput.parse(req.body); res.status(201).json(orchestrator.start(req.params.id, input.agent, input.model)); });
  app.post('/api/tasks/:id/cancel', (req, res) => { orchestrator.cancel(req.params.id); res.json({ requested: true }); });
  app.post('/api/memories', (req, res) => res.status(201).json(store.addMemory(memoryInput.parse(req.body))));
  app.get('/api/agents', async (_req, res) => res.json(await Promise.all([...adapters.values()].map(adapter => adapter.probe()))));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input' }); return; }
    const message = error instanceof Error ? error.message : '';
    const known: Record<string, number> = { 'Project not found': 404, 'Task not found': 404, 'Run not found': 404, 'Project already has an active run': 409, 'No active run': 409, external_transfer_forbidden: 403, 'Memory project mismatch': 400, 'Absolute project path required': 400, 'Project directory required': 400 };
    res.status(known[message] ?? 400).json({ error: message in known ? message : 'Local operation failed' });
  });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/events') { if (process.env.NODE_ENV === 'production' || !req.headers['sec-websocket-protocol']?.includes('vite-hmr')) socket.destroy(); return; }
    const protocols = req.headers['sec-websocket-protocol']?.split(',').map(value => value.trim()) ?? [];
    if (req.headers.origin !== origin || req.headers.host !== new URL(origin).host || protocols[0] !== 'agentdock' || !equals(protocols[1])) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    ws.handleUpgrade(req, socket, head, client => { ws.emit('connection', client, req); });
  });
  async function close() { await orchestrator.stop(); for (const client of ws.clients) client.terminate(); ws.close(); await new Promise<void>(resolve => server.close(() => resolve())); store.close(); }
  return { app, server, store, orchestrator, close };
}
