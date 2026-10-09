import assert from 'node:assert/strict';
import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, test } from 'node:test';
class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const local = new MemoryStorage(), session = new MemoryStorage(), images = new Map();
globalThis.File = NodeFile;
globalThis.localStorage = local;
globalThis.sessionStorage = session;
globalThis.FileReader = class {
  readAsDataURL(file) { file.arrayBuffer().then((bytes) => { this.result = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload(); }).catch(() => this.onerror()); }
};
globalThis.indexedDB = { open() {
  const request = {};
  queueMicrotask(() => {
    request.result = { close() {}, transaction() {
      const transaction = { objectStore() { return {
        put(file, key) { images.set(key, file); queueMicrotask(() => transaction.oncomplete()); },
        get(key) { const result = {}; queueMicrotask(() => { result.result = images.get(key); result.onsuccess(); }); return result; },
      }; } };
      return transaction;
    } };
    request.onsuccess();
  }); return request;
} };
const api = await import('../src/api/endpoints.js');
const store = await import('../src/api/mockStore.js');
const sessionStore = await import('../src/api/session.js');
const { apiClient, apiRequest } = await import('../src/api/client.js');
const originalConsoleError = console.error;
let apiErrorLogs;
const { categoryNameFor, historyActionLabel, receiptIdOf, shiftMonth, STATUS_LABELS } = await import('../src/api/contracts.js');
const { DEFAULT_REQUESTS, normalizeRequest } = await import('../src/api/mockRequests.js');
beforeEach(() => {
  apiErrorLogs = [];
  console.error = (...args) => apiErrorLogs.push(args);
  sessionStore.logout();
  store.writeReceipts(structuredClone(DEFAULT_REQUESTS));
  images.clear();
});
afterEach(() => { console.error = originalConsoleError; });
function envelope(response) { assert.equal(response.success, true); assert.equal(typeof response.message, 'string'); assert.ok('data' in response); }
const input = (purpose) => ({ image: new File([purpose], 'receipt.png', { type: 'image/png' }), purpose, categoryId: 1, memo: '테스트 메모' });
const code = (value) => (error) => { assert.equal(error.errorCode, value); assert.equal(error.response.data.success, false); assert.equal(error.response.data.errorCode, value); return true; };
function listShape(item) {
  assert.deepEqual(Object.keys(item).sort(), ['receiptId', 'purpose', 'categoryId', 'categoryName', 'status', 'merchantName', 'paidAt', 'amount', 'memo'].sort());
  assert.equal(typeof item.receiptId, 'number'); assert.ok(STATUS_LABELS[item.status]);
}

test('세션 저장/조회/로그아웃은 기존 키와 구독 동작 유지', () => {
  let notifications = 0;
  const unsubscribe = sessionStore.subscribe(() => { notifications++; });
  const value = { accessToken: 'test-token', user: { id: 1, name: '김민서', role: 'USER' } };
  sessionStore.setSession(value);
  assert.equal(session.getItem('duesflow.session.v2'), JSON.stringify(value));
  assert.deepEqual(sessionStore.getSession(), value);
  assert.equal(notifications, 1);
  sessionStore.logout();
  assert.equal(session.getItem('duesflow.session.v2'), null);
  assert.equal(sessionStore.getSession(), null);
  assert.equal(notifications, 2);
  unsubscribe();
});

test('영수증 ID는 Real id와 Mock receiptId 형식을 모두 지원', () => {
  assert.equal(receiptIdOf({ id: 123 }), 123);
  assert.equal(receiptIdOf({ receiptId: 456 }), 456);
  assert.equal(receiptIdOf({ id: 123, receiptId: 456 }), 456);
});

test('상세 카테고리명은 응답값을 우선하고 목록에서 없으면 ID로 찾음', () => {
  const categories = [{ id: 1, name: '식비' }, { id: 2, name: '교통비' }];
  assert.equal(categoryNameFor({ categoryName: 'Mock 이름', categoryId: 1 }, categories), 'Mock 이름');
  assert.equal(categoryNameFor({ categoryId: 2 }, categories), '교통비');
  assert.equal(categoryNameFor({ categoryId: 9 }, categories), '카테고리 정보 없음');
  assert.equal(categoryNameFor({ categoryId: 2 }, null), '카테고리 정보 없음');
});

