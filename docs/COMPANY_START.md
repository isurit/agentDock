# 회사 토큰으로 개발을 이어갈 때

## 시작 원칙

README를 진입점으로 사용하고 AGENTS.md, DECISIONS, KNOWN_ISSUES, HANDOFF를 읽으세요. 이 문서는 회사 PC에서 승인된 기존 Enterprise CLI로 **로컬 제품 개발을 계속하기 위한 인계**입니다. 개인 GitHub로의 회사 Push·회사 소스/로그의 집 PC 전송을 허용하는 문서가 아닙니다.

제품 저장소와 타겟 Android 저장소, 앱 DB 디렉터리를 구분하세요. AgentDock 제품 코드 안에 타겟 소스나 런타임 자료를 복사하지 마세요. 제품 저장소는 공개입니다. 회사에서 생긴 수정은 로컬 브랜치에 보관하고, 공개 배포는 별도 회사 정책/사용자 지시가 있을 때만 검토합니다.

## 업데이트와 작업 브랜치

실행 중인 서버를 종료하고, 기존 제품 작업 트리에 회사 수정이 없는지 로컬에서 확인합니다. 기존 변경을 reset/clean으로 지우지 마세요.

```sh
git status --short
git pull --ff-only
nvm use
npm ci
npm run doctor
npm test
npm run build
```

필요하면 새 로컬 브랜치에서 작업합니다.

```sh
git switch -c company-local/continue-development
```

이후 개인 GitHub에 push하지 않습니다. 이미 로컬 변경이 있으면 그대로 보존하고 최신 버전과의 통합 방법을 검토하세요.

앱 DB는 계속 같은 로컬 위치를 사용합니다. v0.3은 schema v1과 호환되며 DB 초기화는 필요하지 않습니다. DB/실행 기록을 디버깅용으로 공개 저장소에 추가하지 마세요.

## 첫 작업: Gemini 0.66.0 무응답 원인 분리

보고된 사실: 회사 Ubuntu의 Gemini 0.66.0에서 실제 Agent를 선택하고 동의 후 Git 최신 이력을 질문했을 때 `session.started`만 보였습니다. 대기 시간, 모델, API 응답, stderr, 설정·hooks·MCP 상태는 확인되지 않았습니다. 회사에서 터미널 Gemini는 기존 Enterprise OAuth로 사용 중이라는 설명이 있습니다.

v0.3은 실제 회사 문제를 재현/해결했다고 주장하지 않습니다. 기존 Adapter의 관측 누락과 테스트 가능한 실패 경로를 보완했습니다.

1. `npm run doctor`로 Node와 CLI 버전/지원 플래그를 로컬 확인합니다. 앱과 성공하는 터미널 CLI의 OS 계정·PATH가 같은지 확인하되 인증파일/토큰을 열거나 옮기지 않습니다.
2. `npm run verify:headless -- --live --provider gemini`를 실행합니다. 단순 무도구 응답 → 제공된 합성 Git 이력 요약 순서입니다. 원문/경로를 출력하지 않습니다.
3. 단순 응답부터 실패하면 Git 명령 문제가 원인이라고 확정하지 마세요. CLI의 provider/model, 회사 proxy/네트워크, headless 인증, hooks/설정을 승인 범위에서 조사합니다.
4. 단순 응답과 첨부 Git Context가 성공하면 Dashboard의 비민감 샘플에서 같은 흐름을 수행합니다. `최근 Git 이력 ... Context에 포함`을 선택해 shell 도구 의존성을 분리합니다.
5. 원래 회사 프로젝트에서만 실패하면 프로젝트 규칙, Context 크기, ignore/at-include 처리, CLI hooks/MCP, 모델 요청/정책 차이를 **회사 로컬에서** 비교합니다.
6. `session_initialized`에서만 머물면 provider 요청 이전 처리나 준비 단계일 수도 있습니다. `waiting_for_model`은 Gemini user 이벤트를 관찰했다는 뜻이지 원격 서버 수신 확인이 아닙니다.
7. `tool.status`가 나온 뒤 권한 실패면 native policy 경로를 확인합니다. Plan에서는 shell이 제한될 수 있으므로 승인 브리지 또는 안전한 로컬 Context 기능을 검토합니다. yolo로 통과시키지 않습니다.
8. `result_received` 뒤만 정지하면 프로세스 종료/정리 경로를 봅니다. v0.3은 유효한 terminal result 후 배경 핸들이 남으면 경고를 남기고 소유 프로세스를 정리합니다.

모델이 필요한 경우 회사 계정에서 허용된 ID를 명시합니다. 자동 provider/model 대체는 하지 않습니다. 무응답 timeout은 180초이며 느린 정상 작업이면 30~900초 범위에서 명시적으로 조절할 수 있습니다. 전체 한도는 15분입니다.

