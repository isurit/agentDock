# AgentDock — Codex 개발 인계 문서

> 문서 목적: 집의 Mac mini에서 동작하는 Codex 세션에 지금까지 합의한 요구사항, 설계 방향, 개발·배포 절차를 전달한다.
> 상태: 초기 요구사항/설계 인계. 아직 구현·검증 여부를 주장하지 않는다.
> 프로젝트 저장소: https://github.com/isurit/agentDock.git
> 기준 환경: 개인 Mac mini(macOS, 주 개발) → 개인 GitHub(배포) → 회사 Ubuntu(다운로드 및 실사용 검증)

## 0. 가장 중요한 목표

**AgentDock은 단순한 웹 터미널이나 Claude/Gemini/Codex 채팅 모음이 아니다.**

Android 개발자가 브라우저에서 **작업(Task)** 을 만들면, 시스템이 해당 작업에 적합한 CLI Agent 및 Model을 선택/추천하고, 실행·승인·결과·히스토리·공통 기억을 한곳에서 관리해야 한다. Claude Code CLI, Gemini CLI, Codex CLI 사이를 전환하거나 협업시키더라도 사용자 입장에서는 **하나의 개발 작업**이 이어져야 한다.

대상 프로젝트는 회사 Ubuntu PC에 로컬로 clone되어 있는 Android 앱 소스다. 기존 Android Studio로 빌드·실행·디버깅하는 흐름은 유지한다.

### 비목표(초기)
- OpenHands 같은 대형 플랫폼을 설치하거나 그 위에 구현하지 않는다.
- Android Studio 대체 IDE, 전체 브라우저 코드 에디터, 독자적인 LLM 추론 엔진을 만들지 않는다.
- 별도의 모델 API Key 발급/추가 API 과금을 전제로 하지 않는다.
- CLI의 내부 대화 세션이나 공급자별 토큰 카운터가 마법처럼 통합된다고 가정하지 않는다.
- 회사 Ubuntu에서 개인 GitHub로 **push**하는 워크플로는 사용하지 않는다.
- 회사 소스/로그/인증정보를 개인 Mac 또는 개인 GitHub로 이동하지 않는다.

## 1. 확정된 사용자 환경과 제약

| 항목 | 결정/현황 |
|---|---|
| 리포지토리 | `https://github.com/isurit/agentDock.git` |
| 집 개발 | macOS의 Mac mini, Codex CLI 중심, 집 토큰/사용 여유를 최대 활용 |
| 회사 실행 | Ubuntu, 기존 Claude Code CLI / Gemini CLI / Codex CLI 사용 |
| 인증 | 각 CLI에서 브라우저 OAuth 로그인 후 기존 구독/조직 계정 사용 |
| 주요 개발 | Kotlin/Java/XML/Gradle 기반의 대규모 Android 앱 개발 |
| 소스 위치 | 회사 Ubuntu에 사내 Git 저장소를 별도 clone하여 로컬에 보관 |
| IDE | Android Studio 유지: 빌드, 실행, 디버그, 로그 확인 |
| 기존 UI | Terminator에서 약 4개 CLI 화면을 분할 사용. 가독성, 완료 인지, 입력 시점 관리가 불편 |
| 전달 방향 | 집 Mac → 개인 GitHub Push → 회사 Ubuntu Clone/Pull **단방향** |
| 회사에서 발견한 문제 | 사내 정보가 없는 일반화된 재현 절차/오류 유형만 집 Codex에 수동 피드백(회사 정책 우선) |

**요구사항 해석:** '세션/히스토리/메모리 등을 신경 쓰지 않고 쓰고 싶다'는 것은 이를 저장하지 않아도 된다는 뜻이 아니라, **시스템이 내부에서 관리해 사용자가 매번 수동 선택·복사·붙여넣기하지 않도록** 하라는 의미다.

## 2. 제품 사용 시나리오