test('처리 이력 코드를 기존·Real alias 한글명으로 표시하고 알 수 없는 코드는 유지', () => {
  assert.equal(historyActionLabel('SUBMIT'), '영수증 제출');
  assert.equal(historyActionLabel('SUBMITTED'), '영수증 제출');
  assert.equal(historyActionLabel('OCR_PENDING'), '영수증 인식 대기');
  assert.equal(historyActionLabel('OCR_DONE'), '영수증 인식 완료');
  assert.equal(historyActionLabel('REVIEW'), '관리자 검토');
  assert.equal(historyActionLabel('EDIT_OCR'), '영수증 인식 정보 수정');
  assert.equal(historyActionLabel('APPROVE'), '승인 완료');
  assert.equal(historyActionLabel('REJECT'), '반려');
  assert.equal(historyActionLabel('SETTLE'), '정산 완료');
  assert.equal(historyActionLabel('OCR_RETRY_REQUESTED'), 'OCR 재처리 요청');
  assert.equal(historyActionLabel('FUTURE_ACTION'), 'FUTURE_ACTION');
});

test('월 이동은 연도 경계를 포함해 YYYY-MM을 유지', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
  assert.equal(shiftMonth('2026-10', -1), '2026-09');
});

test('저장된 세션 복원은 현재 사용자로 갱신하고 동시 요청을 공유', async () => {
  const login = await api.login('user1@test.com', '1234');
  sessionStore.setSession({ ...login.data, user: { ...login.data.user, name: '오래된 사용자명' } });
  const first = api.restoreSession();
  const second = api.restoreSession();
  assert.equal(first, second);
  const user = await first;
  assert.equal(user.name, '김민서');
  assert.equal(sessionStore.getSession().accessToken, login.data.accessToken);
  assert.equal(sessionStore.getSession().user.name, '김민서');
});

test('저장된 세션 복원에서 401이면 세션을 삭제', async () => {
  const originalAdapter = apiClient.defaults.adapter;
  sessionStore.setSession({ accessToken: 'expired-token', user: { id: 1, name: '김민서', role: 'USER' } });
  apiClient.defaults.adapter = async (config) => ({
    data: { success: false, message: '로그인이 필요합니다.', errorCode: 'UNAUTHORIZED' },
    status: 401, statusText: 'Unauthorized', headers: {}, config,
  });
  try {
    await assert.rejects(api.restoreSession(), (error) => error.response?.status === 401);
    assert.equal(sessionStore.getSession(), null);
    assert.equal(session.getItem('duesflow.session.v2'), null);
  } finally {
    apiClient.defaults.adapter = originalAdapter;
  }
});

