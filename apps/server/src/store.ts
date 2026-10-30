import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentId, Event, Handoff, Memory, Project, Run, Status, Task } from '../../../packages/core/src/index.ts';
const now = () => new Date().toISOString();
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    const version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version > 1) throw new Error('Database version is newer than this app');
    if (version === 0) this.db.exec(`BEGIN;
      CREATE TABLE projects(id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL);
      CREATE TABLE tasks(id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE runs(id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), agent TEXT NOT NULL, model TEXT, status TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT, providerSessionId TEXT, error TEXT);
      CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, taskId TEXT NOT NULL REFERENCES tasks(id), runId TEXT REFERENCES runs(id), type TEXT NOT NULL, data TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE INDEX events_task ON events(taskId, seq);
      CREATE TABLE memories(id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), taskId TEXT REFERENCES tasks(id), content TEXT NOT NULL, source TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE handoffs(id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), targetRunId TEXT NOT NULL REFERENCES runs(id), data TEXT NOT NULL);
      PRAGMA user_version=1; COMMIT;`);
  }
  projects(): Project[] { return this.db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all() as unknown as Project[]; }
  project(id: string): Project { const p = this.db.prepare('SELECT * FROM projects WHERE id=?').get(id); if (!p) throw new Error('Project not found'); return p as unknown as Project; }
  addProject(name: string, path: string): Project {
    const p = { id: randomUUID(), name, path, createdAt: now() };
    this.db.prepare('INSERT INTO projects VALUES(?,?,?,?)').run(p.id, p.name, p.path, p.createdAt); return p;
  }
  tasks(): Task[] { return this.db.prepare('SELECT * FROM tasks ORDER BY updatedAt DESC').all() as unknown as Task[]; }
  task(id: string): Task { const t = this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id); if (!t) throw new Error('Task not found'); return t as unknown as Task; }
  addTask(input: { projectId: string; title: string; goal: string }): Task {
    this.project(input.projectId);
    const t: Task = { ...input, id: randomUUID(), status: 'draft', createdAt: now(), updatedAt: now() };
    this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?)').run(t.id, t.projectId, t.title, t.goal, t.status, t.createdAt, t.updatedAt);
    this.event(t.id, null, 'task.created', { title: t.title, goal: t.goal }); return t;
  }
  rename(id: string, title: string) { this.task(id); this.db.prepare('UPDATE tasks SET title=?, updatedAt=? WHERE id=?').run(title, now(), id); this.event(id, null, 'task.renamed', { title }); return this.task(id); }
  status(id: string, status: Status) { this.db.prepare('UPDATE tasks SET status=?,updatedAt=? WHERE id=?').run(status, now(), id); }
  runs(taskId: string): Run[] { return this.db.prepare('SELECT * FROM runs WHERE taskId=? ORDER BY startedAt').all(taskId) as unknown as Run[]; }
  run(id: string): Run { const r = this.db.prepare('SELECT * FROM runs WHERE id=?').get(id); if (!r) throw new Error('Run not found'); return r as unknown as Run; }
  addRun(taskId: string, agent: AgentId, model?: string): Run {
    this.task(taskId);
    const r: Run = { id: randomUUID(), taskId, agent, model: model ?? null, status: 'running', startedAt: now(), endedAt: null, providerSessionId: null, error: null };
    this.db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?,?,?)').run(r.id, taskId, agent, r.model, r.status, r.startedAt, null, null, null);
    this.status(taskId, 'running'); return r;
  }
  finish(id: string, status: Status, error: string | null = null) {
    const run = this.run(id); this.db.prepare('UPDATE runs SET status=?,endedAt=?,error=? WHERE id=?').run(status, now(), error, id); this.status(run.taskId, status);
  }
  event(taskId: string, runId: string | null, type: string, data: Record<string, unknown>): Event {
    const createdAt = now();
    const r = this.db.prepare('INSERT INTO events(taskId,runId,type,data,createdAt) VALUES(?,?,?,?,?)').run(taskId, runId, type, JSON.stringify(data), createdAt);
    return { seq: Number(r.lastInsertRowid), taskId, runId, type, data, createdAt };
  }
  events(taskId: string, after = 0): Event[] {
    return this.db.prepare('SELECT * FROM events WHERE taskId=? AND seq>? ORDER BY seq LIMIT 1000').all(taskId, after).map(row => ({ ...row, data: JSON.parse(row.data as string) })) as unknown as Event[];
  }
  recentResults(taskId: string): Event[] {
    return this.db.prepare("SELECT * FROM events WHERE taskId=? AND type IN ('message','run.completed','run.failed') ORDER BY seq DESC LIMIT 12").all(taskId).reverse().map(row => ({ ...row, data: JSON.parse(row.data as string) })) as unknown as Event[];
  }
  memories(projectId: string, taskId?: string): Memory[] {
    return this.db.prepare('SELECT * FROM memories WHERE projectId=? AND (taskId IS NULL OR taskId=?) ORDER BY updatedAt').all(projectId, taskId ?? null) as unknown as Memory[];
  }
  addMemory(input: { projectId: string; taskId?: string | null; content: string }): Memory {
    this.project(input.projectId);
    if (input.taskId && this.task(input.taskId).projectId !== input.projectId) throw new Error('Memory project mismatch');
    const m: Memory = { ...input, taskId: input.taskId ?? null, id: randomUUID(), source: 'user', updatedAt: now() };
    this.db.prepare('INSERT INTO memories VALUES(?,?,?,?,?,?)').run(m.id, m.projectId, m.taskId, m.content, m.source, m.updatedAt); return m;
  }
  handoff(value: Handoff) { this.db.prepare('INSERT INTO handoffs VALUES(?,?,?,?)').run(value.id, value.taskId, value.targetRunId, JSON.stringify(value)); }
  handoffs(taskId: string): Handoff[] { return this.db.prepare('SELECT data FROM handoffs WHERE taskId=? ORDER BY rowid').all(taskId).map(row => JSON.parse(row.data as string)); }
  recover() {
    for (const row of this.db.prepare("SELECT id,taskId FROM runs WHERE status IN ('running','queued','awaiting_approval')").all()) {
      this.finish(row.id as string, 'failed', 'interrupted_by_restart');
      this.event(row.taskId as string, row.id as string, 'run.interrupted', { reason: 'interrupted_by_restart', automaticallyRetried: false });
    }
  }
  close() { this.db.close(); }
}
