# 개발 로드맵 — 회사 로컬 후속 작업

회사 개발은 승인된 CLI/토큰과 회사 정책 안에서 수행한다. 개인 GitHub로의 회사 Push는 기존대로 금지다. 모든 완료 주장에는 실제/합성/미검증 범위를 표시한다.

## P0 — AD-001 Gemini 실제 최소 흐름 복구

시작: COMPANY_START.md와 KNOWN_ISSUES.md.

- doctor, 합성 plain-response, Git Context 요약을 실제 Gemini 0.66.0으로 순차 실행한다.
- session_initialized/input/user-event/model/tool/result/cleanup 단계로 실패 위치를 분리한다.
- 모델/auth/proxy/회사 정책/프로젝트 hooks/Context 처리 차이를 근거로 확인한다. 실제 자료는 회사에만 보관한다.
- 수정은 비민감 최소 재현 fixture와 회귀 테스트로 연결한다.

완료: 같은 OS 계정의 실제 Gemini에서 답변·취소·권한/연결/모델 실패를 재현하고, 회사 타겟에서의 상태를 별도로 기록. 새 초기화 이벤트만으로 성공 선언 금지.

## P0 — AD-002 Claude/Gemini 승인 브리지

- 공식 CLI/ACP/SDK 중 현재 Enterprise OAuth와 호환되는 transport를 검증한다.
- 지원되는 tool approval을 run/task에 매핑하고, 대기·단발 승인/거절·취소·만료·재시작을 기록한다.
- 없는 권한을 yolo/bypass로 대체하지 않는다. 별도 API-key 전용 모드로 전환하지 않는다.
- 조직이 승인한 CLI config/hooks/MCP와 앱의 경계를 명확히 한다.

완료: 권한 요청 내용이 브라우저에 보이고 잘못된 Task·중복·오래된 답변은 거절되며 실제 명령/편집과 결과가 확인됨.

## P1 — AD-003 세션 재개와 실행 복구

- 공급자별 저장 가능한 Session과 ephemeral 실행을 구분한다.
- explicit resume를 사용자 지시에 연결하고 새 Handoff와 resume의 중복 Context를 제어한다.
- 강제 종료된 이전 실행의 소유권 확인 없이 PID만 보고 죽이지 않는다.
- 실제 완료/중단/불확실을 분리한다. 자동 재실행으로 중복 수정을 만들지 않는다.

완료: 재시작·인증 만료·모델 변경·중간 실패·취소에서 잘못된 세션/다른 Task를 재개하지 않는 테스트와 실제 근거.

## P1 — AD-004 Memory/데이터 운영

- Memory 편집·삭제·범위 변경, 원본/사용자 확인/Agent 제안 구분.
- 큰 History의 서버 페이지 단위 탐색, 선택적 원본 Context, 요약 근거 추적.
- 삭제/보관 정책과 정지 백업/복구 검증. 미래 schema migration은 사전 백업·실패 rollback 선행.

완료: Project/Task 격리, 기존 DB 업그레이드/복원, 승인 없는 소실/외부 동기화 없음.

## P1 — AD-005 Android 워크플로

- Logcat 붙여넣기/파일, 오류 패턴, Gradle lint/test 결과를 로컬 artifact로 연결.
- 민감정보와 명령 실행 정책을 적용하고 모델 전송 범위를 선택한다.
- Android Studio를 계속 빌드/실행/디버깅 기준으로 사용한다.

완료: 비민감 Android fixture 한 건에서 분석 → 변경 → Git Diff → 검증 artifact 재조회까지 재현. 회사 앱은 별도 회사 검증.

## P2 — AD-006 Router/병렬 검토

- Task 종류/가용성 기반의 투명한 추천 규칙과 override.
- 실제 제공되는 quota만 표시; Unknown을 가짜 잔여 토큰으로 채우지 않음.
- 사용 한도/실패 때 대체 제안과 승인을 기록. 무언의 provider fallback 금지.
- 읽기 전용 교차 리뷰부터 시작하고, 병렬 writer는 worktree 격리/병합 정책 뒤에만 허용.

## 지속 작업

CI 브라우저 smoke, 대용량 타임라인 성능, lockfile/Node 호환성, local-only privacy 검사, 문서 갱신. 테스트와 요구사항이 단순히 구현을 따라 복제되지 않고 실제 실패/계약을 검증하도록 유지한다.
