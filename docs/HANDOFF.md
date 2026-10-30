# 현재 인계 — v0.3.0

**README.md → COMPANY_START.md → KNOWN_ISSUES.md**를 읽고 시작한다. 제품 코드와 회사 타겟 소스/DB를 혼합하지 않는다.

## 최신 사용자 요청

집에서 회사 Gemini 문제를 직접 디버깅하는 데 한계가 있어, 개발 가능한 기반을 최대한 준비해 Push하고 이후 회사 토큰으로 로컬 개발을 계속하기로 했다. README에서 이력·방향·요구사항·작업 내용과 재현 방법을 찾을 수 있어야 한다.

이는 회사에서 개인 GitHub로 Push하거나 회사 데이터/로그를 집 PC로 전송하도록 승인한 것이 아니다. 회사 승인 Enterprise CLI에는 작업에 필요한 코드/Context 전송이 허용된다. 인증은 같은 OS 계정의 기존 CLI OAuth가 관리한다.

## 이미 있는 기반

- React/Vite/TypeScript + Node/Express/ws + SQLite, npm workspaces, Node 22.22.2.
- Project/Task/History/Memory, 재시작 복구, Mock, 프로젝트별 run 잠금.
- Codex App Server 스트림·실제 Session/모델 기록·추가 승인·취소. 실제 macOS 합성 읽기/수정/Git Diff 검증 이력.
- Claude/Gemini headless stdin/JSONL/native plan/edit Adapter. 실제 회사 전체 성공은 미검증.
- Task 목표/현재·이전 지시/Memory/최근 결과의 bounded Handoff. 네이티브 Session resume는 없음.
- 로컬 Git Diff와 loopback/Origin/Host/HTTP·WS 토큰, Git 밖 runtime 데이터.

## v0.3에서 추가한 것

- session.started 이후 input/session/model-wait/response/tool/result 단계를 구분하고 경과 시간을 표시.
- generic stderr 오류 범주, byte/transport idle, 15초 대기 상태. raw stderr·계정·경로를 공개 보고/doctor에 포함하지 않음.
- headless meaningful-event idle 약 180초(30~900초 설정), 전체 15분. stderr 재시도는 무한 대기를 연장하지 않음.
- terminal result 이후 3초 이상 남는 프로세스 정리와 경고, nonzero 종료 실패, 경고/권한 실패 분리.
- 로컬 최근 Git History 10개 해시·제목, 명시적 Context 첨부. native shell 권한을 바꾸지 않음.
- streaming partial 병합, 새 완료 메시지로 교체, refresh 직렬/중복 병합, 실행 중 5초 조회.
- doctor, 비민감 두 단계 verify:headless, 회사 재개 프롬프트와 전체 한국어 문서 진입점.
- DB schema v1 유지. 기존 Task 데이터 초기화/이동 불필요.

## 검증 근거

| 범위 | 상태 |
|---|---|
| v0.1 회사 Ubuntu 로컬 흐름 | 사용자가 서버/UI·Project/Task/Mock·Git Diff·재시작 기록 유지 확인 |
| v0.2 macOS 실제 Codex 0.154.0 | 비민감 읽기/편집/로컬 Git Diff 성공. 설정 기본 모델 거부 후 CLI 목록에서 명시 선택 성공 |
| 과거 GitHub CI | 103bbf4와 e29963d에서 macOS/Ubuntu 통과 |
| v0.3 오프라인 회귀 | 22개 로컬 통과. 공급자 계정 호출 없음 |
| v0.3 TypeScript/production build | 로컬 통과 |
| doctor | macOS에서 일반 환경/CLI 기능 정보만 출력 확인. 인증/모델 호출 없음 |
| v0.3 회사 Gemini 0.66.0 | 아직 실제 검증 전. 사용자 보고는 init 뒤 정지이며 원인 미확정 |
| v0.3 Claude/Gemini live smoke | 명령 제공. 집에 두 CLI가 없어 실호출 미검증 |
| v0.3 CI | 배포 commit의 GitHub Actions 결과를 확인. 실제 Enterprise 호출은 CI 범위 밖 |

22개 테스트에는 기존 영속화/동의/Session/승인/프로세스/Context/HTTP·WS 검사 외에 session-only, stderr-retry, terminal-linger, recoverable warning, permission tool error, timeout 설정, credential 성공 알림 오분류, streaming UI/refresh 병합, 선택 Git Context의 저장·격리가 포함된다. 실제 회사 문제 재현으로 표현하지 않는다.

## 회사의 첫 작업

1. 서버 종료 → 변경 보존 → pull → nvm use → npm ci → doctor/test/build.
2. 로컬 작업 브랜치에서 비민감 verify:headless의 단순 응답부터 실행.
3. 새 단계/진단으로 init/user-event/model/tool/result 중 정지 위치를 확정.
4. 합성 Git Context와 회사 프로젝트의 차이를 로컬 비교. 정책/인증파일을 우회하지 않음.
5. 원인과 수정은 최소 재현·테스트·실제 근거로 남기고 README/WORK_LOG/KNOWN_ISSUES/HANDOFF 갱신.

## 아직 남은 제품 작업

Claude/Gemini 승인 브리지, native resume/고아 실행 복구, Memory 편집/삭제·보관/백업/복구, Android Logcat/Gradle artifact, 고급 Router/Quota, 병렬 worktree, CI 브라우저 smoke. 구체적인 순서와 완료 기준은 ROADMAP.md.

공개 저장소에는 제품 코드/일반 문서/lockfile/합성 fixture만 포함한다. 실제 회사 실행 History와 Runtime 데이터는 각 PC에만 있으며 이 문서에 복사하지 않는다.
