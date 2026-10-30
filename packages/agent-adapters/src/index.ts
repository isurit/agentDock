import { setTimeout } from 'node:timers/promises';
import type { AgentAdapter, AgentId, Capability, RunRequest } from '../../core/src/index.ts';
import { CodexAdapter } from './codex.ts';
import { HeadlessAdapter } from './headless.ts';
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
export function registry(): Map<AgentId, AgentAdapter> {
  return new Map<AgentId, AgentAdapter>([['mock', new MockAdapter()], ['codex', new CodexAdapter()], ['claude', new HeadlessAdapter('claude')], ['gemini', new HeadlessAdapter('gemini')]]);
}
