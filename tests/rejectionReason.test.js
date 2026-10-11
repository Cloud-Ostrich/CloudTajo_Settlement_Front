import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rejectionReasonFor } from '../src/api/rejectionReason.js';
test('Real REJECT 및 Mock REJECTED 이력 사유를 최신 시각 순으로 선택', () => {
  const older = { action: 'REJECTED', reason: '과거 사유', createdAt: '2026-10-01T10:00:00Z' };
  const latest = { action: 'REJECT', reason: '최신 사유', createdAt: '2026-10-10T10:00:00Z' };
  assert.equal(rejectionReasonFor({}, [latest, older]), '최신 사유');
  assert.equal(rejectionReasonFor({}, [older, latest]), '최신 사유');
  assert.equal(rejectionReasonFor({}, [{ action: 'APPROVE', reason: '승인 의견' }, older]), '과거 사유');
});
test('이력과 상세의 유효한 사유만 표시하고 타임라인 comment 대체값도 지원', () => {
  assert.equal(rejectionReasonFor({ rejectReason: '상세 사유' }, []), '상세 사유');
  assert.equal(rejectionReasonFor({}, [{ action: 'REJECT', reason: ' ', snapshot: { comment: '이력 사유' } }]), '이력 사유');
  assert.equal(rejectionReasonFor({}, [{ action: 'REJECT', reason: null }]), null);
  assert.equal(rejectionReasonFor(null), null);
});
