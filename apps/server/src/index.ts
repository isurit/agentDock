import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.ts';
import { prepareDataDirectory } from './data-dir.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const defaultData = process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'AgentDock') : join(homedir(), '.local', 'share', 'agentdock');
const data = prepareDataDirectory(process.env.AGENTDOCK_DATA_DIR ?? defaultData);
const runtime = createApp(join(data, 'agentdock.sqlite'));
const production = process.env.NODE_ENV === 'production';
let vite: { close(): Promise<void> } | undefined;
if (!production) {
  const { createServer } = await import('vite');
  const dev = await createServer({ configFile: join(root, 'apps/web/vite.config.ts'), server: { middlewareMode: true, hmr: { server: runtime.server } } });
  runtime.app.use(dev.middlewares); vite = dev;
} else {
  runtime.app.use(express.static(join(root, 'dist/web'), { index: 'index.html' }));
  runtime.app.get('/{*path}', (_req, res) => res.sendFile(join(root, 'dist/web/index.html')));
}
const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
runtime.server.listen(port, '127.0.0.1', () => {
  const address = runtime.server.address();
  if (address && typeof address !== 'string') console.log(`AgentDock: http://127.0.0.1:${address.port} (local storage; approved CLI execution)`);
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { if (stopping) return; stopping = true; await vite?.close(); await runtime.close(); });
