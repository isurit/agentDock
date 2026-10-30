# AgentDock — 개발 재개 시작점 (v0.3.0)

AgentDock은 **Task 중심의 로컬 Android 개발 워크스페이스**입니다. 하나의 Task에서 Agent를 바꿔도 목표·지시·History·Memory·검증 근거를 이어가는 것이 목표입니다. Android Studio는 빌드·실행·디버깅에 계속 사용합니다.

**다음 작업자는 이 README부터 읽으세요.** 현재는 기반 제품과 실제 CLI Adapter가 구현되어 있습니다. macOS Codex의 비민감 샘플 읽기·수정은 검증했지만, **회사 Gemini 0.66.0은 `session.started` 이후 답변이 나오지 않는 사례가 보고됐으며 실제 원인은 아직 미확정**입니다. v0.3은 이를 해결했다고 주장하지 않고, 회사에서 원인을 분리할 진단·테스트·Context 도구를 제공합니다.

## 다음 작업자가 읽을 순서

| 문서 | 용도 |
|---|---|
| [회사 작업 시작 지침](docs/COMPANY_START.md) | 회사 토큰으로 이어갈 때의 첫 명령, 재현 순서, 실행 프롬프트 |
| [현재 인계 상태](docs/HANDOFF.md) | 구현·검증 완료·미검증·다음 작업 |
| [알려진 문제](docs/KNOWN_ISSUES.md) | Gemini 정지 현상, 확인 사실과 가설, 재현/수용 기준 |
| [작업 이력](docs/WORK_LOG.md) | v0.1 → v0.2 → v0.3의 변경과 사용자 검증 이력 |
| [현재 요구사항](docs/REQUIREMENTS.md) | 우선순위와 구현/검증 상태 |
| [설계 결정](docs/DECISIONS.md) | 최신 사용자 승인과 기술 결정, 과거 결정을 대체한 내용 |
| [아키텍처](docs/ARCHITECTURE.md) | 코드 위치, 계약, 실행/이벤트 흐름 |
| [개발 로드맵](docs/ROADMAP.md) | 후속 작업 순서와 완료 기준 |
| [CLI 호환성](docs/CLI_COMPATIBILITY.md) | 공급자별 실행·승인·검증 차이 |
| [보안/운영](docs/SECURITY.md) | 로컬 데이터, 인증, 승인, 백업과 한계 |
| [Ubuntu 체크리스트](docs/UBUNTU_VALIDATION.md) | 회사에서만 확인 가능한 항목 |
| [원본 제품 요구사항](docs/PROJECT_HANDOFF.md) | 최초 전체 요구사항. 현재 승인/상태는 위 문서가 우선 |

`CODEX_SESSION_START.md`는 역사적 최초 요청입니다. 현재 정책을 과거의 blanket 외부 전송 금지로 되돌리지 마세요.

## 확정된 정책

- 회사에서 승인한 **기존 Enterprise OAuth CLI**를 같은 PC·OS 계정에서 실행합니다. 작업에 필요한 코드·파일명·상대경로·Diff·Context는 사용자가 선택한 해당 공급자로 보낼 수 있습니다. 회사 관리 정책이 우선입니다.
- Task·History·Memory·로그·프로젝트 설정은 **각 PC 로컬, Git 밖**에 저장합니다. 회사 코드·개인정보·DB·프롬프트·로그·실행 기록을 개인 GitHub나 집 PC에 보내지 않습니다.
- 인증은 각 CLI가 관리합니다. 앱이 토큰을 수집·복사하지 않으며, 별도 유료 API 키나 자동 API fallback을 도입하지 않습니다.
- 제품 배포는 집 macOS → 개인 GitHub → 회사 Ubuntu입니다. 회사 토큰을 사용한 **회사 PC에서의 로컬 제품 개발은 승인**됐지만, 회사 → 개인 GitHub Push는 별도로 허용되지 않았습니다. 회사 수정과 근거는 로컬에 보관합니다.
- 이 공개 저장소에는 제품 코드·일반 문서·비민감 합성 샘플만 포함합니다. 앱에는 GitHub 업로드/Push·집 PC 동기화 기능이 없습니다.

## 현재 확인된 상태

