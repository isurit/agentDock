# 현재 요구사항과 구현 상태

원본 전체 요구사항은 PROJECT_HANDOFF.md이며, 최신 사용자 승인은 DECISIONS.md, 현재 상태는 이 문서/HANDOFF/KNOWN_ISSUES가 우선한다.

## 제품 목표 / 비목표

Task 하나에서 여러 승인된 CLI Agent를 순차 선택하며 목표·지시·결정·Memory·검증 근거를 이어가는 로컬 Android 개발 작업 공간이다. Android Studio는 빌드/실행/디버깅을 계속 담당한다. 단순 웹 터미널 모음, Android Studio 대체 IDE, 별도 모델 API 과금 플랫폼을 만들지 않는다.

Provider-native Session은 Task 아래 실행 단위다. 서로 다른 공급자의 세션이 공유된다고 표현하지 않는다. 공통 Context 재구성과 실제 네이티브 Session resume를 구분한다.

## 필수 제품 계약

| ID | 요구사항 | 현재 상태 |
|---|---|---|
| R01 | 로컬 Project 등록, 소스 복사/반출 금지 | 구현, canonical path 및 Git 조회 검사 |
| R02 | Task 생성/이름/상태, 실행 기록과 재시작 복원 | 구현, 회사 Ubuntu에서 기본 흐름 확인 |
| R03 | Task 단위 통합 History/사용자 지시와 Project/Task Memory | 생성/보관/인계 구현. Memory 편집/삭제·보관 정책 UI 미구현 |
| R04 | Mock과 실제 Agent 구분 | 구현. Mock 수정/테스트 성공 위장 금지 |
| R05 | 실제 Codex 기존 OAuth, 스트림/취소/승인 | macOS 합성 프로젝트 실검증 + 프로토콜 회귀. 회사 Codex 미검증 |
| R06 | Claude/Gemini 기존 Enterprise CLI | Adapter/합성 테스트 구현. 회사 Gemini 0.66.0 init 이후 정지 사례 조사 필요 |
| R07 | Agent 변경 후 공통 Context 인계 | 목표/현재·이전 지시/Memory/최근 결과/선택 Git 이력 구현. bounded selection이며 원본은 로컬 보존 |
| R08 | Git status/Diff/이력 확인 | Project 전체 working/staged diff, 미추적 이름, 최근 commit 해시/제목. Task 기여 변경만 분리하지 않음 |
| R09 | 실행 중/승인/응답 대기/실패 명확화 | 상태/단계/byte/idle, timeout, 일반화 오류. 실제 모델 진행률을 추정하지 않음 |
| R10 | 한 Project 동시 수정 충돌 방지 | Project별 한 run. 병렬 writer/worktree 미구현 |
| R11 | Auto/Manual Agent·Model과 투명한 Router | Manual 구현. Auto는 Mock 기본값. Task별 추천 정책과 쿼터 기반 선택은 미구현 |
| R12 | 모델/쿼터 가용성 | Codex 목록 + 수동 ID. 계정 권한과 quota는 Unknown 허용, 자동 fallback 없음 |
| R13 | 로컬 데이터/보안/회사 배포 | loopback, HTTP/WS Host·Origin·토큰, Git 밖 DB, 개인정보 업로드 금지. OS 암호화/회사 정책 검증 별도 |
| R14 | macOS/Ubuntu 호환성 | CI 정의와 과거 두 버전 성공. 현재 버전 commit의 Actions 결과 확인 필요 |
| R15 | Android 중심 실제 테스트 | Kotlin 합성 fixture만 존재. Logcat/Gradle artifact 연계·실제 앱 빌드는 미구현/미검증 |
| R16 | 백업/migration/업데이트 | schema v1 유지와 미래 version 거부. 수동 정지 백업 안내. 자동 backup/restore/migration UI 없음 |

## 데이터와 승인

개인정보/회사 소스/DB/프롬프트/로그/실행 기록은 개인 GitHub나 집 PC로 보내지 않는다. 선택된 회사 승인 Enterprise CLI 공급자에게 작업에 필요한 Context를 보내는 것은 사용자 승인 범위다. 토큰 수집/계정 간 복사/별도 API-key fallback은 금지다.

실제 실행은 공급자/권한 선택과 per-run consent가 필요하다. 읽기 전용이 기본이며, workspace-write 선택은 native 정책 안에서 실제 프로젝트 수정/명령 권한을 준다. Codex의 추가 권한만 브라우저에서 한 번 승인/거절한다. 읽기 전용 escalation과 프로젝트 밖 쓰기 grant는 거절한다. Claude/Gemini 브리지는 미구현이며 yolo/bypass로 대체하지 않는다.

재시작/네트워크 복구/한도 오류 때 불확실한 실행을 자동 재전송하지 않는다. 실패/중단과 실제 완료를 구분하고, 확인하지 못한 quota/auth/model/회사 검증은 Unknown/미검증으로 남긴다.

## 이번 인계의 완료 기준

- 설치·빌드·22개 오프라인 회귀·privacy 검사와 로컬 UI를 검증한다.
- Gemini 실제 회사 원인을 확정하지 않은 상태임을 README/KNOWN_ISSUES에서 명확하게 한다.
- 회사 다음 Agent가 README에서 정책, 히스토리, 코드 위치, 재현 명령, 다음 작업과 수용 기준을 찾을 수 있어야 한다.
- 공개 제품 변경만 Push하고 해당 commit의 macOS/Ubuntu CI 결과를 확인한다.
