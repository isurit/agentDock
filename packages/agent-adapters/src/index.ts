import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import type { AgentAdapter, AgentId, Capability, RunRequest } from '../../core/src/index.ts';
const exec = promisify(execFile);
export class MockAdapter implements AgentAdapter {
  readonly id = 'mock';
  async probe(): Promise<Capability> { return { id: this.id, installed: true, version: '1', verified: true, mode: 'local simulation', quota: 'unknown' }; }
  async start({ task, context, signal, emit }: RunRequest) {
    emit('message', { text: 'MOCK · 로컬 시뮬레이션입니다. 모델 호출이나 파일 수정은 수행하지 않습니다.' });
    await setTimeout(350, undefined, { signal });
    emit('context.received', { handoffId: context.id, memories: context.memories.length, previousResults: context.recentResults.length });
    await setTimeout(350, undefined, { signal });
    emit('message', { text: `작업 목표: ${task.goal}\n인계된 기억 ${context.memories.length}개, 이전 결과 ${context.recentResults.length}개를 로컬에서 확인했습니다.\n다음 단계: 사용자 검토. 실제 분석·테스트 결과는 생성하지 않았습니다.` });
  }
}
export class LocalOnlyCliAdapter implements AgentAdapter {
  constructor(readonly id: Exclude<AgentId, 'mock'>) {}
  async probe(): Promise<Capability> {
    try {
      const { stdout } = await exec(this.id, ['--version'], { timeout: 5000, maxBuffer: 16384 });
      // Keep only a numeric version. Never persist arbitrary CLI diagnostic output.
      const version = stdout.match(/\b\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*/)?.[0] ?? null;
      return { id: this.id, installed: true, version, verified: false, mode: 'blocked by external-transfer policy', quota: 'unknown', reason: 'external_transfer_forbidden' };
    } catch { return { id: this.id, installed: false, version: null, verified: false, mode: 'unavailable', quota: 'unknown', reason: 'cli_unavailable' }; }
  }
  async start(_request: RunRequest): Promise<void> { throw new Error('external_transfer_forbidden'); }
}
export function registry(): Map<AgentId, AgentAdapter> {
  return new Map<AgentId, AgentAdapter>([['mock', new MockAdapter()], ...(['codex', 'claude', 'gemini'] as const).map(id => [id, new LocalOnlyCliAdapter(id)] as [AgentId, AgentAdapter])]);
}