1. 사용자가 브라우저에서 Android 프로젝트를 선택한다.
2. '신규 기능 개발 / 버그 수정 / 로그 분석 / 아키텍처 설계 / 코드 리뷰 / 리팩터링 / 자유 작업' 중 하나를 고르거나 자연어로 입력한다.
3. AgentDock이 Task를 생성하고 관련 코드·프로젝트 규칙·이전 결정사항을 수집한다.
4. 라우터가 Agent와 Model을 **추천하거나 자동 선택**한다. 사용자는 수동 override할 수 있다.
5. 선택된 CLI가 기존 OAuth 인증 상태로 실행되며, 스트리밍 응답/진행/승인 요청이 브라우저에 표시된다.
6. 필요하면 다른 CLI로 **handoff**한다. 새 Agent는 공통 Task 요약, 설계 결정, 관련 파일, Git diff, 남은 할 일을 전달받는다.
7. 에이전트가 수정한 파일 목록, Diff, 테스트 결과, 리뷰/반론이 동일 Task에 남는다.
8. 브라우저 또는 서버를 재시작해도 기존 Task와 History를 다시 열 수 있다.
9. 실제 Android 앱 빌드/실행은 우선 Android Studio에서 사용자가 수행한다.

예시: `TASK-001: 로그인 버그 수정` — Claude로 원인 분석 → Codex로 수정 → Gemini로 리뷰 → 사용자가 Git Diff를 승인·확인. 이 과정은 여러 개의 CLI 네이티브 세션을 만들더라도 단일 Task 타임라인에 기록된다.

## 3. 기능 요구사항 및 우선순위

### P0 — 집에서 동작해야 하는 기반
- [ ] Local-first 웹 Dashboard: 프로젝트 목록/작업 목록/작업 상세/Agent 실행 상태/이벤트 스트림.
- [ ] 로컬 프로젝트 경로 등록 및 관리. 프로젝트 파일은 AgentDock 리포지토리 내부로 복사하지 않는다.
- [ ] Task 생성/이름 변경/상태 관리(`draft`, `queued`, `running`, `awaiting_approval`, `completed`, `failed`, `cancelled`).
- [ ] Task별 대화, 실행 기록, 아티팩트 메타데이터와 히스토리의 SQLite 영속화.
- [ ] 서버/브라우저 재시작 후 Task와 기록 복원(중단된 프로세스는 정확하게 복구 또는 '중단됨'으로 표시).
- [ ] 공통 `AgentAdapter` 인터페이스와 Mock Adapter(테스트용), Codex Adapter(집에서 실연동).
- [ ] Claude/Gemini Adapter 인터페이스 구현 및 가능하면 집에서 비민감 샘플로 검증; 불가하면 검증 상태를 명시한다.
- [ ] Agent/Model 수동 선택 및 Auto 모드(초기에는 투명한 규칙 기반).
- [ ] 실행 이벤트의 실시간 스트리밍, 실행·완료·실패·취소 상태 표시.
- [ ] Agent 간 Task 컨텍스트 인계(Handoff) 및 요약 생성/저장.
- [ ] 파일 수정 내역/ Git status / Diff 표시, 승인 정책 및 작업 로그.
- [ ] 예시 프로젝트/Mock 기반 자동 테스트 및 macOS·Ubuntu CI.
- [ ] CLI와 인증이 없어도 Mock 모드에서 주요 사용자 흐름이 끝까지 동작.