## 조사할 코드와 관측 지점

| 관측/변경 | 위치 |
|---|---|
| Gemini stdin, plan/auto_edit, JSONL 이벤트 | packages/agent-adapters/src/headless.ts |
| spawn/환경, raw stderr 메모리 버퍼, 일반화 오류 범주, 하위 프로세스 종료 | packages/agent-adapters/src/process.ts |
| bounded 프롬프트/Memory/이전 지시/Git Context | packages/agent-adapters/src/context.ts |
| run.started → probe → 선택적 Git 수집 → Adapter → 종료 | packages/orchestrator/src/index.ts |
| SQLite 이벤트 및 Session/모델 저장 | apps/server/src/store.ts |
| UI 상태 패널, WebSocket invalidation, 직렬 refresh | apps/web/src/main.tsx |
| session-only / stderr-retry / terminal-linger 재현 | tests/fixtures/fake-cli.mjs, tests/adapters.test.ts |
| 실제 토큰 없는 전체 회귀 | npm test |

`cli.waiting`의 stdout/stderr byte와 transport idle은 프로세스 I/O 지표입니다. 모델의 실제 사고 진행 여부나 공급자 서버 상태로 해석하지 않습니다. stderr 원문은 이벤트/doctor에 저장하지 않고 일반화된 오류 범주만 기록합니다. 원인 조사가 필요하면 회사 PC에서 직접 확인하고 외부에 복사하지 마세요.

## 이후 개발 우선순위

- AD-001: Gemini 최소 실제 응답, Git Context 요약, 취소까지 회사 검증. 실패를 일반화한 로컬 fixture 추가.
- AD-002: Gemini/Claude interactive permission → Dashboard bridge. 공급자 공식 프로토콜/SDK와 Enterprise OAuth 호환성을 먼저 확인. API-key 전용 모드로 바꾸지 않음.
- AD-003: 실행 재개/고아 프로세스 관리. 네이티브 Session ID를 단순 저장한 것과 재개를 구분. PID 재사용 위험 없이 소유권 검증 필요.
- AD-004: 사용자 확인 Memory의 편집·삭제, 원문 근거, 보관/백업/복구. DB migration은 선행 백업과 실패 복구가 있어야 함.
- AD-005: Android Logcat/Gradle 테스트 결과를 로컬 아티팩트로 연결. 명령 승인과 민감정보 보호 선행.
- AD-006: 규칙 기반 추천 Router, 모델 목록/가용성. 쿼터가 없으면 Unknown. 병렬 쓰기는 worktree 격리 뒤에만.

세부 수용 기준은 ROADMAP.md를 따릅니다. 당장 모든 Agent를 병렬 실행하거나 자동 provider fallback을 추가하지 마세요.

## 다음 Agent에 전달할 시작 프롬프트

```text
이 저장소는 AgentDock이다. README.md부터 읽고 AGENTS.md,
docs/COMPANY_START.md, docs/KNOWN_ISSUES.md, docs/HANDOFF.md,
docs/DECISIONS.md와 원본 요구사항을 확인해라.

회사 승인 Enterprise OAuth CLI와 회사 토큰으로 이 PC에서 개발을 이어간다.
회사 코드/개인정보/DB/프롬프트/로그/실행 기록을 개인 GitHub나 집 PC로
보내지 말고, 개인 GitHub로 push하지 마라. 기존 회사 변경을 지우지 마라.
인증파일/토큰을 직접 읽거나 복사하지 말고 관리 정책을 우회하지 마라.

최우선은 Gemini 0.66.0에서 session.started 뒤 답변이 없던 사례다.
실제 원인은 아직 모른다. doctor와 비민감 live smoke로 단순 응답부터
분리하고, 새 phase/diagnostic 이벤트를 로컬에서 관찰해 원인을 좁혀라.
합성 테스트가 통과했다고 Enterprise 실연동 성공으로 쓰지 마라.
변경은 최소 재현·회귀 테스트·실제 검증 근거로 연결하고,
README/WORK_LOG/KNOWN_ISSUES/HANDOFF를 최신 상태로 유지해라.
```

## 완료 기준

설치/빌드/22개 이상 회귀 테스트 통과와 함께, 회사에서 선택한 실제 provider의 최소 응답·취소·실패 처리가 확인돼야 합니다. 추가 권한, 모델/한도 오류, 재시작 시 자동 재실행 방지, 로그/회사 소스의 Git 제외도 확인하세요. 아직 안 한 검증은 명시적으로 미검증으로 남깁니다.
