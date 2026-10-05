# 자동 테스트

실제 Backend 서버 없이 현재 axios Mock adapter/store를 검증합니다.
애플리케이션 구현과 디자인을 테스트용으로 변경하지 않습니다.

## 실행

```sh
npm ci
npx playwright install chromium
npm test
npm run test:e2e
npm run build
npm run lint
```

- `npm test`: Node Mock API 통합 테스트 7개. 브라우저 저장소/FileReader 어댑터만 메모리로 대체하며 실제 endpoints/client/Mock API를 사용합니다.
- `npm run test:e2e`: Chromium 실제 브라우저 E2E 7개. 별도 Vite 서버를 127.0.0.1:5181에서 자동 실행하고 종료합니다. Backend 서버는 필요 없습니다.
- `npm run test:all`: API 및 E2E 테스트 순서대로 실행합니다.
- `npm run test:e2e:ui`: Playwright UI 모드에서 테스트를 실행하고 관찰합니다.
- `npx playwright show-report`: 마지막 브라우저 테스트 HTML 결과를 확인합니다.

5181 포트가 다른 프로세스에 사용 중이면 서버 시작 단계에서 실패합니다. 다른 서버를 임의로 재사용하지 않습니다.
최초 Chromium 설치에는 네트워크가 필요합니다. sandbox 환경에서는 로컬 서버/브라우저 실행 허용이 필요할 수 있습니다.
테스트 실패 시 `test-results/`에 스크린샷과 trace, `playwright-report/`에 보고서가 생성됩니다.
해당 출력 폴더는 버전 관리에서 제외합니다.

## 범위와 격리

API 테스트는 각 실행 전 독립 초기 요청/세션/이미지 데이터를 설정합니다.
E2E는 테스트마다 독립 BrowserContext를 사용하고, 한 시나리오 내에서만 로그아웃/로그인으로 실제 데이터 공유를 검증합니다.
개발자가 사용하는 브라우저의 기존 요청과 세션을 변경하지 않습니다.
응답을 가로채어 성공을 꾸미지 않고 실제 Mock API와 localStorage/IndexedDB를 사용합니다.

| 범위 | 검증 |
| --- | --- |
| 인증 | 김민서/이준호/관리자 로그인, 실패 로그인, 토큰과 응답 구조 |
| 분리/권한 | 본인 요청 조회, 타인 상세 차단, USER의 모든 ADMIN API 차단, 관리자 전체 조회 |
| 제출 | 이미지/목적/카테고리 필수, 메모 생략 가능, FormData 계약, 원본 이미지 보존 |
| OCR 처리 중 | 신규 OCR_PENDING 유지, 재조회/재접속 후 유지, null OCR 결과, 상세 안내와 USER 편집 불가 |
| 상세 | 본인 상세, 원본 이미지, 요청자/목적/카테고리/메모, 완료 OCR 결과/confidence |
| 관리자 | OCR 저장/사유/이력, APPROVED, REJECTED/필수 사유, 승인 건 SETTLED |
| 상태 | 7개 Backend enum, 4개 요약 그룹 및 개별 필터 |
| 데이터 유지 | 로그아웃/재로그인/재로드, 이전 저장 모델의 소유권/이미지 키/상태 호환 |

## 시나리오에서 신규 제출과 승인 샘플을 나누는 이유

현재 요구사항에 따라 신규 제출은 OCR_PENDING으로 계속 남으며 자동 OCR 처리를 하지 않습니다.
따라서 신규 요청을 그대로 승인하는 시나리오는 현재 서비스 계약에 맞지 않습니다.
E2E는 신규 요청의 관리자 상세 조회와 승인 버튼 없음까지 검증하고,
관리자 OCR 수정/승인/정산은 기본 OCR_DONE 김민서 샘플,
반려와 사용자 사유 확인은 별도의 REVIEWING 이준호 샘플을 사용합니다.
테스트를 위해 신규 요청을 OCR_DONE으로 강제 변경하지 않습니다.

## 자동화하지 않은 확인

실제 Backend/CLOVA OCR/토큰 만료/운영 서버 연동, Safari/Firefox 및 실제 휴대폰의 시각적 레이아웃 검증은 별도 확인이 필요합니다.
현재 E2E는 데스크톱 Chromium 기능 검증이며 화면 디자인의 픽셀 일치 테스트는 아닙니다.

추가 UI 검증: USER 대시보드/등록/상세, ADMIN 목록 필터/검토 상세, 로그인 및 주요 페이지의 320px 모바일 가로 넘침, 정산 완료 건의 작업 버튼 비노출을 확인합니다.
