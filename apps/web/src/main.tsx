import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Approval, Capability, Event, Handoff, Memory, Project, Run, Task } from '../../../packages/core/src/index.ts';
import { timelineEvents, createRefreshQueue } from '../../../packages/core/src/timeline.ts';
import './style.css';
type Detail = { task: Task; runs: Run[]; memories: Memory[]; handoffs: Handoff[]; approvals: Approval[] };
type GitHistory = { available: boolean; commits: { hash: string; subject: string }[]; reason?: string };
const phaseNames: Record<string, string> = { starting: 'CLI 시작 중', input_sent: '입력 전달 완료', session_initialized: 'CLI 세션 생성 · 모델 응답은 아직 확인되지 않음', waiting_for_model: '요청 처리 · 모델 응답 대기', receiving_response: '응답 수신 중', running_tool: 'CLI 도구 실행 중', tool_finished: '도구 결과 수신', result_received: '최종 결과 수신 · 프로세스 정리 중' };
const errorNames: Record<string, string> = { cli_idle_timeout: '설정한 시간 동안 답변·도구 이벤트가 없어 중단했습니다.', connection_failed: 'CLI에서 연결 오류 또는 재시도 신호가 관찰됐습니다.', permission_required: '비대화형 CLI가 필요한 도구 권한을 얻지 못했습니다.', authentication_required: '같은 OS 계정의 CLI 로그인을 확인하세요.', model_unavailable: '계정에서 사용할 수 있는 모델을 명시적으로 선택하세요.', git_history_unavailable: '등록 경로가 Git 루트인지, 커밋이 존재하는지 확인하세요.' };
type Git = { available: boolean; status?: string; diff?: string; staged?: string; reason?: string };
const statuses: Record<string, string> = { draft: '준비', running: '실행 중', completed: '완료', failed: '실패 / 중단', cancelled: '취소', queued: '대기', awaiting_approval: '승인 대기' };
function App() {
  const [token, setToken] = useState(''), [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]), [tasks, setTasks] = useState<Task[]>([]), [agents, setAgents] = useState<Capability[]>([]);
  const [projectId, setProjectId] = useState(''), [taskId, setTaskId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null), [events, setEvents] = useState<Event[]>([]), [git, setGit] = useState<Git | null>(null);
  const [panel, setPanel] = useState('timeline'), [connection, setConnection] = useState('연결 중'), [agent, setAgent] = useState('auto');
  const [history, setHistory] = useState<GitHistory | null>(null), [includeGitHistory, setIncludeGitHistory] = useState(false), [clock, setClock] = useState(Date.now());
  const [models, setModels] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
  const [mode, setMode] = useState('read-only'), [providerConsent, setProviderConsent] = useState(false), [model, setModel] = useState(''), [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false), [projectForm, setProjectForm] = useState(false), [taskForm, setTaskForm] = useState(false);
  const revision = useRef(0);
  const refreshQueue = useRef(createRefreshQueue());
  const api = useCallback(async <T,>(path: string, body?: unknown, method = 'POST'): Promise<T> => {
    const res = await fetch('/api' + path, { method: body === undefined ? 'GET' : method, headers: { 'Content-Type': 'application/json', 'X-AgentDock-Token': token }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await res.json(); if (!res.ok) throw new Error(value.error ?? '요청 실패'); return value;
  }, [token]);
  useEffect(() => { fetch('/api/bootstrap').then(res => res.json()).then(value => setToken(value.token)).catch(() => setError('서버에 연결할 수 없습니다.')); }, []);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    const [ps, ts] = await Promise.all([api<Project[]>('/projects'), api<Task[]>('/tasks')]);
    let d: Detail | null = null; const es: Event[] = [];
    if (taskId) {
      d = await api<Detail>('/tasks/' + taskId);
      let after = 0;
      for (;;) { const page = await api<Event[]>(`/tasks/${taskId}/events?after=${after}`); es.push(...page); if (page.length < 1000) break; after = page.at(-1)!.seq; }
    }
    if (current !== revision.current) return;
    setProjects(ps); setTasks(ts); setDetail(d); setEvents(es);
    setProjectId(value => value || ps[0]?.id || '');
  }, [api, taskId]);
  const load = useCallback(() => refreshQueue.current(refresh), [refresh]);
  useEffect(() => { if (token) load().catch(e => setError(e.message)); return () => { revision.current++; }; }, [token, load]);
  useEffect(() => { if (token) api<Capability[]>('/agents').then(setAgents).catch(e => setError(e.message)); }, [api, token]);
  useEffect(() => {
    if (!token) return;
    let socket: WebSocket, timer: ReturnType<typeof setTimeout>, stopped = false;
    const connect = () => {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/events`, ['agentdock', token]);
      socket.onopen = () => { setConnection('실시간 연결'); load().catch(e => setError(e.message)); };
      socket.onmessage = () => load().catch(e => setError(e.message));
      socket.onclose = () => { setConnection('재연결 중'); if (!stopped) timer = setTimeout(connect, 1500); };
      socket.onerror = () => socket.close();
    };
    connect(); return () => { stopped = true; clearTimeout(timer); socket?.close(); };
  }, [token, load]);
  useEffect(() => { setGit(null); setHistory(null); setIncludeGitHistory(false); }, [projectId, taskId]);
  useEffect(() => {
    setModels([]); if (!token || agent !== 'codex' || !projectId) return;
    let disposed = false;
    api<{ id: string; name: string; isDefault: boolean }[]>(`/projects/${projectId}/codex-models`).then(values => { if (!disposed) setModels(values); }).catch(() => {});
    return () => { disposed = true; };
  }, [api, token, agent, projectId]);
  useEffect(() => { setProviderConsent(false); }, [taskId, projectId, agent, mode]);
  useEffect(() => { setInstruction(''); }, [taskId, projectId]);
  const action = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : '작업 실패'); } finally { setBusy(false); } };
  const selectedProject = projects.find(p => p.id === projectId);
  const visibleTasks = tasks.filter(t => t.projectId === projectId);
  const running = ['running', 'awaiting_approval', 'queued'].includes(detail?.task.status ?? '');
  const realAgent = !['auto', 'mock'].includes(agent);
  const selectedCapability = agents.find(a => a.id === agent);
  const visibleEvents = timelineEvents(events);
  const latestRun = detail?.runs.at(-1);
  const latestProgress = [...events].reverse().find(e => e.runId === latestRun?.id && ['cli.progress', 'cli.waiting'].includes(e.type));
  const latestDiagnostic = [...events].reverse().find(e => e.runId === latestRun?.id && ['cli.diagnostic', 'provider.error'].includes(e.type));
  useEffect(() => { if (!running) return; const timer = setInterval(() => setClock(Date.now()), 1000); const poll = setInterval(() => { load().catch(e => setError(e.message)); }, 5000); return () => { clearInterval(timer); clearInterval(poll); }; }, [running, load]);
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/"> <span className="brandmark">A</span><span>AgentDock<small>LOCAL DEVELOPMENT WORKSPACE</small></span></a>
      <div className="section-title">PROJECTS <button aria-label="프로젝트 등록" onClick={() => setProjectForm(v => !v)}>＋</button></div>
      {projects.map(p => <button key={p.id} className={'project ' + (p.id === projectId ? 'selected' : '')} onClick={() => { setProjectId(p.id); setTaskId(''); setDetail(null); setTaskForm(false); setProviderConsent(false); }}>▣ <span>{p.name}</span><span className="count">{tasks.filter(t => t.projectId === p.id).length}</span></button>)}
      {!projects.length && <p className="hint">로컬 프로젝트를 등록해 시작하세요.</p>}
      <div className="section-title">TASKS <button aria-label="새 작업" disabled={!projectId} onClick={() => setTaskForm(v => !v)}>＋</button></div>
      {visibleTasks.map(t => <button className={'task-link ' + (taskId === t.id ? 'selected' : '')} key={t.id} onClick={() => { setTaskId(t.id); setProviderConsent(false); setPanel('timeline'); setTaskForm(false); }}><span className={'dot ' + t.status}/><span>{t.title}</span></button>)}
      {!visibleTasks.length && <p className="hint">아직 작업이 없습니다.</p>}
      <div className="sidebar-footer"><span className="green-dot"/>각 PC에만 저장<small>GitHub에 회사 코드·실행 기록 업로드 금지</small></div>
    </aside>
    <main>
      <header><div className="breadcrumb">Workspace <span>/</span> {selectedProject?.name ?? '시작하기'}</div><span className="connection"><span className="green-dot"/>{connection}</span></header>
      <div className="content">
        <div className="privacy"><span>⌾</span><div><strong>Private local workspace</strong><p>기록은 이 PC에 보관합니다. 선택한 승인 CLI는 작업 코드·Context를 해당 공급자에게 전달할 수 있습니다.</p></div><span className="badge">LOCAL STORAGE</span></div>
        {error && <div role="alert" className="error">{error}<button onClick={() => setError('')} aria-label="오류 닫기">×</button></div>}
        {projectForm && <form className="card form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { const p = await api<Project>('/projects', { name: f.get('name'), path: f.get('path') }); setProjectId(p.id); setTaskId(''); setProjectForm(false); await load(); }); }}>
          <h2>로컬 프로젝트 등록</h2><label>프로젝트 이름<input name="name" required maxLength={120} placeholder="Android sample"/></label><label>이 PC의 절대경로<input name="path" required placeholder="로컬 Git 프로젝트 루트"/></label><p className="hint">소스를 복사하지 않습니다. 경로는 로컬 DB에만 저장합니다.</p><div><button className="primary" disabled={busy}>등록</button> <button type="button" onClick={() => setProjectForm(false)}>닫기</button></div>
        </form>}
        {taskForm && <form className="card form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { const t = await api<Task>('/tasks', { projectId, title: f.get('title'), goal: f.get('goal') }); setTaskId(t.id); setTaskForm(false); await load(); }); }}><h2>새 작업</h2><label>제목<input name="title" required maxLength={200} placeholder="이번 작업의 이름"/></label><label>목표<textarea name="goal" required maxLength={20000} placeholder="목표와 완료 기준을 적어주세요."/></label><div><button className="primary" disabled={busy}>작업 만들기</button> <button type="button" onClick={() => setTaskForm(false)}>닫기</button></div></form>}
        {!detail ? <section className="welcome"><div className="eyebrow">YOUR WORK, ONE CONTINUOUS THREAD</div><h1>작업의 맥락을<br/>한곳에 모으세요.</h1><p>프로젝트를 선택하고 목표를 기록하세요.<br/>실행 기록과 기억은 Task 안에서 이어집니다.</p><button className="primary" onClick={() => projectId ? setTaskForm(true) : setProjectForm(true)}>{projectId ? '＋ 새 작업 만들기' : '＋ 프로젝트 등록'}</button><div className="overview">{[['PROJECTS', projects.length], ['TASKS', tasks.length], ['COMPLETED', tasks.filter(t => t.status === 'completed').length]].map(([label, count]) => <div key={label}><small>{label}</small><strong>{count}</strong></div>)}</div></section> : <>
          <div className="task-heading"><div><div className="eyebrow">TASK · {detail.task.id.slice(0, 8)}</div><h1>{detail.task.title}</h1><p>{detail.task.goal}</p></div><span className={'status ' + detail.task.status}>{statuses[detail.task.status]}</span></div>
          <div className="toolbar">
            <label>Runtime <select aria-label="Runtime" value={agent} disabled={busy || running} onChange={e => { setAgent(e.target.value); setProviderConsent(false); setMode('read-only'); setModel(''); }}>
              <option value="auto">Auto · Mock 기본값</option><option value="mock">Mock · 시뮬레이션</option>
              {agents.filter(a => a.id !== 'mock').map(a => <option key={a.id} value={a.id} disabled={!a.runnable}>{a.id} · {a.runnable ? '실제 CLI' : a.installed ? '옵션 미지원' : '설치 필요'}</option>)}
            </select></label>
            {realAgent && <><label>권한 <select aria-label="권한" value={mode} disabled={busy || running} onChange={e => setMode(e.target.value)}><option value="read-only">읽기 전용 분석</option><option value="workspace-write">프로젝트 수정 허용</option></select></label><label>모델<input aria-label="모델 ID" value={model} onChange={e => setModel(e.target.value)} placeholder="CLI 기본 모델" list="cli-models" maxLength={120} disabled={busy || running}/></label><datalist id="cli-models">{models.map(m => <option key={m.id} value={m.id}>{m.name}{m.isDefault ? " · 기본" : ""}</option>)}</datalist></>}
            <button className="primary" disabled={busy || running || (realAgent && (!providerConsent || !selectedCapability?.runnable))} onClick={() => void action(async () => { await api(`/tasks/${taskId}/runs`, { agent, ...(model.trim() ? { model: model.trim() } : {}), mode, providerConsent, includeGitHistory, ...(instruction.trim() ? { instruction: instruction.trim() } : {}) }); setInstruction(''); setProviderConsent(false); await load(); })}>▶ {realAgent ? agent + ' 실행' : 'Mock 실행'}</button>
            <button disabled={!running || busy} onClick={() => void action(async () => { await api(`/tasks/${taskId}/cancel`, {}); await load(); })}>중단</button>
          </div>
          <div className="run-input"><label className="consent"><input type="checkbox" checked={includeGitHistory} disabled={busy || running} onChange={e => { setIncludeGitHistory(e.target.checked); setProviderConsent(false); }}/>최근 Git 이력 10개(해시·제목)를 이번 실행 Context에 포함</label><p className="hint">CLI shell 승인 없이 이력을 참고할 수 있습니다. 선택한 실제 공급자로 전달될 수 있습니다.</p><label>이번 실행 지시 (선택)<textarea value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={20000} disabled={busy || running} placeholder="추가 지시 또는 다음 Agent가 이어서 할 일을 입력하세요."/></label>
            {realAgent ? <><label className="consent"><input type="checkbox" checked={providerConsent} disabled={busy || running} onChange={e => setProviderConsent(e.target.checked)}/>이 PC의 회사 승인 {agent} CLI와 기존 로그인을 사용하며, 작업 코드·파일 경로·이 프로젝트와 Task의 Memory·최근 결과가 해당 공급자로 전달될 수 있음에 동의합니다.</label><p className="hint">{mode === 'workspace-write' ? '프로젝트 수정 실행을 승인합니다. Codex는 프로젝트 범위 내 파일 수정·명령을 허용하고 추가 권한 요청을 표시합니다. Claude/Gemini는 native 편집 정책을 사용합니다.' : '읽기 전용 분석으로 시작합니다. CLI별 native 정책을 적용합니다.'} {agent === 'codex' && '모델 입력란에서 CLI 목록을 선택할 수 있습니다. 기본 모델이 계정에서 거부되면 model_unavailable로 표시하며 자동 대체하지 않습니다.'} {agent !== 'codex' && 'Claude/Gemini는 브라우저 승인 연결 및 회사 실연동 검증이 아직 필요합니다. 권한 대기는 우회하지 않습니다.'}</p></> : <p className="hint">Mock은 모델 호출·파일 수정 없이 로컬 실행 흐름만 시뮬레이션합니다.</p>}
          </div>
          {latestRun && <section className="execution-state" aria-label="실행 상태" aria-live="polite"><strong>{running ? phaseNames[String(latestProgress?.data.phase)] ?? '실행 준비 중' : statuses[latestRun.status]}</strong>{running && <span>경과 {Math.max(0, Math.floor((clock - Date.parse(latestRun.startedAt)) / 1000))}초 · {latestProgress ? `마지막 상태 갱신 ${Math.max(0, Math.floor((clock - Date.parse(latestProgress.createdAt)) / 1000))}초 전` : '첫 상태 대기'}</span>}{latestDiagnostic && <p>{errorNames[String(latestDiagnostic.data.code)] ?? String(latestDiagnostic.data.code)}</p>}{latestRun.error && <p>{errorNames[latestRun.error] ?? latestRun.error} 자동 재실행하지 않습니다.</p>}</section>}
          {!!detail.approvals?.length && <section className="card approval-panel" aria-label="실행 승인 요청"><h2>추가 권한 승인 대기</h2>{detail.approvals.map(a => <article key={a.id}><strong>{a.method}</strong><pre>{JSON.stringify(a.details, null, 2)}</pre><button disabled={busy} onClick={() => void action(async () => { await api(`/tasks/${taskId}/approvals/${a.id}`, { decision: 'accept' }); await load(); })}>이번 요청 승인</button> <button disabled={busy} onClick={() => void action(async () => { await api(`/tasks/${taskId}/approvals/${a.id}`, { decision: 'decline' }); await load(); })}>거절</button></article>)}</section>}
          <nav className="tabs">{[['timeline', '타임라인'], ['memory', 'Memory'], ['git', 'Git Diff'], ['history', 'Git History'], ['runs', '실행 / Context'], ['settings', '작업 설정']].map(([id, title]) => <button className={panel === id ? 'active' : ''} key={id} onClick={() => { setPanel(id); if (id === 'git') void action(async () => setGit(await api<Git>(`/projects/${projectId}/git`))); if (id === 'history') void action(async () => setHistory(await api<GitHistory>(`/projects/${projectId}/history`))); }}>{title}</button>)}</nav>
          {panel === 'timeline' && <section className="timeline">{visibleEvents.map(event => <article className="event" key={event.seq}><span className="event-icon">{event.type.startsWith('message') ? 'A' : '•'}</span><div><div className="event-meta"><strong>{event.type.startsWith('message') ? String(event.data.agent ?? detail.runs.find(r => r.id === event.runId)?.agent ?? 'mock') + ' Agent' : event.type}</strong><time>{new Date(event.createdAt).toLocaleTimeString()}</time><span>#{event.seq}</span></div>{event.type.startsWith('message') ? <p>{String(event.data.text)}</p> : <pre>{JSON.stringify(event.data, null, 2)}</pre>}</div></article>)}</section>}
          {panel === 'memory' && <section className="card"><h2>사용자가 확정한 기억</h2><p className="hint">Project 기억은 같은 프로젝트의 작업에, Task 기억은 이 작업의 다음 실행에 인계됩니다.</p>{detail.memories.map(m => <article className="memory" key={m.id}><span className="badge">{m.taskId ? 'TASK' : 'PROJECT'}</span><p>{m.content}</p></article>)}<form className="form" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void action(async () => { await api('/memories', { projectId, taskId: f.get('scope') === 'task' ? taskId : null, content: f.get('content') }); form.reset(); await load(); }); }}><label>기억할 내용<textarea name="content" required maxLength={12000}/></label><label>범위<select name="scope"><option value="task">현재 Task</option><option value="project">현재 Project</option></select></label><button className="primary" disabled={busy}>기억 저장</button></form></section>}
          {panel === 'git' && <section className="card"><h2>이 PC의 Git 변경사항</h2><p className="hint">로컬 조회 전용 · 외부 전송 없음 · 미추적 파일은 목록만 표시</p><button onClick={() => void action(async () => setGit(await api<Git>(`/projects/${projectId}/git`)))}>새로고침</button>{git?.available ? <><h3>Status</h3><pre>{git.status || '변경사항 없음'}</pre><h3>Working tree</h3><pre>{git.diff || '추적 파일 변경 없음'}</pre><h3>Staged</h3><pre>{git.staged || 'Staged 변경 없음'}</pre></> : <p>{git?.reason ?? '조회 중…'}</p>}</section>}
          {panel === 'history' && <section className="card"><h2>최근 Git 이력 · 로컬 조회</h2><p className="hint">등록한 프로젝트의 현재 HEAD 기준 최근 10개 커밋입니다. 해시와 제목만 표시합니다.</p><button onClick={() => void action(async () => setHistory(await api<GitHistory>(`/projects/${projectId}/history`)))}>새로고침</button>{history?.available ? history.commits.map(commit => <article className="memory" key={commit.hash}><code>{commit.hash}</code><p>{commit.subject}</p></article>) : <p>{history?.reason ?? '조회 중…'}</p>}</section>}
          {panel === 'runs' && <section className="card"><h2>실행과 Context 인계</h2><p className="hint">다음 실행에는 목표·선택한 기억·최근 결과가 인계됩니다. 공급자 네이티브 세션을 서로 공유하는 방식은 아닙니다.</p>{detail.runs.map(run => <article className="memory" key={run.id}><strong>{run.agent} · {statuses[run.status]}</strong><small>{run.id}</small><p>{run.providerSessionId ? 'Provider session: ' + run.providerSessionId : 'Provider session 없음'}</p>{run.error && <p>{run.error}</p>}</article>)}{detail.handoffs.map(h => <details key={h.id}><summary>Context · 기억 {h.memories.length}개 / 이전 결과 {h.recentResults.length}개</summary><pre>{JSON.stringify(h, null, 2)}</pre></details>)}</section>}
          {panel === 'settings' && <form className="card form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { await api(`/tasks/${taskId}`, { title: f.get('title') }, 'PATCH'); await load(); }); }}><h2>작업 이름 변경</h2><label>제목<input key={taskId} name="title" defaultValue={detail.task.title} required maxLength={200}/></label><button className="primary" disabled={busy}>저장</button></form>}
        </>}
        <section className="diagnostics"><div className="section-title">RUNTIME AVAILABILITY <button onClick={() => void action(async () => setAgents(await api<Capability[]>('/agents')))}>새로고침</button></div><div className="agent-grid">{agents.map(a => <div className="agent-card" key={a.id}><div><strong>{a.id}</strong><span className={'dot ' + (a.id === 'mock' ? 'completed' : 'draft')}/></div><p>{a.id === 'mock' ? '로컬 시뮬레이션' : a.runnable ? '실제 CLI 사용 가능 · 로그인은 실행 시 확인' : a.installed ? '현재 CLI 옵션 미지원' : '실행 파일 없음'}</p><small>{a.version ? 'v' + a.version : '버전 미확인'} · Quota: Unknown</small></div>)}</div></section>
      </div><footer>AgentDock · local-first <span>개인정보는 각 PC에만 보관됩니다.</span></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
