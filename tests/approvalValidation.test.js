import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingApprovalFields } from '../src/api/approvalValidation.js';
const valid = { merchantName: '상호', paidAt: '2026-10-11', amount: 0 };
for (const [field, label] of [['merchantName', '상호명'], ['paidAt', '결제일'], ['amount', '금액']]) {
  test(`${label} 확정값 누락은 OCR 원본으로 대체하지 않는다`, () => {
    for (const value of [null, undefined, '', '  ']) assert.deepEqual(missingApprovalFields({ ...valid, [field]: value, ocrResult: { merchantNameRaw: '원본', paidAtRaw: '2026-10-11', amountRaw: 100 } }), [label]);
  });
}
test('여러 누락 항목과 정상적인 0을 구분한다', () => {
  assert.deepEqual(missingApprovalFields(null), ['상호명', '결제일', '금액']);
  assert.deepEqual(missingApprovalFields(valid), []);
});