### P1 — 회사 실제 사용에 중요한 기능
- [ ] Claude/Gemini/Codex의 Ubuntu OAuth 기반 실연동 검증.
- [ ] 프로젝트 단위 Memory: 기술 스택, 아키텍처 원칙, 주요 결정사항, 관련 모듈.
- [ ] 모델 라우팅 정책: 작업 유형/복잡도/현재 상태/사용 가능한 사용 한도에 따라 추천·자동 선택.
- [ ] 가능한 범위에서 CLI별 사용량/제한 정보 수집; 정확한 정보를 얻지 못하면 **Unknown**으로 표시.
- [ ] 사용 한도 초과/CLI 실행 실패시 명시적으로 알리고 사용자가 승인한 범위에서 Agent 대체.
- [ ] 선택적 교차 리뷰·토론: 독립적 검토, 반론, 합의·잔여 이견 기록. 모든 Task에 3개 Agent를 강제하지 않는다.
- [ ] Logcat 파일 업로드/붙여넣기/오류 패턴 분석(로컬 저장, 민감정보 보호).
- [ ] Gradle 테스트/lint 실행 결과를 Task 아티팩트로 연결(명령 실행 정책 준수).
- [ ] 진단 화면: OS/Node/CLI 실행가능 여부/버전/실행 상태/오류 코드(토큰·회사 데이터 미노출).
- [ ] 데이터/DB migration, 업그레이드/롤백/백업 안내.

### P2 — 후속 확장
- [ ] 복수 Agent 병렬 검토 및 파일 쓰기 격리(Git worktree).
- [ ] Android 코드 탐색/모듈 의존 관계 시각화.
- [ ] 사용자 피드백 기반 라우팅 품질 개선.
- [ ] 세밀한 모델별 성능/비용/쿼터 정책 대시보드(실측 가능한 데이터 범위에서만).

## 4. 시스템 설계 가이드

```text
Browser (React/Vite)
  ├─ Project & Task UI
  ├─ Chat/Timeline/Events
  ├─ Agent/Model Selector (Auto + Manual)
  ├─ Git Diff/Approvals
  └─ Diagnostics
         │ HTTP / WebSocket (localhost)
Node.js Server
  ├─ Task Service & State Machine
  ├─ Execution/Approval Manager
  ├─ Agent Orchestrator
  │    ├─ Task Router
  │    ├─ Model Router
  │    └─ Quota/Availability Manager (best effort)
  ├─ Context/Memory/Handoff Manager
  ├─ AgentAdapter Registry
  │    ├─ Codex Adapter
  │    ├─ Claude Adapter
  │    ├─ Gemini Adapter
  │    └─ Mock Adapter
  ├─ Project/Git Service
  └─ SQLite + Local Artifacts
         │
Registered local Android project  ←→  Android Studio
```

### 권장 기술 스택
- Frontend: React + TypeScript + Vite.
- Backend: Node.js + TypeScript, HTTP API + WebSocket.
- 데이터 저장: SQLite + 앱 데이터 디렉터리의 작업 아티팩트.
- CLI 실행: `spawn`/`execFile` 등 **shell 문자열 삽입 없는** 인자 배열 기반 프로세스 실행.
- 공통 코드/데이터 계약: 별도 `core` 패키지.
- 테스트: 단위/통합/웹 UI smoke; CI에서 `ubuntu-latest`와 `macos-latest` 검증.
- 별도 Docker, 외부 DB, 메시지 브로커, OpenHands 설치를 MVP 전제로 하지 않는다.

### 추천 저장소 구조(필요에 따라 조정 가능)

```text
agentDock/
├── apps/
│   ├── web/                  # React dashboard
│   └── server/               # Node backend
├── packages/
│   ├── core/                 # domain types, schemas, events
│   ├── orchestrator/         # router, workflows, handoff
│   ├── agent-adapters/       # codex, claude, gemini, mock
│   └── project/              # local path, git, diff
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── HANDOFF.md
│   ├── DECISIONS.md
│   ├── SECURITY.md
│   └── UBUNTU_VALIDATION.md
├── AGENTS.md                 # Codex/agent development rules
├── README.md
├── package.json
└── .github/workflows/ci.yml
```

이 구조를 맹목적으로 채택할 필요는 없지만, **프론트엔드 / 백엔드 / 공통 도메인 / Agent Adapter / Orchestrator / 로컬 프로젝트 연동**의 책임 분리는 필수다.

## 5. 핵심 설계 의사결정

