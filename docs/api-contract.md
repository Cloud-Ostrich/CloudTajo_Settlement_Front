# Frontend API contract

현재 네트워크 호출 대신 `src/api/client.js`의 axios `mockAdapter`를 사용합니다.
Base URL은 `/api`이며 요청 인터셉터가 로그인 응답의 `accessToken`을 `Authorization: Bearer ...`로 전달합니다.
실제 연결 시 `adapter: mockAdapter`와 해당 import를 제거합니다. 컴포넌트는 변경할 필요가 없습니다.

`endpoints.js` 함수들은 `{ success, message, data }` 응답을 그대로 반환합니다.
실패 응답은 `Error.message`, `Error.errorCode`, `Error.response.data`로 확인할 수 있습니다.
컴포넌트는 `useApiData`로 조회하며 변경 API 성공 후 재조회합니다. 현재 Mock에서 신규 제출 상태는 OCR_PENDING으로 유지합니다. 자동 OCR 처리 및 반복 조회는 수행하지 않습니다.
로그인 상태는 `{ accessToken, user: { id, name, email, role } }`로 저장합니다.

| 메서드 | 경로 | 요청 |
| --- | --- | --- |
| POST | /auth/login | email, password |
| GET | /categories | 없음 |
| POST | /receipts | FormData: image, purpose, categoryId, memo(선택) |
| GET | /receipts/my | 없음 |
| GET | /receipts/{receiptId} | 없음 |
| GET | /admin/receipts | 없음 |
| PATCH | /admin/receipts/{receiptId}/ocr | merchantName, paidAt, amount, reason |
| POST | /admin/receipts/{receiptId}/approve | comment |
| POST | /admin/receipts/{receiptId}/reject | rejectReason |
| POST | /admin/receipts/{receiptId}/settle | settledAt, comment |
| GET | /admin/dashboard/summary | month(선택, YYYY-MM) |

상태는 SUBMITTED, OCR_PENDING, OCR_DONE, REVIEWING, APPROVED, REJECTED, SETTLED만 사용합니다.
제출 시 OCR_PENDING을 반환하며 해당 상태와 null OCR 결과를 계속 유지합니다. 이후 관리자 처리 테스트는 기본 OCR_DONE/REVIEWING 샘플을 사용합니다.
USER는 본인 목록과 상세만 조회합니다. ADMIN만 OCR 수정, 승인, 반려, 정산 완료를 수행합니다.
Mock에서는 OCR_DONE/REVIEWING 건을 수정·승인·반려할 수 있고, APPROVED 건만 정산 완료할 수 있습니다.
수정 사유와 반려 사유는 필수이며 기존 승인/반려/정산 완료 건은 OCR 수정할 수 없습니다.

명세에서 전체 구조를 지정하지 않은 상세/집계 하위 필드는 다음 형태로 구성했습니다.
실제 Backend 응답이 확정되면 이 부분의 응답 계약을 함께 맞춰야 합니다.

- USER 목록 data는 배열이며 각 item은 receiptId, purpose, categoryName, amount, merchantName, paidAt, status입니다.
- ADMIN 목록에는 요청자 표시를 위해 user: { id, name, email, role }가 추가됩니다.
- 상세는 목록 필드 외에 user, categoryId, memo, imageUrl, confidence, createdAt, rejectReason, history, settledAt을 포함합니다.
- confidence는 0~1 숫자로 가정하며 화면에서는 백분율로 표시합니다. OCR 처리 전 값은 null입니다.
- history item은 label, at, 선택 reason/comment를 포함합니다.
- categoryStats item은 categoryId, categoryName, count, totalAmount입니다.
- totalAmount는 선택 월 전체 제출 금액, approvedAmount는 APPROVED 및 SETTLED 합계입니다.
- pendingCount는 SUBMITTED/OCR_PENDING/OCR_DONE/REVIEWING의 건수입니다.
- avgReviewMinutes는 생성부터 최초 승인/반려 이력까지의 평균 분입니다. 유효 이력이 없으면 0입니다.

Mock 이미지 참조와 OCR 타이머 정보는 저장소 내부에만 존재하고 API 응답에는 노출하지 않습니다.
기존 v1 요청은 v2 숫자 receiptId와 새 enum으로 읽으며 사용자 소유권, 이미지 저장 키, 반려 사유를 보존합니다.