test('API 계약: 신규 제출 OCR_PENDING 유지, 샘플 ADMIN 처리 및 USER 조회', async () => {
  await assert.rejects(api.getMyReceipts(), code('AUTH_REQUIRED'));
  await assert.rejects(api.login('user1@test.com', 'wrong'), code('AUTH_REQUIRED'));
  const login = await api.login('user1@test.com', '1234'); envelope(login);
  assert.deepEqual(login.data.user, { id: 1, name: '김민서', email: 'user1@test.com', role: 'USER' });
  assert.equal(typeof login.data.accessToken, 'string'); assert.ok(!('password' in login.data.user));
  const currentUser = await api.getCurrentUser(); envelope(currentUser);
  assert.deepEqual(currentUser.data, { id: 1, name: '김민서', email: 'user1@test.com', role: 'USER' });
  const categories = await api.getCategories(); envelope(categories);
  assert.deepEqual(categories.data.map((c) => c.name), ['식비', '교통비', '인쇄비', '소모품비', '기타']);
  assert.ok(categories.data.every((category) => 'description' in category && 'active' in category));
  let captured;
  const interceptor = apiClient.interceptors.request.use((config) => { if (config.url === '/receipts') captured = config; return config; });
  const first = await api.submitReceipt(input('김민서 회의 음료')); envelope(first);
  apiClient.interceptors.request.eject(interceptor);
  assert.deepEqual(Object.keys(first.data).sort(), ['receiptId', 'status']);
  assert.equal(first.data.status, 'OCR_PENDING');
  assert.equal(first.message, '영수증이 제출되었고 OCR 처리가 요청되었습니다.');
  assert.equal(captured.baseURL, '/api'); assert.equal(captured.method, 'post');
  assert.ok(captured.data instanceof FormData);
  assert.deepEqual([...captured.data.keys()], ['image', 'purpose', 'categoryId', 'memo']);
  assert.equal(captured.headers.get('Authorization'), `Bearer ${login.data.accessToken}`);
  const initial = await api.getMyReceipts(); initial.data.items.forEach(listShape);
  assert.equal(initial.data.totalCount, initial.data.items.length);
  assert.equal(initial.data.items.find((r) => r.receiptId === first.data.receiptId).status, 'OCR_PENDING');
  const filtered = await api.getMyReceipts({ status: 'OCR_PENDING', page: 1, size: 1 });
  assert.equal(filtered.data.items.length, 1); assert.equal(filtered.data.items[0].status, 'OCR_PENDING');
  const initialDetail = (await api.getReceipt(first.data.receiptId)).data;
  assert.equal(initialDetail.merchantName, null); assert.equal(initialDetail.amount, null);
  assert.equal(initialDetail.ocrResult, null);
  assert.deepEqual(initialDetail.submitter, { id: 1, name: '김민서' });
  assert.deepEqual(Object.keys(initialDetail.file).sort(), ['id', 'objectKey', 'originalFilename', 'contentType', 'fileSize'].sort());
  const initialHistory = await api.getReceiptHistories(first.data.receiptId); envelope(initialHistory);
  assert.deepEqual(Object.keys(initialHistory.data[0]).sort(), ['id', 'receiptId', 'actorId', 'action', 'fromStatus', 'toStatus', 'reason', 'snapshot', 'createdAt'].sort());
  assert.equal(initialHistory.data[0].action, 'SUBMITTED');
  assert.ok(Number.isFinite(Date.parse(initialHistory.data[0].createdAt)));
  assert.equal(initialDetail.memo, '테스트 메모'); assert.ok(initialDetail.imageUrl.startsWith('data:image/png'));
  sessionStore.logout(); await api.login('user2@test.com', '1234');
  assert.ok((await api.getMyReceipts()).data.items.every((r) => r.receiptId !== first.data.receiptId));
  await assert.rejects(api.getReceipt(first.data.receiptId), code('FORBIDDEN_ROLE'));
  await assert.rejects(api.updateOcr(first.data.receiptId, {}), code('FORBIDDEN_ROLE'));
  const second = await api.submitReceipt(input('이준호 행사 준비'));
  sessionStore.logout(); const admin = await api.login('admin@test.com', '1234');
  assert.equal(admin.data.user.role, 'ADMIN');
  const allResponse = await api.getAdminReceipts(); envelope(allResponse);
  const all = allResponse.data.items;
  assert.ok(all.some((r) => r.receiptId === first.data.receiptId && r.submitterId === 1 && r.submitterName === '김민서'));
  assert.ok(all.some((r) => r.receiptId === second.data.receiptId && r.submitterId === 2 && r.submitterName === '이준호'));
  await assert.rejects(api.approveReceipt(first.data.receiptId, { comment: '확인' }), code('INVALID_STATUS_TRANSITION'));
  // 시간이 지나거나 목록/상세를 반복 조회해도 신규 제출은 처리 중으로 유지합니다.
  const realNow = Date.now;
  Date.now = () => realNow() + 60000;
  try {
    for (let n = 0; n < 3; n++) {
      await api.getAdminReceipts();
      const pending = (await api.getReceipt(first.data.receiptId)).data;
      assert.equal(pending.status, 'OCR_PENDING');
      assert.equal(pending.merchantName, null); assert.equal(pending.paidAt, null);
      assert.equal(pending.amount, null); assert.equal(pending.ocrResult, null);
      assert.equal(pending.submitter.name, '김민서'); assert.equal(pending.categoryName, '식비');
      assert.ok((await api.getReceiptHistories(first.data.receiptId)).data.length > 0);
    }
  } finally { Date.now = realNow; }
  const sampleMinseo = 101, sampleJunho = 105;
  assert.equal((await api.getReceipt(sampleMinseo)).data.status, 'OCR_DONE');
  await assert.rejects(api.updateOcr(sampleMinseo, { merchantName: '수정상호', paidAt: '2026-10-05', amount: 18900, reason: '' }), code('VALIDATION_ERROR'));
  const corrected = await api.updateOcr(sampleMinseo, { merchantName: '수정상호', paidAt: '2026-10-05', amount: 18900, reason: '원본 이미지 확인 후 금액 보정' }); envelope(corrected);
  assert.equal(corrected.data.merchantName, '수정상호'); assert.equal(corrected.data.amount, 18900);
  assert.deepEqual(Object.keys(corrected.data).sort(), ['receiptId', 'merchantName', 'paidAt', 'amount', 'status'].sort());
  assert.equal(corrected.data.status, 'REVIEWING');
  const approved = await api.approveReceipt(sampleMinseo, { comment: '증빙 확인 완료' });
  assert.deepEqual(approved.data, { receiptId: sampleMinseo, status: 'APPROVED' });
  await assert.rejects(api.rejectReceipt(sampleJunho, { rejectReason: ' ' }), code('VALIDATION_ERROR'));
  await api.rejectReceipt(sampleJunho, { rejectReason: '참석자 명단 필요' });
  await assert.rejects(api.settleReceipt(sampleJunho, { settledAt: '2026-10-05', comment: '' }), code('INVALID_STATUS_TRANSITION'));
  const settled = await api.settleReceipt(sampleMinseo, { settledAt: '2026-10-05', comment: '회비 정산 완료' });
  assert.equal(settled.data.status, 'SETTLED'); assert.equal(settled.data.settlement.settledAt, '2026-10-05');
  assert.equal(settled.data.settlement.settledBy, 3); assert.equal(settled.data.settlement.comment, '회비 정산 완료');
  await assert.rejects(api.updateOcr(sampleMinseo, { merchantName: '수정', paidAt: '2026-10-05', amount: 1, reason: '보정' }), code('INVALID_STATUS_TRANSITION'));
  const summary = await api.getAdminSummary('2026-10'); envelope(summary);
  assert.deepEqual(Object.keys(summary.data).sort(), ['month', 'totalAmount', 'approvedAmount', 'pendingCount', 'rejectedCount', 'settledCount', 'categoryStats'].sort());
  assert.ok(summary.data.categoryStats.every((category) => 'amount' in category && 'count' in category && !('totalAmount' in category)));
  sessionStore.logout(); await api.login('user1@test.com', '1234');
  assert.equal((await api.getMyReceipts()).data.items.find((r) => r.receiptId === sampleMinseo).status, 'SETTLED');
  assert.equal((await api.getReceipt(sampleMinseo)).data.amount, 18900);
  sessionStore.logout(); await api.login('user2@test.com', '1234');
  assert.equal((await api.getReceiptHistories(sampleJunho)).data.at(-1).reason, '참석자 명단 필요');
  const restoredSession = await import(`../src/api/session.js?reload=${Date.now()}`);
  const restoredStore = await import(`../src/api/mockStore.js?reload=${Date.now()}`);
  assert.equal(restoredSession.getSession().user.name, '이준호');
  assert.equal(restoredStore.readReceipts().find((r) => r.receiptId === second.data.receiptId).status, 'OCR_PENDING');
});