### 5.1 Task가 최상위 개념이다
- Provider/CLI session은 Task에 귀속되는 내부 실행 단위다.
- 각 CLI의 네이티브 세션은 가능한 범위에서 재개하되, 서로 다른 공급자의 세션을 '원본 그대로 공유'한다고 표현하지 않는다.
- 사용자에게 보이는 History는 **Task 단위 통합 타임라인**이다.

### 5.2 Context Handoff는 명시적 데이터 계약을 가진다
Handoff 최소 데이터:
- Task 목표, 현재 상태, 사용자 지시, 중요한 결정 사항.
- 관련 파일/심볼, 변경 파일과 Git diff 요약.
- 이전 실행 결과, 검증 결과, 미해결 오류.
- 다음 Agent가 할 일, 금지 사항, 참고할 프로젝트 Memory.
- 원본 세션/실행 ID 추적 정보.

길어지는 대화를 전부 매번 다른 모델에 재전송하지 않는다. **요약 + 관련 원본 검색/선택** 방식으로 컨텍스트 비용을 관리한다. 요약에 의해 근거가 손실되지 않도록 원본 실행·결정 기록도 별도로 보존한다.

### 5.3 Router와 Adapter는 별도 책임이다
- Router: **누가 어떤 모델로 할지** 정책 판단.
- Adapter: **실제로 해당 CLI를 어떻게 실행·중단·재개하고 이벤트를 파싱할지** 구현.
- 모델 ID/지원 옵션/가용성은 CLI 버전에 따라 바뀔 수 있으므로 설정 또는 기능 탐지로 관리한다.
- 사용자는 Auto 결과와 선택 근거를 보고, 필요하면 Agent/Model을 직접 변경할 수 있어야 한다.

### 5.4 Quota는 베스트 에포트로 관리한다
- OAuth 계정 로그인 정보는 각 CLI가 직접 관리한다.
- CLI 공식 지원 인터페이스로 확인할 수 있는 사용량/한도만 수집한다.
- 모든 제공업체에서 동일한 잔여 토큰 수 또는 정확한 리셋 시간을 제공한다고 가정하지 않는다.
- 상태: `available / limited / exhausted / unknown / error` 등. 신뢰도가 낮으면 Unknown 표시.
- 429/제한 오류 발생 시 해당 Agent의 상태를 갱신하고 **조용히 다른 Agent로 전환하지 않고** 작업·모델 변경을 UI에 기록한다.
- 자동 라우팅은 1차에 단순 규칙 기반. 기록을 통해 개선한다.

### 5.5 코드 쓰기는 안전하게
- 초기에는 한 작업에 한 개의 코드 수정 실행만 허용하는 것을 기본값으로 한다.
- 병렬 Agent는 읽기 전용 분석을 우선하고, 동시 수정은 worktree 격리 도입 후 허용한다.
- 파일 변경/위험 명령에는 명시적 승인 정책을 둔다. 작업 내용/권한/사용자 승인 여부를 History에 남긴다.
- Git Diff 확인 후 실제 사용자가 Android Studio에서 테스트할 수 있어야 한다.

## 6. Agent Adapter 상세 요구사항

### 공통 추상 인터페이스(개념적)

```ts
interface AgentAdapter {
  id: 'codex' | 'claude' | 'gemini' | 'mock';
  probe(): Promise<AgentCapabilities>;
  listModels?(): Promise<ModelInfo[]>;
  start(request: AgentRunRequest, events: AgentEventSink): Promise<AgentRunResult>;
  cancel(runId: string): Promise<void>;
  resume?(request: AgentResumeRequest, events: AgentEventSink): Promise<AgentRunResult>;
  usage?(): Promise<UsageStatus>; // Unsupported/unknown 허용
}
```

