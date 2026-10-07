
# 구름타조 정산소

내부 프로젝트명: `CloudTajo_Settlement`

영수증 OCR 기반 회비·지출 정산 관리 서비스입니다.

사용자는 영수증을 제출하고 정산 처리 상태를 확인할 수 있으며,
관리자는 OCR 결과를 검토하여 승인·반려 및 정산 완료 처리를 할 수 있습니다.

## 주요 기능

### USER

- 로그인
- 영수증 이미지 제출
- 사용 목적 / 카테고리 / 메모 입력
- 개인별 제출 내역 조회
- 영수증 상세 조회
- 승인 / 반려 / 정산 완료 상태 확인
- 반려 사유 및 처리 이력 확인

### ADMIN

- 운영 대시보드
- 전체 영수증 제출 내역 조회
- OCR 결과 확인 및 수정
- 영수증 승인 / 반려
- 정산 완료 처리
- 처리 이력 확인

## Tech Stack

- React
- Vite
- JavaScript
- React Router
- Axios
- Playwright

## 실행 방법

### 1. Repository Clone

git clone https://github.com/Cloud-Ostrich/CloudTajo_Settlement_Front.git

### 2. 패키지 설치

npm install

### 3. 개발 서버 실행

npm run dev

## 테스트

Mock API 및 브라우저 E2E 테스트가 구성되어 있습니다.

npm test
npm run test:e2e

전체 테스트:

npm run test:all

## API

Base URL

/api

인증 방식

Authorization: Bearer {accessToken}

주요 API 명세는 다음 문서를 참고합니다.

docs/api-contract.md

## 현재 개발 상태

현재 Frontend는 Mock API 기반으로 구현되어 있습니다.

- USER / ADMIN 인증 및 권한 분리
- 사용자별 제출 데이터 분리
- 영수증 등록
- OCR 처리 상태
- 관리자 승인 / 반려 / 정산
- 자동 테스트

실제 Backend API 및 CLOVA OCR 연동 예정입니다.

## 영수증 처리 Flow

USER 영수증 제출
→ OCR 처리
→ 관리자 검토
→ 승인 / 반려
→ 정산 완료

## 프로젝트 구조

src/
├── api/          # API 및 Mock API
├── components/   # 공통 UI 컴포넌트
├── hooks/        # Custom Hooks
├── pages/        # 페이지
└── assets/       # 이미지 및 정적 리소스

tests/
├── e2e/          # Playwright E2E 테스트
└── mockStore.test.js

docs/
├── api-contract.md
└── testing.md
