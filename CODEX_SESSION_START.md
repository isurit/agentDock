# Codex 세션 시작 프롬프트 — AgentDock

이 저장소는 AgentDock: Claude Code CLI, Gemini CLI, Codex CLI를 기존 OAuth 로그인 상태로 사용하는 **로컬 웹 기반 멀티 에이전트 Android 개발 워크스페이스**다.

프로젝트 리포지토리: `https://github.com/isurit/agentDock.git`

**먼저 첨부된 `AGENTDOCK_PROJECT_HANDOFF.md` 전체를 읽고 이 문서를 이번 작업의 상위 제품 요구사항으로 사용해줘.** 프로젝트 안에 문서가 없다면 이 문서를 `docs/PROJECT_HANDOFF.md`로 복사한 뒤 진행해.

핵심 제약:
1. 집 macOS의 Codex가 주요 개발을 수행하고, 개인 GitHub에 push한다. 회사 Ubuntu에서는 **clone/pull만** 하고 회사 정보를 개인 저장소에 push하지 않는다.
2. 회사에서는 실제 OAuth 로그인된 Claude/Gemini/Codex CLI와 로컬 Android 프로젝트를 사용한다. 집에서는 Mock 및 실제 Codex로 최대한 검증한다.
3. 웹 UI는 Task-first다. 단일 Task의 History/Memory/Context는 Agent를 변경해도 유지한다. Provider-native CLI 세션 자체가 통합된다는 허위 가정은 하지 않는다.
4. Router(Agent/Model 선택), Runtime Adapter(CLI 실행), Context/Handoff, Task/History, Git/Project, UI를 분리한다.
5. 모델 사용 한도 정보는 공급자별 접근 가능성이 다르다. 모르는 것은 Unknown으로 표시하고 자동 라우팅은 초기 규칙 기반으로 구현한다.
6. Node/React/TypeScript/SQLite/WebSocket 등 가벼운 로컬 구조를 우선한다. OpenHands, 대형 플랫폼, 별도 모델 API 과금을 전제로 삼지 않는다.
7. 보안 기본값: localhost 바인딩, 인증정보 직접 수집/저장 금지, 승인 없이 위험 명령 실행 금지, Git 밖의 앱 데이터 폴더, 회사 소스/로그의 개인 GitHub 업로드 금지.
8. Android Studio는 계속 빌드/실행/디버그에 사용한다. AgentDock은 소스 작업·검토·로그 분석을 맡는다.
9. macOS/Ubuntu CI 및 비민감 샘플 프로젝트를 통해 호환성 검증을 자동화한다.

**진행 요청:**
- STEP 1: 현재 저장소를 확인하고, 요구사항의 위험/충돌/미확정 항목과 현실적인 단계별 구현 계획을 짧게 제시해줘.
- STEP 2: 최소 아키텍처/데이터 계약을 결정하고 이유를 `docs/DECISIONS.md`에 기록해줘.
- STEP 3: 모노레포, 실행 가능한 웹+서버 기본 구조, SQLite Task/History, Mock Agent, WebSocket 이벤트, 테스트, GitHub Actions macOS/Ubuntu CI를 구현해줘.
- STEP 4: Mac에서 사용 가능한 **실제 Codex CLI**를 검증하고 Adapter를 추가해줘. Claude/Gemini는 동일 인터페이스를 준비하되 검증 여부를 명시해줘.
- STEP 5: README, AGENTS.md, docs/ARCHITECTURE.md, ROADMAP.md, HANDOFF.md, SECURITY.md, UBUNTU_VALIDATION.md를 최신 상태로 정리해줘.

각 단계가 끝날 때 `검증 완료`, `미검증`, `회사에서 수행할 검증`을 구분해 기록하고, 동작하지 않는 Mock 화면을 실제 기능처럼 포장하지 마. 파일/프로세스/계정 조작 등 안전상 민감한 행동은 승인 정책을 우선해.

내가 직접 결정해야 할 설계 갈림길이 있다면 선택지를 제시하되, 일반적인 구현 세부사항은 합리적인 기본값을 정해 진행해줘.