- 위 코드는 **개념적 예시**이며 실제 SDK/CLI가 제공하는 지원 범위를 탐지하여 구체화한다.
- CLI 버전별 실제 플래그와 기계 판독 가능한 출력(JSON/JSONL 등)을 확인하고 문서화한다. 검증되지 않은 CLI 인자를 하드코딩하지 않는다.
- `stdout`/`stderr`/상태 이벤트의 파싱과 UI 모델을 분리한다.
- 실행 취소/시간 초과/비정상 종료/프로세스 트리 종료를 macOS와 Ubuntu에서 검증한다.
- 실행 중인 계정의 OAuth credential store를 앱이 직접 복사하거나 Git에 저장하지 않는다.
- 승인 및 접근 정책을 CLI 지원 기능에 맞게 매핑하고, 지원하지 않는 승인은 '지원하지 않음'으로 드러낸다.
- Mock Adapter는 검증 수단이고 UI에서 항상 Mock으로 표시한다. 실제 CLI 연동이 된 것처럼 표시하지 않는다.

## 7. Android 개발 중심 UX

### 시작 화면
- 최근 프로젝트, 최근 Task, '새 Task' 버튼, Agent 실행 가능 상태.
- 주 작업 템플릿: 신규 기능 / 버그 수정 / 로그 분석 / 아키텍처 설계 / 코드 리뷰 / 리팩터링 / 자유 작업.

### Task 상세
- 중앙: 공통 메시지/이벤트 타임라인.
- 상단: Task 제목/상태, Auto/Manual Agent·Model 선택, 현재 실행/중단 상태.
- 측면 또는 탭: 관련 파일, 변경 파일, Git Diff, 프로젝트 Memory, 승인 요청, 실행 로그.
- 사용자가 Agent를 바꾸면 다음 턴에 **공통 Context가 인계**되었는지 표시한다.
- 작업 완료 알림/입력 대기/승인 대기 상태는 Terminator보다 명확해야 한다.

### Android 소스 연동
- 프로젝트 경로 등록은 Linux/macOS 어느 쪽에서도 지원.
- 코드를 분석할 때 Kotlin/Java/XML/Gradle 등 일반 Android 파일을 처리.
- Android Studio가 사용하는 로컬 Git 작업 트리와 동일한 파일을 사용하되, Git 상태 및 충돌 여부를 표시.
- 1차에서는 Android Studio로 빌드·실행을 계속하는 것을 정상 워크플로로 취급.
- Logcat 등 사내 민감정보가 들어갈 수 있는 파일은 기본적으로 외부 보고서나 개인 Git으로 내보내지 않음.

## 8. 데이터/상태 모델 초안

주요 엔티티:
- `Project`: ID, 이름, 등록된 로컬 경로, 기술/개발 규칙 참조.
- `Task`: ID, Project ID, 유형, 제목, 목표, 상태, 생성/업데이트 시각.
- `TaskMessage`: 사용자/시스템/Agent 메시지, 원본 표시, Task ID.
- `AgentRun`: Agent, Model, CLI 버전, Provider 세션 ID(있으면), 시작/종료, 실행 상태.
- `AgentEvent`: 스트리밍 이벤트, 진단, 종료 코드.
- `Handoff`: source run/target run, 요약, 관련 파일, 결정, 미완료 작업.
- `MemoryEntry`: Project 또는 Task 범위, 내용, 출처, 업데이트 시각.
- `Artifact`: Diff, 로그, 테스트 결과 등 로컬 아티팩트 경로 및 메타정보.
- `Approval`: 대상 작업/명령, 요청 상태, 사용자 승인 이력.
- `QuotaSnapshot`: Provider/Model, 측정 시각, 값, 신뢰도/출처, `unknown` 지원.

중요:
- 버전별 SQLite schema migration을 설계한다.
- DB·세션·설정·아티팩트는 **Git 저장소 외부** 앱 전용 디렉터리에 저장한다.
- 개인정보/회사 기밀이 포함될 수 있는 프롬프트/로그는 원격 텔레메트리로 자동 전송하지 않는다.

## 9. 개발 환경과 Git 단방향 운영