| 범위 | 상태 |
|---|---|
| Project 등록, Task 생성/이름 변경, SQLite History/Memory | 구현 및 자동 테스트 |
| Mock 실행·취소·재실행·Context 인계, Git Diff | 구현. 회사 Ubuntu에서 사용자 확인 |
| 서버 재시작 후 Task·History·Memory 유지 | 회사 Ubuntu에서 사용자 확인 |
| 실제 Codex 읽기·수정·로컬 Git Diff | macOS CLI 0.154.0 비민감 샘플에서 검증 |
| Codex 추가 권한 승인·거절, 세션/모델 기록 | 구현 및 합성 프로토콜 테스트 |
| Claude/Gemini headless Adapter | 구현 및 합성 테스트. 두 공급자의 회사 실동작 전체 검증은 미완료 |
| 회사 Gemini | 0.66.0, 세션 생성 이후 답변 정지 사례 보고. 해결 확인 전 |
| 실행 단계·대기/경과 시간·오류 분류·무응답 종료 | v0.3 구현 및 자동 테스트 |
| Git History 로컬 조회·선택적 실행 Context 첨부 | v0.3 구현 및 자동 테스트 |
| macOS/Ubuntu CI | v0.1 `103bbf4`, v0.2 `e29963d` 통과. 현재 커밋은 [Actions](https://github.com/isurit/agentDock/actions)에서 확인 |
| 회사 소스에서 실제 수정·Android Studio 빌드 | 미검증. Mock/합성 테스트로 대체 검증했다고 표시하지 않음 |

## 설치 / 업데이트 / 실행

Node **22.22.2** 기준입니다. Node 20은 지원하지 않습니다 (`node:sqlite` 사용). `nvm`이 이미 있으면 저장소 루트에서:

```sh
nvm install
nvm use
npm ci
npm run doctor
npm run dev
```

브라우저: **http://127.0.0.1:4317** — 이 주소를 그대로 사용하세요. localhost 외부 공개·포트 포워딩은 지원하지 않습니다.

기존 사용자는 서버를 먼저 종료한 뒤:

```sh
git pull --ff-only
nvm use
npm ci
npm run doctor
npm run dev
```

DB schema v1은 유지되므로 기존 Task를 지우거나 재등록할 필요가 없습니다. 실제 사용 전 승인된 로컬 백업을 권장합니다. macOS의 node_modules를 Ubuntu로 복사하지 마세요.

빌드된 화면으로 실행하려면:

```sh
npm run build
npm start
```

`PORT`로 포트를 바꿀 수 있지만 항상 127.0.0.1에 바인딩합니다. `npm start` 전에는 다시 빌드해야 합니다.

## 테스트할 기본 흐름

```sh
npm run sample
```

출력된 임시 샘플 경로를 새 Project로 등록하고 Task → Memory → Mock 재실행 → Context → Git Diff/History → 재시작 복원을 확인합니다. 샘플은 고의적인 로컬 변경사항이 있는 작은 Kotlin/Git fixture이며 **빌드 가능한 Android 앱이 아닙니다**. Mock은 코드를 수정하지 않습니다. Git Diff는 Task가 만든 변경만이 아니라 등록한 Project 전체의 현재 변경사항입니다.

실제 Agent는 같은 OS 사용자와 PATH에서 작동하는 CLI를 선택하세요. 처음에는 읽기 전용, 허용된 모델, 명시적 공급자 전송 동의로 시작합니다. `프로젝트 수정 허용`은 실제 파일 수정 권한을 줍니다. Auto는 Mock 기본값이며, 자동으로 다른 공급자/모델을 선택하지 않습니다.

Git 이력 질문에는 `최근 Git 이력 10개를 이번 실행 Context에 포함`을 선택하면 CLI shell 승인이 없어도 해시·제목을 참고할 수 있습니다. **전체 commit diff나 코드 변경을 읽은 것과는 다릅니다.** Git History 탭 자체는 로컬 조회이고, 실행 Context 첨부는 선택한 공급자에게 전달될 수 있어 별도 선택/동의가 필요합니다.

## 회사에서 바로 쓸 점검 명령

```sh
npm run doctor
npm run verify:headless -- --live --provider gemini
```

첫 명령은 Node/OS/CLI 버전과 지원 플래그만 출력합니다. 계정·경로·회사 코드·토큰을 읽거나 모델을 호출하지 않습니다. 두 번째는 **기존 로그인과 토큰을 사용**해 비민감 임시 Git 프로젝트에서 단순 응답과 첨부 Git 이력 요약을 실제 요청합니다. 원문 답변·프롬프트·경로·세션 ID를 출력하지 않고 단계/오류 범주를 출력합니다. 로그인 또는 회사 관리 정책 문제를 우회하지 않습니다.

```sh
npm run verify:headless -- --live --provider claude
npm run verify:headless -- --live --provider gemini --model YOUR_ALLOWED_MODEL
npm run verify:codex -- --live --list-models
npm run verify:codex -- --live --model YOUR_ALLOWED_MODEL
```

`--live` 명령은 CI에서 실행하지 않습니다. 지원 모델은 계정마다 다르며 임의 fallback은 없습니다. `doctor` 성공은 Enterprise 인증이나 모델 사용권 확인을 의미하지 않습니다.

## 실행이 멈춘 것처럼 보일 때

`session.started`는 CLI가 세션 ID를 만들었다는 뜻으로, 모델 답변·작업 완료의 증거가 아닙니다. v0.3 화면은 입력 전달, 세션 생성, 모델 대기, 응답 수신, 도구 실행, 결과 수신을 구분합니다. 약 15초마다 출력량·대기 시간을 기록하며, 이는 **프로세스 상태이지 모델의 사고 진행률이 아닙니다**.

Headless 기본 무응답 한도는 답변/도구 이벤트가 없는 약 180초, 전체 실행 한도는 15분입니다. stderr 재시도만 반복돼도 무한 대기하지 않습니다. 긴 작업은 로컬 실행 환경에서 명시적으로 조정할 수 있습니다.

```sh
AGENTDOCK_CLI_IDLE_TIMEOUT_SECONDS=300 npm run dev
```

허용 범위는 30~900초입니다. 느린 정상 작업도 한도에 걸릴 수 있습니다. timeout은 자동 재실행하지 않으며, 기존 작업/CLI 상태를 확인하고 사용자가 다시 실행해야 합니다. 중단 버튼은 현재 실행과 소유한 하위 프로세스를 정리합니다.

권한 문제를 해결하려고 yolo/bypass/full-access를 켜거나 회사 관리 설정·인증파일을 수정하지 마세요. Claude/Gemini에는 아직 Dashboard 승인 브리지가 없습니다. Gemini Plan의 shell 제한 가능성과 실제 회사 정지 원인은 [알려진 문제](docs/KNOWN_ISSUES.md)에 구분했습니다.

## 개발과 검증

```sh
npm test
npm run build
npm run privacy
```

현재 오프라인 테스트는 **22개**입니다. 저장/복원, 승인/취소, 프로세스 정리, 공급자 프로토콜, Session/Context 인계, 무응답·stderr 재시도·종료 지연, UI 스트림 병합/갱신, Git Context를 검증합니다. 합성 CLI 테스트는 실제 Enterprise 공급자 성공 증거가 아닙니다.

코드 진입점:

- `apps/web/src/main.tsx`: Project/Task UI, 실행 설정·동의, 상태/타임라인/Memory/Git
- `apps/server/src/app.ts`: 동일 Origin의 HTTP/WebSocket API와 세션 토큰
- `apps/server/src/store.ts`: SQLite v1, 이벤트·Memory·Handoff·복구
- `packages/orchestrator/src/index.ts`: 프로젝트 잠금, 실행, 승인, Context 조합
- `packages/agent-adapters/src/{codex,headless,process,context}.ts`: 공급자·프로세스·프롬프트 경계
- `packages/project/src/index.ts`: 등록 경로, 로컬 Git Diff/History
- `packages/core/src/timeline.ts`: 스트림 표시와 중복 refresh 병합
- `tests/fixtures/fake-cli.mjs`: 네트워크/인증 없는 프로토콜 재현 fixture

## 로컬 데이터 / 아직 없는 기능

macOS 기본 저장 위치는 현재 사용자의 `Library/Application Support/AgentDock`, Linux는 `.local/share/agentdock`입니다. `AGENTDOCK_DATA_DIR`로 **Git·동기화 폴더 밖의 로컬 절대경로**를 선택할 수 있습니다. SQLite/WAL·세션·로그를 저장소에 옮기지 마세요. OS 백업/디스크 암호화/보관 기간은 회사 정책을 확인해야 하며 앱 자체 암호화는 없습니다.

미완료: Gemini 정지의 회사 실환경 원인 규명, Claude/Gemini 승인 브리지, 네이티브 Session resume, 병렬 worktree, 정교한 자동 Router/쿼터, Logcat/Gradle 아티팩트, Memory 편집/삭제·보관 정책 UI, 자동 백업/마이그레이션 도구, CI 브라우저 smoke. 모두 완성된 것처럼 표시하지 마세요.