test('기본 영수증 동일 경로 및 잘못된 요청/권한/상태 거부', async () => {
  await api.login('admin@test.com', '1234');
  const all = (await api.getAdminReceipts()).data.items;
  for (const row of all.filter((r) => r.receiptId <= 105)) {
    const detail = (await api.getReceipt(row.receiptId)).data;
    assert.ok(detail.imageUrl.startsWith('data:image/svg+xml'));
    assert.ok(detail.submitter.id); assert.ok((await api.getReceiptHistories(row.receiptId)).data.length);
  }
  await api.approveReceipt(101, { comment: '기본 요청 승인' });
  await api.settleReceipt(101, { settledAt: '2026-10-05', comment: '지급 완료' });
  await api.rejectReceipt(105, { rejectReason: '기본 요청 반려' });
  assert.equal((await api.getReceipt(101)).data.status, 'SETTLED');
  assert.equal((await api.getReceipt(105)).data.status, 'REJECTED');
  await assert.rejects(api.approveReceipt(105, {}), code('INVALID_STATUS_TRANSITION'));
  await api.login('user1@test.com', '1234');
  await assert.rejects(api.getAdminSummary(), code('FORBIDDEN_ROLE'));
  await assert.rejects(api.submitReceipt({ ...input(''), categoryId: 999 }), code('VALIDATION_ERROR'));
  await assert.rejects(apiRequest({ method: 'POST', url: '/receipts', data: { purpose: 'test' } }), code('INVALID_REQUEST'));
});