### 개발/배포 루프(확정)
1. 집 Mac mini Codex에서 공통 기능 설계·구현·단위/통합 테스트.
2. 집에서 GitHub로 push, Git 태그/릴리즈로 검증 버전 식별.
3. GitHub Actions에서 macOS·Ubuntu 빌드 및 Mock 기반 자동 테스트.
4. 회사 Ubuntu에서 해당 버전 `clone`/`fetch`/`pull` 후 의존성 설치 및 실환경 테스트.
5. 문제 발생 시 회사 정보 유출 없이 재현 조건/오류 유형을 정리해 집 Codex에 전달.
6. 집에서 일반화된 회귀 테스트를 만들고 수정한 뒤 새 버전을 push. 2~6 반복.

**회사 → 개인 GitHub push 없음.** 회사에서 임시로 코드 수정이 필요하면 원칙적으로 회사에만 보관되며, 집으로 반출 가능한지 판단하기 전에는 개인 GitHub로 보내지 않는다. 공통 제품 버그는 회사 정보를 제거한 최소 재현으로 집에서 재구현한다.

### 플랫폼 호환성 규칙
- Node 버전 고정(.nvmrc 또는 `.node-version`, 엔진 필드), lockfile 커밋.
- 각 OS에서 `npm ci` 등으로 **재설치**, Mac의 `node_modules`를 복사하지 않는다.
- 절대경로/PATH/실행 파일 경로/임시폴더를 설정 또는 표준 API로 처리.
- OS 종속 쉘 명령, `sed -i` 같은 비호환 옵션, 프로세스 트리 정리 차이 검증.
- Mac Apple Silicon/Ubuntu x86-64 및 SQLite 네이티브 의존성 가능성 고려.
- UI 서버는 초기 `127.0.0.1` 로만 바인딩. 방화벽/원격 접근은 별도 요구사항으로 분리.
- GitHub Actions에서 OAuth 로그인 없이 CI를 통과해야 한다.

### 배포/업데이트
- 태그 예: `v0.1.0`, `v0.2.0`.
- DB는 설치 패키지/리포지토리 경로 밖에 있어 업데이트 시 보존.
- 마이그레이션 전 백업 및 오류 발생시 안전한 실패/복구 안내.
- Ubuntu에서 검증할 체크리스트를 `docs/UBUNTU_VALIDATION.md`로 제공.

## 10. 보안·컴플라이언스 요구사항

1. 회사에서 허가된 CLI, 계정, 모델 및 데이터 전송 범위 내에서만 실사용한다.
2. 브라우저 OAuth는 CLI가 담당한다. AgentDock이 비밀번호/토큰을 수집하거나 별도 키체인 파일을 읽지 않는다.
3. 로컬 백엔드는 기본 `127.0.0.1` 바인딩, 인증 없는 원격 공개 금지. 브라우저 요청에서 CSRF/Origin/WebSocket Origin 및 localhost 위협 모델 검토.
4. `shell: true`와 프롬프트 문자열을 섞는 실행 방식 금지. 파라미터·환경변수 처리 검증.
5. 등록된 프로젝트 외 임의 파일 접근 및 symlink 경로 탈출 방지 정책 수립.
6. 파일 쓰기, 명령 실행, 네트워크 요청 등 위험 동작에 승인 정책 마련. 에이전트가 그 정책을 우회할 수 없도록 가능한 범위의 OS/CLI 제약을 사용.
7. 세션 DB, 로그, OAuth credential, 환경변수 파일, 개인/회사 소스코드는 커밋하지 않는다. `.gitignore`와 검증 테스트 추가.
8. 사용자 요청이나 자동 진단 명목으로 회사 데이터가 개인 GitHub, 개인 Mac, 공개 CI 로그에 섞이지 않게 한다.
9. 회사 코드 자체를 읽고 공급자 서비스로 전송하는 것은 로컬 실행과 별개의 보안 문제이므로 회사 승인 정책을 따른다.
10. 의존성은 가급적 적게 유지하고 불필요한 telemetry를 비활성화한다.

## 11. 단계별 집 Codex 구현 계획

