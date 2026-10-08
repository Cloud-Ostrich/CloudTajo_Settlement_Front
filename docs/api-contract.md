# Frontend API contract

현재 네트워크 호출 대신 `src/api/client.js`의 axios `mockAdapter`를 사용합니다.
Base URL은 `/api`이며 요청 인터셉터가 로그인 응답의 `accessToken`을 `Authorization: Bearer ...`로 전달합니다.
현재는 Mock adapter를 유지하며 실제 Backend 요청을 보내지 않습니다. 아래 연동 체크리스트는 추후 작업 안내입니다.

성공 응답은 모두 `{ success, message, data }`, 실패 응답은 `{ success: false, message, errorCode }`입니다.
실패는 `Error.message`, `Error.errorCode`, `Error.response.data`로 확인할 수 있습니다.
컴포넌트는 `useApiData`로 조회하며 변경 API 성공 후 재조회합니다. 신규 제출과 OCR 재시도는 `OCR_PENDING`을 반환하며 Mock OCR을 자동 실행하지 않습니다.
로그인 상태는 `{ accessToken, user: { id, name, email, role } }`로 저장합니다.

## 실패 처리

`src/api/client.js`는 공통 실패 envelope를 받아 `errorCode`와 endpoint/method에 맞는 사용자용 한글 메시지로 `Error.message`를 정규화합니다. 페이지는 이 메시지만 표시하고 복잡한 서버 메시지는 화면에 노출하지 않습니다.
실패 로그는 Console에 endpoint, method, HTTP status, `errorCode`, 정제된 server message를 기록합니다. 요청 body와 header 전체는 로그에 남기지 않으며, message에 반사된 password/accessToken/Authorization 값도 마스킹합니다.
Mock 실패 테스트는 요청 header `X-Mock-Failure`로 `FILE_UPLOAD_FAILED`, `OCR_FAILED`, `UNEXPECTED_API_ERROR`를 지정할 수 있습니다. 이 header는 Mock adapter에서만 사용하며 정상 요청 흐름에는 영향을 주지 않습니다.

| 메서드 | 경로 | 요청 | `data` 응답 |
| --- | --- | --- | --- |
| POST | /api/auth/login | `{ email, password }` | `{ accessToken, user: { id, name, email, role } }` |
| GET | /api/users/me | 없음 | `{ id, name, email, role }` |
| GET | /api/categories | 없음 | `[{ id, name, description, active }]` |
| POST | /api/receipts | multipart: `image`, `purpose`, `categoryId`, `memo` | `{ receiptId, status }` |
| GET | /api/receipts/my | `status`, `page`, `size` | `{ items: [{ receiptId, purpose, categoryId, categoryName, status, merchantName, paidAt, amount, memo }], totalCount }` |
| GET | /api/receipts/{receiptId} | 없음 | `{ receiptId, submitterId, submitter, categoryId, categoryName, purpose, status, merchantName, paidAt, amount, memo, file, ocrResult, imageUrl }` |
| POST | /api/receipts/{receiptId}/ocr/retry | 없음 | `{ receiptId, status: "OCR_PENDING" }` |
| GET | /api/receipts/{receiptId}/histories | 없음 | `[{ id, receiptId, actorId, action, fromStatus, toStatus, reason, snapshot, createdAt }]` |
| GET | /api/admin/receipts | `status`, `categoryId`, `from`, `to` | `{ items: [{ receiptId, submitterId, submitterName, categoryId, categoryName, purpose, status, merchantName, paidAt, amount, memo }], totalCount }` |
| PATCH | /api/admin/receipts/{receiptId}/ocr | `{ merchantName, paidAt, amount, reason }` | `{ receiptId, merchantName, paidAt, amount, status }` |
| POST | /api/admin/receipts/{receiptId}/approve | `{ comment }` | `{ receiptId, status: "APPROVED" }` |
| POST | /api/admin/receipts/{receiptId}/reject | `{ rejectReason }` | `{ receiptId, status: "REJECTED" }` |
| POST | /api/admin/receipts/{receiptId}/settle | `{ settledAt, comment }` | `{ receiptId, status: "SETTLED", settlement: { id, settledBy, settledAt, comment } }` |
| GET | /api/admin/receipts/{receiptId}/duplicates | 없음 | `[{ id, receiptId, candidateReceiptId, matchReason, score }]` |
| GET | /api/admin/dashboard/summary | `month` | `{ month, totalAmount, approvedAmount, pendingCount, rejectedCount, settledCount, categoryStats: [{ categoryId, categoryName, amount, count }] }` |

상태는 SUBMITTED, OCR_PENDING, OCR_DONE, REVIEWING, APPROVED, REJECTED, SETTLED만 사용합니다.
제출 시 OCR_PENDING을 반환하며 해당 상태와 null OCR 결과를 계속 유지합니다. 이후 관리자 처리 테스트는 기본 OCR_DONE/REVIEWING 샘플을 사용합니다.
USER는 본인 목록과 상세만 조회합니다. ADMIN만 OCR 수정, 승인, 반려, 정산 완료를 수행합니다.
Mock에서는 OCR_DONE/REVIEWING 건을 수정·승인·반려할 수 있고, APPROVED 건만 정산 완료할 수 있습니다.
수정 사유와 반려 사유는 필수이며 기존 승인/반려/정산 완료 건은 OCR 수정할 수 없습니다.

