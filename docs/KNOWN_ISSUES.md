# 알려진 문제와 조사 상태

## AD-001 — 회사 Gemini 0.66.0: session.started 뒤 답변 없음

상태: **실제 회사 원인 미확정, 해결 확인 전**.

### 확인된 사실

- 사용자가 회사 Ubuntu에서 서버/UI, Project/Task/Mock/Git Diff와 재시작 후 데이터 유지를 확인했다.
- 실제 Gemini를 선택하고 공급자 전송에 동의한 뒤 최신 Git 이력을 질문했다.
- History에 session.started까지만 표시됐다고 보고했다. Gemini 버전은 0.66.0이다.
- 대기 시간·선택 모델·실제 stderr·네트워크·hooks/MCP 구성은 수집하지 않았다. 회사 원문/경로/인증정보는 집으로 받지 않았다.
- 같은 회사 PC에서 터미널 Gemini를 기존 Enterprise OAuth로 사용 중이라는 사용자 설명이 있다. Dashboard headless 동작과 동일하다고 단정할 수 없다.

### 기존 구현에서 확인한 관측 한계

v0.2는 Gemini init을 session.started로 기록했지만 user 이벤트는 무시했고 stderr는 프로세스 메모리에만 보관했다. 첫 모델 응답 이전 상태와 재시도/권한/연결 범주를 UI에서 구분하기 어려웠다. 전체 15분 한도 전에는 아무 이벤트가 없는 것처럼 보일 수 있었다. terminal result 뒤 프로세스가 남는 경로 역시 종료를 기다렸다.

v0.66.0 공식 소스에서 init은 모델 응답 이전에 발생한다. user 메시지, assistant/tool 이벤트, result를 별개로 다룬다. 따라서 세션 ID만으로 답변 성공이나 원격 모델 처리 완료를 판단하지 않는다.

### 아직 가설인 것

| 가설 | 분리 방법 |
|---|---|
| 모델 연결/재시도·회사 proxy/계정/model 차이 | 합성 plain-response부터 실행, generic stderr 범주·단계 로컬 관찰 |
| CLI 준비/Context/at-include/hooks/MCP 단계 지연 | init 뒤 user 이벤트 여부, 합성 프로젝트와 원래 프로젝트 비교 |
| Plan shell 정책 때문에 git 도구 실행이 불가능 | tool_use/tool_result 이후 permission 범주 확인; 선택적 Git Context 첨부와 비교 |
| 결과는 받았지만 CLI 배경 핸들이 종료를 막음 | result_received가 있는지 확인 |
| UI refresh/streaming 표시 지연 | stdout/상태 이벤트·새 직렬 refresh/주기 조회 비교 |

어느 가설도 현재 실제 회사 원인으로 확정하지 않았다. Plan 정책을 풀거나 yolo로 우회해 해결됐다고 표시하지 않는다.

### v0.3 조치 (합성 회귀 검증)

- 입력/세션/모델 대기/응답/도구/결과 단계를 구분하고 경과 시간을 표시한다.
- 15초 주기로 byte/idle 정보를 기록하며, raw stderr 대신 오류 범주만 표시한다.
- 의미 있는 답변/도구 이벤트가 약 180초 없으면 종료한다. stderr 재시도는 이 한도를 무한 연장하지 않는다. 30~900초 설정, 전체 15분 한도가 있다.
- 유효한 terminal result를 받은 뒤 3초 이상 프로세스가 남으면 cli.cleanup 경고 후 소유 프로세스를 정리한다. 정상 nonzero 종료는 여전히 실패다.
- warning을 곧바로 fatal로 취급하지 않고, tool permission 실패는 성공으로 숨기지 않는다.
- 로컬 Git History(최근 10개 해시·제목)를 명시적 선택으로 Context에 첨부할 수 있다. shell 권한을 변경하지 않는다.
- doctor 및 비민감 headless live smoke를 제공한다. 오프라인 stall/retry/linger fixture가 있다.
- UI refresh를 직렬화/병합하고 partial 메시지를 run/item 단위로 합친다.

### 수용 기준 / 회사에서 남은 작업

1. Gemini 0.66.0 실제 plain-response가 완료되고 Session/모델/결과가 로컬 History에 남는다.
2. 합성 Git Context 요약이 완료되고, Context에 포함하지 않은 이력은 무단 첨부하지 않는다.
3. 원래 프로젝트에서 같거나 다른 현상이 발생하는 이유를 근거로 구분한다.
4. 실패/권한/연결/무응답과 사용자 취소가 분명하게 표시되고 소유 프로세스와 잠금이 정리된다.
5. 확인 결과는 회사에 보관하며 공개 이슈/저장소에는 허용된 일반화 재현만 남긴다.

### 참고한 1차 자료

- https://raw.githubusercontent.com/google-gemini/gemini-cli/v0.66.0/packages/cli/src/nonInteractiveCli.ts
- https://raw.githubusercontent.com/google-gemini/gemini-cli/v0.66.0/packages/cli/src/gemini.tsx
- https://geminicli.com/docs/cli/headless/
- https://geminicli.com/docs/cli/plan-mode/

## AD-002 — Claude/Gemini의 Dashboard 승인 브리지 부재

현재 headless native 정책을 사용하며 읽기 전용/편집 모드를 완전히 같은 OS sandbox로 보장하지 않는다. 회사의 CLI 설정/hooks/승인 정책이 영향을 준다. 권한 대기를 자동 승인하거나 bypass하지 않으며 미지원 권한은 실패로 기록한다. 공식 프로토콜과 기존 Enterprise OAuth를 유지하는 방식으로 브리지를 설계해야 한다.

## AD-003 — 강제 종료와 네이티브 Session resume

정상 중단/오류/timeout은 소유 POSIX 프로세스 그룹을 종료한다. SIGKILL/OS 장애는 정리 기회를 없애므로 이전 프로세스가 확실히 종료됐다고 단정할 수 없다. 재시작은 중단됨으로 기록하고 자동 재시도하지 않는다. 네이티브 세션 재개는 아직 없으며, 현재는 새 run에 공통 Context를 재구성한다.

## 운영상 한계

- Node 20 미지원. Node 22.22.2 기준이며 SQLite는 해당 Node에서 experimental 경고가 있다.
- Quota는 Unknown이며 model/list가 계정 사용권을 보장하지 않는다. 자동 대체는 없다.
- 데이터는 OS 사용자 권한으로 보호하지만 앱 자체 암호화/자동 보관 삭제/백업 UI는 없다.
- CI는 실제 Enterprise 계정을 호출하지 않는다. 합성 성공만으로 회사 실사용 완료를 선언하지 않는다.
