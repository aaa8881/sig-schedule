# 웹 담당

디자인·화면·기능·스키마·배포 변경에만 사용한다. 활동 기록을 추가할 때는 이 문서를 읽거나 웹 담당을 호출할 필요가 없다.

- 화면: index.html, styles.css, app.js. 현재는 정적 웹사이트이며 hash로 오늘/프로젝트/기록/생각/프로젝트 상세를 전환한다.
- 데이터 계약: data/journal.json, schemaVersion 1. 실제 할 일 상태와 날짜별 기록이 원본이다. 새 기능이 스키마를 바꿀 때만 workflows/tracking.md 및 검증기를 함께 갱신한다. 화면 제작을 위해 가짜 완료·운동·생각을 추가하지 않는다.
- 검증: 변경한 JS는 node --check app.js. 배포 파일은 node scripts/build.cjs. UI 변경 시 변경한 화면의 데스크톱·모바일·주요 동작을 확인한다.
- 미리보기: node scripts/serve.cjs, http://127.0.0.1:4173.
- 배포: GitHub aaa8881/sig-schedule, main push → .github/workflows/pages.yml → Pages. 공개 URL https://aaa8881.github.io/sig-schedule/ . 배포 성공과 실제 수정 반영을 확인한다.
- 기존 공개 기록은 보존한다. 기록만 바뀐 작업의 전체 화면 테스트는 반복하지 않는다.
- 요청 범위의 파일만 commit/push한다. 동시 담당 변경이 있으면 git diff/status로 확인하고 충돌을 조정한다. 사용자 변경을 되돌리거나 stash/reset하지 않는다.

기록 담당은 데이터만 변경하고 자동 배포가 화면을 갱신한다. 웹 담당의 대화 이력을 기록 담당에게 복사할 필요가 없다.
