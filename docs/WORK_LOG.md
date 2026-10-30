# 작업 이력 — 사용자 결정과 개발 경과

날짜 기준: 2026-10-30. 회사 원문/경로/로그/계정 자료 없이 제품 수준의 이력만 기록한다.

## 최초 인계

첨부 인계 문서와 세션 시작 요청을 읽었다. 제품 목표는 Task 중심 Android 개발 워크스페이스이며, Router/Adapter/Context/Task/Git/UI 분리, 기존 CLI OAuth, SQLite/React/Node, macOS 개발과 Ubuntu 검증이었다. 초기에는 문서만 있었고 상위 Dashboard와 구분되는 독립 Git 저장소를 만들었다.

## v0.1 — 로컬 기반 (103bbf4)

- 개인정보/GitHub 업로드 범위와 외부 provider 전송을 처음에는 동일한 금지로 해석했다. 사용자의 당시 blanket 금지 유지 답변에 따라 실제 CLI를 막고 로컬 MVP를 구현했다.
- Project/Task/History/Memory, Mock 실행/취소/Context, Git Diff, 접근 제어, 프로세스 복구 및 제품/런타임 데이터 분리를 만들었다.
- macOS 8개 테스트·빌드·브라우저 흐름 및 macOS/Ubuntu CI가 통과했다.
- 사용자 요청으로 main에 배포했다. 회사의 Node 20 engine 경고는 Node 22.22.2 사용으로 안내했다.
- 사용자가 회사 Ubuntu에서 서버/UI, Project/Task/Mock, 샘플 Git Diff, 재시작 후 기록 유지까지 확인했다. Mock은 실제 파일을 수정하지 않는다는 점을 설명했다.

## 정책 명확화

사용자는 회사 PC에서 Gemini/Claude/Codex를 기존 Enterprise OAuth로 사용하며 코드 수정 요청을 이미 하고 있다고 설명했다. 개인 GitHub/집 PC로의 회사 데이터 반출 금지와 선택한 승인 CLI 공급자에게 필요한 Context를 보내는 것을 구분해 제안했고, 사용자가 명시적으로 승인했다. 이 결정이 v0.1의 provider blanket 금지를 대체한다. 저장/배포 제한은 유지한다.

## v0.2 — 실제 CLI 경로 (e29963d)

- Codex App Server stdio와 sandbox/user approval/streaming, session/model 저장, 모델 목록, Task Context 인계를 구현했다.
- Claude/Gemini headless JSONL Adapter, stdin 프롬프트, native plan/edit 정책과 terminal 결과 판정을 구현했다. 집에는 두 CLI가 없어 실호출은 하지 못했다.
- 프로젝트 단위 실행 잠금, 소유 프로세스 그룹 종료, 승인 수명주기, explicit consent, 합성 프로토콜 회귀를 추가했다.
- macOS Codex 0.154.0에서 비민감 임시 샘플의 실제 읽기·파일 수정·Git Diff를 확인했다. 처음 설정된 모델은 계정에서 거부됐고 CLI 목록에서 명시적으로 선택한 모델은 성공했다. 제품에는 모델을 하드코딩하거나 자동 fallback하지 않았다.
- 14개 오프라인 테스트, 빌드, macOS/Ubuntu CI가 통과하고 공개 제품 코드만 main에 Push했다.
- 회사 Gemini 0.66.0에서 Git 최신 이력 질문이 session.started 이후 답변 없이 보인다는 사용자 보고를 받았다. 대기 시간과 실제 모델/오류 원인은 확인하지 못했다.

## v0.3 — 진단과 회사 개발 재개 준비

사용자는 집에서 회사 환경 디버깅이 어렵다고 판단하고, 개발 가능한 기반을 최대한 준비해 Push하고 이후 회사 토큰으로 개발을 이어갈 README/이력/요구사항/인계를 요청했다.

- init만 표시되던 관측 한계를 보완: CLI 단계·대기/경과 시간, stdout/stderr 양과 일반화된 오류 범주, 입력 user 이벤트 처리.
- headless 무응답 약 180초/전체 15분 한도, 경고/권한 실패 구분, terminal result 후 종료 지연 정리, cached-credential 성공 문구의 오분류 방지.
- 최근 Git 해시·제목 로컬 조회와 opt-in Context 첨부. native shell 승인 정책을 우회하지 않음.
- streaming 메시지 병합, refresh 직렬화와 중복 병합, 실행 중 주기 조회, 상태 패널.
- doctor, 두 단계 비민감 headless live smoke, 회사 재개 프롬프트/문서/알려진 문제/백로그 작성.
- 기존/신규 총 22개 오프라인 테스트와 빌드 통과. doctor가 버전·기능만 출력하는 것을 확인.
- 회사 Gemini 실제 원인과 해결 확인은 미완료이며, 합성 stall/retry/linger 테스트를 실제 회사 재현으로 표시하지 않는다.

## 후속 기록 규칙

매 단계마다 변경 이유, 영향받은 계약/코드, 실제 검증과 합성 검증, 미검증, 다음 재현/완료 기준을 남긴다. 회사 원문, 소스, DB, 로그, 실제 경로, 계정/세션 자료를 이 문서나 개인 GitHub에 넣지 않는다. 공개 커밋 이력은 제품 변경만 나타내며 실제 회사 실행 History는 각 PC의 로컬 DB에 있다.