### Phase 0 — 아키텍처·검증 가능한 초기 구성
- 요구사항 확정 및 누락/위험 목록 작성.
- 모노레포/패키지 관리자/Node 버전 결정.
- 문서: `README.md`, `AGENTS.md`, `docs/REQUIREMENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `SECURITY.md`, `HANDOFF.md`.
- 웹/서버 실행, 건강 상태 엔드포인트, 기본 CI와 샘플 프로젝트.
- 완료 기준: macOS에서 실행, Ubuntu CI에서 빌드·기본 테스트.

### Phase 1 — Task 중심 웹 제품 (Mock end-to-end)
- Project 등록, Task 생성/목록/상세, SQLite, WebSocket, 실행 상태, Mock Agent, 히스토리 복원.
- 완료 기준: `Task 생성 → Mock 실행 → 결과 저장 → 브라우저/서버 재시작 → 동일 Task 조회`.

### Phase 2 — 실제 Codex 연동
- 현재 설치된 Codex 버전/지원 옵션 탐지, OAuth CLI 그대로 사용, 실행/취소/스트리밍/에러 처리.
- Git Diff/파일 변경 화면, 승인 동작 초기 구현.
- 완료 기준: **비민감 샘플 프로젝트**에서 Codex가 실제로 분석·변경을 수행하고 Diff와 결과가 보인다.

### Phase 3 — Agent 전환과 Router
- Claude/Gemini Adapter 구현(검증되지 않은 기능은 Capability Flag).
- Context Handoff 요약/원본 참조, Auto/Manual Router, Agent 변경 표시.
- 완료 기준: Mock↔Codex 또는 두 Mock Agent 간 인계 시 Task의 결정·파일·남은 작업이 유지. 실제 CLI가 지원되면 추가 통합 테스트.

### Phase 4 — Quota/Review/Android 기본 지원
- best-effort 가용성/쿼터 표시, 에러시 대체 제안, 교차 리뷰 모드.
- Android task template, Logcat 파일/붙여넣기, 테스트 결과 아티팩트.
- 완료 기준: 적어도 하나의 Android 샘플 케이스에 대한 워크플로 재현.

### Phase 5 — 회사 Ubuntu 검증 및 안정화
- CLI 실설치·버전/경로/OAuth 상태 확인, 실제 Claude/Gemini/Codex 연동.
- 사내 Android 프로젝트 등록·분석·코드 변경·Diff·Android Studio 빌드 확인.
- OS별 프로세스 제어, 경로, SQLite, 권한, 네트워크 문제 점검.
- 회사에서 수정한 코드가 개인 GitHub로 역전파되지 않도록 운영.

## 12. 수용 기준(Definition of Done)

P0 개발 기반이 '완성'되었다고 말하려면:
- [ ] Mac에서 README 명령으로 설치/실행할 수 있다.
- [ ] Ubuntu CI에서 의존성 설치·빌드·테스트가 통과한다.
- [ ] Task 생성, Agent 실행, 타임라인 스트리밍, 취소/실패, 히스토리 재조회가 동작한다.
- [ ] Mock과 실연동 여부가 UI/문서상 구별된다.
- [ ] Codex 실제 연동이 검증되었으면 실행 과정/CLI 버전/제약을 기록한다.
- [ ] Agent 변경 후 인계된 맥락과 실행 주체가 History에 남는다.
- [ ] Git Diff와 파일 수정 이력을 사용자가 확인할 수 있다.
- [ ] DB/로그/회사 프로젝트/토큰이 Git 추적 파일에 포함되지 않는다.
- [ ] Ubuntu 실환경에서 아직 검증하지 못한 항목은 `docs/HANDOFF.md`에 남아 있다.

## 13. 회사 Ubuntu 검증 체크리스트 초안

- [ ] 회사에서 개인 GitHub clone/fetch가 정책상 허용되는지 확인.
- [ ] Node 버전·아키텍처·필수 패키지 설치 가능 여부 확인.
- [ ] 세 CLI 실행 가능 여부, 버전 확인(`--version` 등).
- [ ] 각 CLI의 현재 OAuth 로그인 상태로 독립적으로 실행되는지 확인.
- [ ] 앱의 Agent Adapter가 각 CLI 프로세스를 실행/종료하는지 확인.
- [ ] 모델 선택 지원 범위와 실행 중 모델명 표시 검증.
- [ ] 사용량/한도 조회 가능 범위 확인, 불가하면 Unknown 출력 확인.
- [ ] Android 프로젝트 등록 후 읽기 전용 분석 수행.
- [ ] 안전한 소규모 코드 변경 → Git Diff → Android Studio에서 검증.
- [ ] 브라우저/서버 재시작 후 작업 히스토리 복원.
- [ ] 실행 취소, OAuth 만료, 네트워크 오류, 한도 소진, CLI 업그레이드 처리 검증.
- [ ] 어떤 실행 결과도 개인 GitHub로 자동 전송되지 않는지 확인.

## 14. 예상 리스크 및 설계 시 주의점

| 리스크 | 대응 |
|---|---|
| 공급자별 CLI 기능/이벤트 형식 차이 | Adapter 격리, capability probe, 버전별 호환 테스트 |
| OAuth 로그인 방식/재인증 차이 | CLI에게 인증 책임 위임; 앱이 자격 증명 직접 취급하지 않음 |
| 모든 모델의 정확한 쿼터 수집 불가 | Unknown 허용, 오류 기반 감지, 수동 override |
| 세션을 Provider 간 직접 이전 불가 | Task의 공통 컨텍스트를 명시적으로 재구성해 handoff |
| macOS vs Ubuntu 경로/프로세스 차이 | OS 추상화, Ubuntu CI, 회사 실환경 검증 |
| 동시 Agent 수정 충돌 | 1 writer 기본, 이후 Git worktree 격리 |
| 집에서 회사 코드 없이 재현 어려움 | 샘플/Mock 테스트, 일반화된 피드백, 회사 정책 준수 |
| 많은 Agent 호출로 토큰 소모 | 단계별 사용, 단순 작업에는 단일 Agent, 요약 기반 컨텍스트 |
| Agent가 위험한 명령 실행 | 승인/경로/명령 정책, CLI 제공 샌드박스 기능 활용 |

## 15. Codex에 요구할 첫 번째 산출물

1. 이 문서를 검토하여 충돌되는 요구사항, 구현이 불가능하거나 검증이 필요한 전제를 구분한다.
2. 최소 기능 아키텍처와 AgentAdapter·Task·Run·Handoff 데이터 계약을 제안한다.
3. 프로젝트 초기 구성과 문서를 만들어 `npm ci` / `npm run dev` / `npm test` / `npm run build` 경로를 준비한다. 실제 명령어는 선택한 워크스페이스 도구에 맞춰 README에 확정한다.
4. Mac에서 Mock end-to-end 검증과 실제 Codex 연동을 순차 구현한다.
5. 진행할 때 각 단계 완료 기준을 테스트하고 `docs/HANDOFF.md`에 '구현 완료 / Mac 검증 / Ubuntu CI 검증 / 회사 미검증' 상태를 구분한다.
6. 사용자의 명시적 요청 없이 회사 환경·인증정보·회사 소스를 요구하거나 외부에 올리지 않는다.

## 16. 미확정 사항 — Codex가 임의로 확정하지 말고 제안할 것

- 집 Mac에 Claude/Gemini가 설치되어 있는지, 실 OAuth 인증이 있는지.
- 회사 Ubuntu의 정확한 Node/CLI 버전과 설치 정책.
- CLI별 어떤 모델이 조직/구독 계정에서 사용 가능한지.
- 작업 결과를 저장할 로컬 폴더의 정책과 보관 기간.
- 파일 쓰기/명령 실행의 기본 승인 수준 및 자동 실행 허용 범위.
- GitHub 저장소가 public/private인지, 회사 정책상 사용 가능한지.

이 미확정 항목이 있어도 Mock/샘플 기반의 공통 MVP 개발은 시작할 수 있다.