상세 계약은 `{ receiptId, submitterId, submitter: { id, name }, categoryId, categoryName, purpose, status, merchantName, paidAt, amount, memo, file, ocrResult, imageUrl }`입니다.
`file`은 `{ id, objectKey, originalFilename, contentType, fileSize }`, `ocrResult`는 `{ id, provider, merchantNameRaw, paidAtRaw, amountRaw, confidence, rawPayload }`이며 OCR 전에는 `null`입니다.
USER 목록은 `{ items, totalCount }`이며 item은 명세의 `categoryId`, `memo`를 포함합니다. ADMIN 목록도 `{ items, totalCount }`이고 요청자 필드는 `submitterId`, `submitterName`입니다. `page`는 1부터 시작하며 `totalCount`는 필터 적용 후 전체 건수입니다.
HIS 응답은 별도 배열이며 item은 `{ id, receiptId, actorId, action, fromStatus, toStatus, reason, snapshot, createdAt }`입니다. UI는 `createdAt`으로 시간을 표시하며 action의 snapshot에서 승인 의견·정산 메모를 읽습니다.
영수증 이미지는 상세의 `imageUrl`로 제공합니다. 기본 Mock 이미지는 SVG data URL, 업로드 이미지는 IndexedDB 파일에서 만든 data URL이며 저장된 HTTP(S) URL은 그대로 반환합니다.
DSH 응답은 `{ month, totalAmount, approvedAmount, pendingCount, rejectedCount, settledCount, categoryStats }`이며 category item은 `{ categoryId, categoryName, amount, count }`입니다. 최신 summary 계약에는 `avgReviewMinutes`가 없으므로 UI는 admin 목록과 HIS 응답에서 평균 검토 시간을 계산합니다. 승인 금액은 summary의 `approvedAmount`를 사용합니다.
`totalAmount`는 선택 월 제출 금액 합계, `pendingCount`는 SUBMITTED/OCR_PENDING/OCR_DONE/REVIEWING 건수입니다. 상태는 명세에 있는 7개 값만 사용합니다.

Mock 이미지 참조, OCR confidence 원본, 제출 시각, 거절 사유, 정산 정보, HIS 이력은 저장소 내부에 유지하며 명세에 없는 필드는 API 응답에 노출하지 않습니다.
기존 v1/v2 localStorage 레코드는 내부 저장 모델로 정규화합니다. 기존 `storeName`, `paymentDate`, `requesterId`, 소문자 status, `history[].at/label/comment`, image key와 rejection reason을 호환 변환해 소유권·이미지·시간·사유를 보존합니다.


## 실제 Backend 연결 시 수정 위치

| 파일 / 위치 | 추후 작업 |
| --- | --- |
| `src/api/client.js`의 axios.create | mockAdapter import와 adapter 설정을 제거하고 합의된 baseURL을 적용합니다. 현재 설정은 그대로 유지합니다. |
| `src/api/endpoints.js`의 API 함수 | 명세의 경로·메서드·query·요청 필드에 맞춘 호출 함수입니다. 실제 연결 시 client의 adapter를 교체하고 서버 인증 계약을 확인합니다. |
| `src/api/mockStore.js`의 세션/조회 갱신, `src/hooks/useMockData.js`, `src/components/Header.jsx` | 현재 Mock 저장소에 함께 있는 세션과 invalidateQueries를 실제 연결 시 공용 상태 모듈로 분리하고 client/endpoints/hooks/Header의 import를 교체합니다. 로그인/로그아웃·계정 전환·변경 후 재조회 동작을 유지합니다. |
| `src/api/mockRequests.js`, `src/api/mockBackend.js`, `src/api/mockImages.js` | Mock fixture·저장 호환·이미지 생성 전용입니다. 실제 응답에는 Mock 저장용 image 참조를 요구하지 않습니다. |
| `src/pages/Dashboard.jsx`, `src/pages/AdminApproval.jsx`, `src/pages/AdminDashboard.jsx` | 최신 list/detail/HIS/summary 필드에서 기존 화면 표시값을 읽거나 파생합니다. UI 디자인 변경은 필요하지 않습니다. |
| `src/components/ReceiptImage.jsx`, `src/components/UserReceiptImage.jsx` | imageUrl 계약이 유지되면 이미지 UI 변경이 필요하지 않습니다. 실제 URL의 접근 권한·만료·브라우저에서의 표시 가능 여부를 확인합니다. 일반 HTTP(S) URL에는 Mock SVG 표시 변환이 적용되지 않습니다. |
| `vite.config.js` / 배포 설정 | 필요할 경우 /api 개발 프록시 및 배포 라우팅을 설정합니다. 현재 프록시는 추가하지 않습니다. |
| `tests/mockStore.test.js`, `tests/e2e/flows.spec.js` | Mock 회귀 테스트를 유지하고 실제 계약/인증/이미지 접근/OCR 완료 후 재조회에 대한 연동 테스트를 추가합니다. |

처리 이력 예시(HIS endpoint의 data item):

```json
{
  "id": "101-2",
  "receiptId": 101,
  "actorId": 3,
  "action": "APPROVED",
  "fromStatus": "REVIEWING",
  "toStatus": "APPROVED",
  "reason": "",
  "snapshot": { "comment": "증빙 확인" },
  "createdAt": "2026-10-05T11:00:00+09:00"
}
```

기존 localStorage의 `history[].at`은 읽을 때 `createdAt`으로 변환합니다. `label`은 action enum으로 정규화하고 기존 comment는 snapshot에 보존합니다. 신규 제출·OCR 수정·승인·반려·정산 이력은 명세의 HIS 필드로 저장합니다. 기존 이미지 참조와 업로드 파일은 그대로 보존합니다.
