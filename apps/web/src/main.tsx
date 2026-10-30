import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Capability, Event, Handoff, Memory, Project, Run, Task } from '../../../packages/core/src/index.ts';
import './style.css';
type Detail = { task: Task; runs: Run[]; memories: Memory[]; handoffs: Handoff[] };
type Git = { available: boolean; status?: string; diff?: string; staged?: string; reason?: string };
const statuses: Record<string, string> = { draft: '준비', running: '실행 중', completed: '완료', failed: '실패 / 중단', cancelled: '취소', queued: '대기', awaiting_approval: '승인 대기' };
function App() {
  const [token, setToken] = useState(''), [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]), [tasks, setTasks] = useState<Task[]>([]), [agents, setAgents] = useState<Capability[]>([]);
  const [projectId, setProjectId] = useState(''), [taskId, setTaskId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null), [events, setEvents] = useState<Event[]>([]), [git, setGit] = useState<Git | null>(null);
  const [panel, setPanel] = useState('timeline'), [connection, setConnection] = useState('연결 중'), [agent, setAgent] = useState('auto');
  const [busy, setBusy] = useState(false), [projectForm, setProjectForm] = useState(false), [taskForm, setTaskForm] = useState(false);
  const revision = useRef(0);
  const api = useCallback(async <T,>(path: string, body?: unknown, method = 'POST'): Promise<T> => {
    const res = await fetch('/api' + path, { method: body === undefined ? 'GET' : method, headers: { 'Content-Type': 'application/json', 'X-AgentDock-Token': token }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await res.json(); if (!res.ok) throw new Error(value.error ?? '요청 실패'); return value;
  }, [token]);
  useEffect(() => { fetch('/api/bootstrap').then(res => res.json()).then(value => setToken(value.token)).catch(() => setError('서버에 연결할 수 없습니다.')); }, []);
  const load = useCallback(async () => {
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
  useEffect(() => { setGit(null); }, [projectId, taskId]);
  const action = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : '작업 실패'); } finally { setBusy(false); } };
  const selectedProject = projects.find(p => p.id === projectId);
  const visibleTasks = tasks.filter(t => t.projectId === projectId);
  const running = detail?.task.status === 'running';
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/"> <span className="brandmark">A</span><span>AgentDock<small>LOCAL DEVELOPMENT WORKSPACE</small></span></a>
      <div className="section-title">PROJECTS <button aria-label="프로젝트 등록" onClick={() => setProjectForm(v => !v)}>＋</button></div>
      {projects.map(p => <button key={p.id} className={'project ' + (p.id === projectId ? 'selected' : '')} onClick={() => { setProjectId(p.id); setTaskId(''); setTaskForm(false); }}>▣ <span>{p.name}</span><span className="count">{tasks.filter(t => t.projectId === p.id).length}</span></button>)}
      {!projects.length && <p className="hint">로컬 프로젝트를 등록해 시작하세요.</p>}
      <div className="section-title">TASKS <button aria-label="새 작업" disabled={!projectId} onClick={() => setTaskForm(v => !v)}>＋</button></div>
      {visibleTasks.map(t => <button className={'task-link ' + (taskId === t.id ? 'selected' : '')} key={t.id} onClick={() => { setTaskId(t.id); setPanel('timeline'); setTaskForm(false); }}><span className={'dot ' + t.status}/><span>{t.title}</span></button>)}
      {!visibleTasks.length && <p className="hint">아직 작업이 없습니다.</p>}
      <div className="sidebar-footer"><span className="green-dot"/>각 PC에만 저장<small>GitHub 업로드 · 외부 Agent 실행 차단</small></div>
    </aside>
    <main>
      <header><div className="breadcrumb">Workspace <span>/</span> {selectedProject?.name ?? '시작하기'}</div><span className="connection"><span className="green-dot"/>{connection}</span></header>
      <div className="content">
        <div className="privacy"><span>⌾</span><div><strong>Local-only workspace</strong><p>작업·기억·로그·코드는 이 PC에 보관합니다. 실제 CLI 실행과 공급자 전송은 정책상 차단됩니다.</p></div><span className="badge">LOCAL ONLY</span></div>
        {error && <div role="alert" className="error">{error}<button onClick={() => setError('')} aria-label="오류 닫기">×</button></div>}
        {projectForm && <form className="card form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { const p = await api<Project>('/projects', { name: f.get('name'), path: f.get('path') }); setProjectId(p.id); setTaskId(''); setProjectForm(false); await load(); }); }}>
          <h2>로컬 프로젝트 등록</h2><label>프로젝트 이름<input name="name" required maxLength={120} placeholder="Android sample"/></label><label>이 PC의 절대경로<input name="path" required placeholder="로컬 Git 프로젝트 루트"/></label><p className="hint">소스를 복사하지 않습니다. 경로는 로컬 DB에만 저장합니다.</p><div><button className="primary" disabled={busy}>등록</button> <button type="button" onClick={() => setProjectForm(false)}>닫기</button></div>
        </form>}
        {taskForm && <form className="card form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { const t = await api<Task>('/tasks', { projectId, title: f.get('title'), goal: f.get('goal') }); setTaskId(t.id); setTaskForm(false); await load(); }); }}><h2>새 작업</h2><label>제목<input name="title" required maxLength={200} placeholder="이번 작업의 이름"/></label><label>목표<textarea name="goal" required maxLength={20000} placeholder="목표와 완료 기준을 적어주세요."/></label><div><button className="primary" disabled={busy}>작업 만들기</button> <button type="button" onClick={() => setTaskForm(false)}>닫기</button></div></form>}
        {!detail ? <section className="welcome"><div className="eyebrow">YOUR WORK, ONE CONTINUOUS THREAD</div><h1>작업의 맥락을<br/>한곳에 모으세요.</h1><p>프로젝트를 선택하고 목표를 기록하세요.<br/>실행 기록과 기억은 Task 안에서 이어집니다.</p><button className="primary" onClick={() => projectId ? setTaskForm(true) : setProjectForm(true)}>{projectId ? '＋ 새 작업 만들기' : '＋ 프로젝트 등록'}</button><div className="overview">{[['PROJECTS', projects.length], ['TASKS', tasks.length], ['COMPLETED', tasks.filter(t => t.status === 'completed').length]].map(([label, count]) => <div key={label}><small>{label}</small><strong>{count}</strong></div>)}</div></section> : <>
          <div className="task-heading"><div><div className="eyebrow">TASK · {detail.task.id.slice(0, 8)}</div><h1>{detail.task.title}</h1><p>{detail.task.goal}</p></div><span className={'status ' + detail.task.status}>{statuses[detail.task.status]}</span></div>
          <div className="toolbar"><label>Runtime <select value={agent} onChange={e => setAgent(e.target.value)}><option value="auto">Auto · 로컬 정책</option><option value="mock">Mock · 시뮬레이션</option><option disabled>Codex · 정책상 차단</option><option disabled>Claude · 정책상 차단</option><option disabled>Gemini · 정책상 차단</option></select></label><span className="hint">파일 수정·모델 호출 없음</span><button className="primary" disabled={busy || running} onClick={() => void action(async () => { await api(`/tasks/${taskId}/runs`, { agent }); await load(); })}>▶ Mock 실행</button><button disabled={!running || busy} onClick={() => void action(async () => { await api(`/tasks/${taskId}/cancel`, {}); await load(); })}>중단</button></div>
          <nav className="tabs">{[['timeline', '타임라인'], ['memory', 'Memory'], ['git', 'Git Diff'], ['runs', '실행 / Context'], ['settings', '작업 설정']].map(([id, title]) => <button className={panel === id ? 'active' : ''} key={id} onClick={() => { setPanel(id); if (id === 'git') void action(async () => setGit(await api<Git>(`/projects/${projectId}/git`))); }}>{title}</button>)}</nav>
          {panel === 'timeline' && <section className="timeline">{events.map(event => <article className="event" key={event.seq}><span className="event-icon">{event.type === 'message' ? 'M' : '•'}</span><div><div className="event-meta"><strong>{event.type === 'message' ? 'Mock Agent' : event.type}</strong><time>{new Date(event.createdAt).toLocaleTimeString()}</time><span>#{event.seq}</span></div>{event.type === 'message' ? <p>{String(event.data.text)}</p> : <pre>{JSON.stringify(event.data, null, 2)}</pre>}</div></article>)}</section>}
          {panel === 'memory' && <section className="card"><h2>사용자가 확정한 기억</h2><p className="hint">Project 기억은 같은 프로젝트의 작업에, Task 기억은 이 작업의 다음 실행에 인계됩니다.</p>{detail.memories.map(m => <article className="memory" key={m.id}><span className="badge">{m.taskId ? 'TASK' : 'PROJECT'}</span><p>{m.content}</p></article>)}<form className="form" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void action(async () => { await api('/memories', { projectId, taskId: f.get('scope') === 'task' ? taskId : null, content: f.get('content') }); form.reset(); await load(); }); }}><label>기억할 내용<textarea name="content" required maxLength={12000}/></label><label>범위<select name="scope"><option value="task">현재 Task</option><option value="project">현재 Project</option></select></label><button className="primary" disabled={busy}>기억 저장</button></form></section>}
          {panel === 'git' && <section className="card"><h2>이 PC의 Git 변경사항</h2><p className="hint">로컬 조회 전용 · 외부 전송 없음 · 미추적 파일은 목록만 표시</p><button onClick={() => void action(async () => setGit(await api<Git>(`/projects/${projectId}/git`)))}>새로고침</button>{git?.available ? <><h3>Status</h3><pre>{git.status || '변경사항 없음'}</pre><h3>Working tree</h3><pre>{git.diff || '추적 파일 변경 없음'}</pre><h3>Staged</h3><pre>{git.staged || 'Staged 변경 없음'}</pre></> : <p>{git?.reason ?? '조회 중…'}</p>}</section>}
          {panel === 'runs' && <section className="card"><h2>실행과 Context 인계</h2><p className="hint">Mock 내 재실행 인계만 지원합니다. 공급자 간 실제 전환은 차단되어 있습니다.</p>{detail.runs.map(run => <article className="memory" key={run.id}><strong>{run.agent} · {statuses[run.status]}</strong><small>{run.id}</small><p>{run.providerSessionId ? 'Provider session: ' + run.providerSessionId : 'Provider session 없음'}</p>{run.error && <p>{run.error}</p>}</article>)}{detail.handoffs.map(h => <details key={h.id}><summary>Context · 기억 {h.memories.length}개 / 이전 결과 {h.recentResults.length}개</summary><pre>{JSON.stringify(h, null, 2)}</pre></details>)}</section>}
          {panel === 'settings' && <form className="card form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { await api(`/tasks/${taskId}`, { title: f.get('title') }, 'PATCH'); await load(); }); }}><h2>작업 이름 변경</h2><label>제목<input key={taskId} name="title" defaultValue={detail.task.title} required maxLength={200}/></label><button className="primary" disabled={busy}>저장</button></form>}
        </>}
        <section className="diagnostics"><div className="section-title">RUNTIME AVAILABILITY <button onClick={() => void action(async () => setAgents(await api<Capability[]>('/agents')))}>새로고침</button></div><div className="agent-grid">{agents.map(a => <div className="agent-card" key={a.id}><div><strong>{a.id}</strong><span className={'dot ' + (a.id === 'mock' ? 'completed' : 'draft')}/></div><p>{a.id === 'mock' ? '로컬 시뮬레이션' : a.installed ? '설치됨 · 실행 차단' : '실행 파일 없음'}</p><small>{a.version ? 'v' + a.version : '버전 미확인'} · Quota: Unknown</small></div>)}</div></section>
      </div><footer>AgentDock · local-first <span>개인정보는 각 PC에만 보관됩니다.</span></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