test('이전 저장 모델의 사용자/이미지 키/상태 보존', async () => {
  local.removeItem('duesflow.receipts.v2');
  local.setItem('duesflow.receipts.v1', JSON.stringify([{ requestId: 'old-upload', userId: 'member-2', storeName: '기존 카페', paymentDate: '2026-10-01', amount: 5000, purpose: '기존 목적', status: 'rejected', rejectionReason: '기존 반려 사유', image: { storage: 'indexeddb', key: 'old-upload' } }]));
  const migrated = await import(`../src/api/mockStore.js?migration=${Date.now()}`);
  const receipt = migrated.readReceipts()[0];
  assert.equal(typeof receipt.receiptId, 'number'); assert.equal(receipt.userId, 2);
  assert.equal(receipt.merchantName, '기존 카페'); assert.equal(receipt.status, 'REJECTED');
  assert.equal(receipt.rejectReason, '기존 반려 사유'); assert.equal(receipt.image.key, 'old-upload');
    assert.equal(receipt.history.at(-1).action, 'REJECTED');
    assert.equal(receipt.history.at(-1).reason, '기존 반려 사유');
});

test('상단 4개 요약 그룹과 목록 7개 enum 필터를 각각 유지', async () => {
  const { SUBMISSION_SUMMARIES, matchesSubmissionFilter } = await import('../src/api/contracts.js');
  assert.equal(SUBMISSION_SUMMARIES.length, 4);
  const receipts = Object.keys(STATUS_LABELS).map((status) => ({ status }));
  assert.deepEqual(SUBMISSION_SUMMARIES.map((s) => receipts.filter((r) => s.statuses.includes(r.status)).length), [4, 1, 1, 1]);
  assert.equal(receipts.filter((r) => matchesSubmissionFilter(r, 'processing')).length, 4);
  for (const status of Object.keys(STATUS_LABELS)) assert.equal(receipts.filter((r) => matchesSubmissionFilter(r, status)).length, 1);
  assert.equal(receipts.filter((r) => matchesSubmissionFilter(r, 'all')).length, 7);
});

test('명세 query filtering, pagination, duplicate response shape', async () => {
  await api.login('admin@test.com', '1234');
  const page = await api.getAdminReceipts({ page: 1, size: 2 }); envelope(page);
  assert.equal(page.data.items.length, 2); assert.equal(page.data.totalCount, 5);
  const filtered = await api.getAdminReceipts({ status: 'REJECTED', categoryId: 1, from: '2026-10-05', to: '2026-10-05' });
  assert.equal(filtered.data.totalCount, 1); assert.equal(filtered.data.items[0].receiptId, 103);
  const duplicate = normalizeRequest({ ...DEFAULT_REQUESTS[0], receiptId: 201, userId: 1 });
  store.writeReceipts([...store.readReceipts(), duplicate]);
  const matches = await api.getReceiptDuplicates(101); envelope(matches);
  assert.deepEqual(matches.data, [{ id: '101-201', receiptId: 101, candidateReceiptId: 201, matchReason: '동일 사용처와 금액', score: 1 }]);
});

test('고정 계정 3개 로그인 및 USER의 모든 ADMIN API 접근 금지', async () => {
  for (const [email, name, role] of [['user1@test.com', '김민서', 'USER'], ['user2@test.com', '이준호', 'USER'], ['admin@test.com', '관리자', 'ADMIN']]) {
    const response = await api.login(email, '1234');
    assert.equal(response.data.user.name, name); assert.equal(response.data.user.role, role);
    sessionStore.logout();
  }
  for (const email of ['user1@test.com', 'user2@test.com']) {
    await api.login(email, '1234');
    for (const attempt of [() => api.getAdminReceipts(), () => api.getAdminSummary(), () => api.updateOcr(101, { merchantName: '수정', paidAt: '2026-10-05', amount: 1000, reason: '보정' }), () => api.approveReceipt(101, {}), () => api.rejectReceipt(101, { rejectReason: '사유' }), () => api.settleReceipt(102, { settledAt: '2026-10-05', comment: '' })]) await assert.rejects(attempt(), code('FORBIDDEN_ROLE'));
    const foreignId = email === 'user1@test.com' ? 105 : 101;
    await assert.rejects(api.getReceipt(foreignId), code('FORBIDDEN_ROLE'));
  }
});

