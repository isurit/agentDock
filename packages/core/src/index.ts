import { z } from 'zod';
export const agents = ['mock', 'codex', 'claude', 'gemini'] as const;
export type AgentId = typeof agents[number];
export type Status = 'draft' | 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
export interface Project { id: string; name: string; path: string; createdAt: string }
export interface Task { id: string; projectId: string; title: string; goal: string; status: Status; createdAt: string; updatedAt: string }
export interface Run { id: string; taskId: string; agent: AgentId; model: string | null; status: Status; startedAt: string; endedAt: string | null; providerSessionId: string | null; error: string | null }
export interface Event { seq: number; taskId: string; runId: string | null; type: string; data: Record<string, unknown>; createdAt: string }
export interface Memory { id: string; projectId: string; taskId: string | null; content: string; source: 'user'; updatedAt: string }
export interface Handoff { id: string; taskId: string; sourceRunId: string | null; targetRunId: string; goal: string; memories: Memory[]; recentResults: Event[]; createdAt: string }
export interface Capability { id: AgentId; installed: boolean; version: string | null; verified: boolean; mode: string; quota: 'unknown'; reason?: string }
export interface RunRequest { run: Run; project: Project; task: Task; context: Handoff; signal: AbortSignal; emit(type: string, data: Record<string, unknown>): void }
export interface AgentAdapter { id: AgentId; probe(): Promise<Capability>; start(request: RunRequest): Promise<void> }
export const projectInput = z.object({ name: z.string().trim().min(1).max(120), path: z.string().min(1).max(4096) }).strict();
export const taskInput = z.object({ projectId: z.string().uuid(), title: z.string().trim().min(1).max(200), goal: z.string().trim().min(1).max(20000) }).strict();
export const runInput = z.object({ agent: z.enum(['auto', ...agents]), model: z.string().trim().min(1).max(120).optional() }).strict();
export const memoryInput = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid().nullable().optional(), content: z.string().trim().min(1).max(12000) }).strict();
