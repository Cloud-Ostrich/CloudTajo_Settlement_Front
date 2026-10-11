import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyTimeLabel, progressSteps, searchSortReceipts } from '../src/api/receiptUX.js';
test('처리 단계는 미확인 상태를 완료 처리하지 않고 반려는 이력 증거 사용', () => {
 assert.ok(progressSteps(null).every((step) => !step.complete && !step.current));
 assert.ok(progressSteps('SETTLED').every((step) => step.complete));
 const rejected = progressSteps('REJECTED', [{ action: 'SUBMIT' }]);
 assert.equal(rejected[0].complete, true); assert.equal(rejected[1].complete, false);
 assert.equal(rejected[2].rejected, true); assert.equal(rejected[3].complete, false);
 assert.equal(progressSteps('OCR_DONE')[2].current, true);
});
test('목록 검색과 정렬은 입력을 변경하지 않고 누락값을 뒤로 배치', () => {
 const items = [{ id: 1, submitterId: 7, merchantName: '카페', amount: 100, submittedAt: '2026-10-01' }, { id: 2, amount: null, purpose: '회의' }, { id: 3, amount: 300, submittedAt: '2026-10-03' }];
 assert.deepEqual(searchSortReceipts(items, '', 'amount-desc').map((r) => r.id), [3, 1, 2]);
 assert.deepEqual(searchSortReceipts(items, '', 'date-asc').map((r) => r.id), [1, 3, 2]);
 assert.deepEqual(searchSortReceipts(items, '#1', 'date-desc').map((r) => r.id), [1]);
 assert.equal(searchSortReceipts(items, '사용자 #7', 'date-desc').length, 1);
 assert.equal(searchSortReceipts(items, '카페', 'date-desc').length, 1);
 assert.deepEqual(items.map((r) => r.id), [1, 2, 3]);
});

test('이력 시각이 없거나 잘못된 값이면 시각을 만들지 않는다', () => {
 assert.equal(historyTimeLabel(null), '시각 정보 없음');
 assert.equal(historyTimeLabel('invalid'), '시각 정보 없음');
 assert.ok(historyTimeLabel('2026-10-01T00:00:00Z').includes('9:00'));
});