test('API 오류를 사용자 메시지로 정규화하고 상세 로그에서 비밀값을 제거', async () => {
  await assert.rejects(api.login('unknown@test.com', 'wrong-secret'), (error) => {
    assert.equal(error.errorCode, 'AUTH_REQUIRED');
    assert.equal(error.message, '이메일 또는 비밀번호를 확인해주세요.');
    return true;
  });
  await api.login('user1@test.com', '1234');
  await assert.rejects(api.getAdminReceipts(), (error) => {
    assert.equal(error.errorCode, 'FORBIDDEN_ROLE');
    assert.equal(error.message, '접근 권한이 없습니다.');
    return true;
  });
  await assert.rejects(apiRequest({ method: 'POST', url: '/receipts', headers: { 'X-Mock-Failure': 'FILE_UPLOAD_FAILED' }, data: new FormData() }), (error) => {
    assert.equal(error.errorCode, 'FILE_UPLOAD_FAILED');
    assert.equal(error.message, '영수증 등록에 실패했습니다. 다시 시도해주세요.');
    return true;
  });
  await assert.rejects(apiRequest({ method: 'POST', url: '/receipts/101/ocr/retry', headers: { 'X-Mock-Failure': 'OCR_FAILED' } }), (error) => {
    assert.equal(error.errorCode, 'OCR_FAILED');
    assert.equal(error.message, '영수증 인식에 실패했습니다. 다시 시도해주세요.');
    return true;
  });
  await assert.rejects(api.getReceipt(999999), (error) => {
    assert.equal(error.errorCode, 'RECEIPT_NOT_FOUND');
    assert.equal(error.message, '정보를 불러오지 못했습니다. 다시 시도해주세요.');
    return true;
  });
  await api.login('admin@test.com', '1234');
  await assert.rejects(api.settleReceipt(101, { settledAt: '2026-10-05', comment: '' }), (error) => {
    assert.equal(error.errorCode, 'INVALID_STATUS_TRANSITION');
    assert.equal(error.message, '처리에 실패했습니다. 다시 시도해주세요.');
    return true;
  });
  await assert.rejects(apiRequest({ method: 'POST', url: '/unexpected', headers: { 'X-Mock-Failure': 'UNEXPECTED_API_ERROR' } }), (error) => {
    assert.equal(error.message, '오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    return true;
  });
  await assert.rejects(apiRequest({ method: 'GET', url: '/unexpected-read', headers: { 'X-Mock-Failure': 'UNEXPECTED_API_ERROR' } }), (error) => {
    assert.equal(error.message, '오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    return true;
  });

  const password = 'sensitive-password-value';
  const token = sessionStore.getSession().accessToken;
  await assert.rejects(apiClient.request({
    method: 'POST', url: '/error-echo', data: { password },
    adapter: async (config) => ({ data: { success: false, message: `Echo ${password} Bearer ${token}`, errorCode: 'UNEXPECTED_API_ERROR' }, status: 503, statusText: 'Unavailable', headers: {}, config }),
  }));
  const logs = JSON.stringify(apiErrorLogs);
  assert.ok(logs.includes('/receipts/101/ocr/retry'));
  assert.ok(logs.includes('FILE_UPLOAD_FAILED'));
  assert.ok(!logs.includes(password));
  assert.ok(!logs.includes(token));
});

test('memo 생략 제출 및 필수 이미지/목적/카테고리 검증', async () => {
  await api.login('user1@test.com', '1234');
  const { memo: omitted, ...withoutMemo } = input('선택 메모 생략');
  assert.ok(omitted);
  const response = await api.submitReceipt(withoutMemo);
  assert.equal(response.data.status, 'OCR_PENDING');
  const detail = (await api.getReceipt(response.data.receiptId)).data;
  assert.equal(detail.memo, ''); assert.equal(detail.purpose, withoutMemo.purpose);
  assert.equal(detail.submitter.id, 1);
  assert.ok((await api.getMyReceipts()).data.items.some((r) => r.receiptId === detail.receiptId));
  assert.equal((await api.retryOcr(101)).data.status, 'OCR_PENDING');
  for (const invalid of [{ ...withoutMemo, image: undefined }, { ...withoutMemo, purpose: ' ' }, { ...withoutMemo, categoryId: undefined }, { ...withoutMemo, categoryId: 999 }, { ...withoutMemo, image: new File(['text'], 'receipt.txt', { type: 'text/plain' }) }]) await assert.rejects(api.submitReceipt(invalid), code('VALIDATION_ERROR'));
});

test('모든 상태 enum과 상세 OCR 결과, 수정 이력 영속성', async () => {
  assert.deepEqual(Object.keys(STATUS_LABELS), ['SUBMITTED', 'OCR_PENDING', 'OCR_DONE', 'REVIEWING', 'APPROVED', 'REJECTED', 'SETTLED']);
  await api.login('user1@test.com', '1234');
  const sample = (await api.getReceipt(101)).data;
  assert.equal(sample.status, 'OCR_DONE');
  assert.equal(sample.merchantName, '카페 그린브릿지'); assert.equal(sample.paidAt, '2026-10-05'); assert.equal(sample.amount, 40000); assert.equal(sample.ocrResult.confidence, 0.97);
  await api.login('admin@test.com', '1234');
  const edit = { merchantName: '금액 보정 카페', paidAt: '2026-10-04', amount: 18900, reason: '원본 확인' };
  await api.updateOcr(101, edit);
  const corrected = (await api.getReceipt(101)).data;
  for (const key of ['merchantName', 'paidAt', 'amount']) assert.equal(corrected[key], edit[key]);
  assert.equal((await api.getReceiptHistories(101)).data.at(-1).reason, edit.reason);
  assert.equal(corrected.status, 'REVIEWING');
  sessionStore.logout(); await api.login('user1@test.com', '1234');
  assert.equal((await api.getReceipt(101)).data.amount, edit.amount);
});


test('상세/HIS Response: createdAt 이력 호환과 imageUrl 보존', async () => {
  const receiptCreatedAt = '2026-10-01T01:00:00Z';
  const legacyAt = '2026-10-02T02:00:00Z';
  const historyCreatedAt = '2026-10-03T03:00:00Z';
  const imageUrl = 'https://example.test/receipts/101.png';
  const normalized = normalizeRequest({ ...DEFAULT_REQUESTS[0], createdAt: receiptCreatedAt, imageUrl,
    history: [{ label: '영수증 제출', at: legacyAt, comment: '기존 이력' },
      { label: '관리자 검토', createdAt: historyCreatedAt, at: legacyAt, reason: '원본 확인' }],
  });
  store.writeReceipts([normalized]);
  await api.login('user1@test.com', '1234');
  const detail = (await api.getReceipt(101)).data;
  assert.equal(detail.imageUrl, imageUrl);
  assert.deepEqual(Object.keys(detail).sort(), ['receiptId', 'submitterId', 'submitter', 'categoryId', 'categoryName', 'purpose', 'status', 'merchantName', 'paidAt', 'amount', 'memo', 'file', 'ocrResult', 'imageUrl'].sort());
  assert.deepEqual((await api.getReceiptHistories(101)).data.map((item) => item.createdAt), [legacyAt, historyCreatedAt]);
  assert.equal((await api.getReceiptHistories(101)).data[1].reason, '원본 확인');
  assert.ok(!('image' in detail));
  const fallback = normalizeRequest({ createdAt: receiptCreatedAt, history: [] });
  assert.equal(fallback.history[0].createdAt, receiptCreatedAt);
  await api.login('admin@test.com', '1234');
  const approved = (await api.approveReceipt(101, { comment: '검토 완료' })).data;
  assert.deepEqual(approved, { receiptId: 101, status: 'APPROVED' });
  const histories = (await api.getReceiptHistories(101)).data;
  assert.ok(Number.isFinite(Date.parse(histories.at(-1).createdAt)));
  assert.ok(!('at' in histories.at(-1)));
  assert.deepEqual(histories.at(-1).snapshot, { comment: '검토 완료' });
});
