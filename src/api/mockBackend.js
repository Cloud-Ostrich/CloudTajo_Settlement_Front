import { MOCK_ACCOUNTS, publicUser } from './mockAccounts.js';
import { CATEGORIES, MAX_RECEIPT_SIZE, RECEIPT_IMAGE_TYPES, REVIEWABLE, today } from './contracts.js';
import { readReceipts, writeReceipts } from './mockStore.js';
import { getSession } from './session.js';
import { saveImage, imageUrl } from './mockImages.js';
let nextReceiptId = Math.max(100, ...readReceipts().map((r) => r.receiptId)) + 1;
const ok = (data, message = '요청이 처리되었습니다.') => ({ success: true, message, data });
function fail(message, errorCode) { throw Object.assign(new Error(message), { errorCode }); }
function requireUser(headers, role) {
  const session = getSession();
  if (!session || headers.get('Authorization') !== `Bearer ${session.accessToken}`) fail('로그인해주세요.', 'AUTH_REQUIRED');
  if (role && session.user.role !== role) fail('접근 권한이 없습니다.', 'FORBIDDEN_ROLE');
  return session.user;
}
function categoryName(r) { return CATEGORIES.find((c) => c.id === r.categoryId)?.name || '기타'; }
function userListItem(r) { return { receiptId: r.receiptId, purpose: r.purpose, categoryId: r.categoryId, categoryName: categoryName(r), status: r.status, merchantName: r.merchantName, paidAt: r.paidAt, amount: r.amount, memo: r.memo }; }
function adminListItem(r) { return { receiptId: r.receiptId, submitterId: r.userId, submitterName: r.userName, categoryId: r.categoryId, categoryName: categoryName(r), purpose: r.purpose, status: r.status, merchantName: r.merchantName, paidAt: r.paidAt, amount: r.amount, memo: r.memo }; }
function pageItems(items, params = {}) {
  if (params.page == null && params.size == null) return items;
  const page = Number(params.page ?? 1), size = Number(params.size ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(size) || size < 1) fail('페이지 요청을 확인해주세요.', 'VALIDATION_ERROR');
  return items.slice((page - 1) * size, page * size);
}
function historyRecord(receipt, actorId, action, fromStatus, toStatus, reason = '', snapshot = {}) {
  return { id: `${receipt.receiptId}-${receipt.history.length + 1}`, receiptId: receipt.receiptId, actorId, action, fromStatus, toStatus, reason, snapshot, createdAt: new Date().toISOString() };
}
async function detail(r) {
  const submitter = MOCK_ACCOUNTS.find((u) => u.id === r.userId);
  const hasOcr = r.merchantName != null || r.paidAt != null || r.amount != null || r.confidence != null;
  return {
    receiptId: r.receiptId, submitterId: r.userId, submitter: { id: submitter.id, name: submitter.name },
    categoryId: r.categoryId, categoryName: categoryName(r), purpose: r.purpose, status: r.status,
    merchantName: r.merchantName, paidAt: r.paidAt, amount: r.amount, memo: r.memo,
    file: { id: r.receiptId, objectKey: `mock/receipts/${r.receiptId}/${r.fileName}`, originalFilename: r.fileName, contentType: r.contentType, fileSize: r.fileSize },
    ocrResult: hasOcr ? { id: r.receiptId, provider: 'MOCK', merchantNameRaw: r.merchantName, paidAtRaw: r.paidAt, amountRaw: r.amount, confidence: r.confidence, rawPayload: { merchantName: r.merchantName, paidAt: r.paidAt, amount: r.amount } } : null,
    imageUrl: r.imageUrl ?? (r.image ? await imageUrl(r.image, r.fileName) : null),
  };
}
function body(config) { return typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}; }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export async function mockAdapter(config) {
  try { return { data: await dispatch(config), status: 200, statusText: 'OK', headers: {}, config }; }
  catch (error) { return { data: { success: false, message: error.message || '요청을 처리하지 못했습니다.', errorCode: error.errorCode || 'MOCK_STORAGE_ERROR' }, status: 200, statusText: 'OK', headers: {}, config }; }
}
async function dispatch(config) {
  const method = config.method.toUpperCase();
  const path = config.url;
  const data = body(config);
  const forcedFailure = config.headers.get('X-Mock-Failure');
  if (forcedFailure === 'FILE_UPLOAD_FAILED' && path === '/receipts' && method === 'POST') fail('Mock upload storage failure.', forcedFailure);
  if (forcedFailure === 'OCR_FAILED' && /\/ocr\/retry$/.test(path) && method === 'POST') fail('Mock OCR provider failure.', forcedFailure);
  if (forcedFailure === 'UNEXPECTED_API_ERROR') fail('Mock unexpected server failure.', forcedFailure);
  if (path === '/auth/login' && method === 'POST') {
    const account = MOCK_ACCOUNTS.find((u) => u.email === String(data.email).trim().toLowerCase() && u.password === data.password);
    if (!account) fail('인증에 실패했습니다.', 'AUTH_REQUIRED');
    return ok({ accessToken: `mock-token-${account.id}`, user: publicUser(account) }, '로그인되었습니다.');
  }
  const user = requireUser(config.headers, path.startsWith('/admin/') ? 'ADMIN' : null);
  if (path === '/users/me' && method === 'GET') return ok(publicUser(MOCK_ACCOUNTS.find((account) => account.id === user.id)));
  if (path === '/categories' && method === 'GET') return ok(CATEGORIES);
  if (path === '/receipts/my' && method === 'GET') {
    requireUser(config.headers, 'USER');
    const items = readReceipts().filter((receipt) => receipt.userId === user.id && (!config.params?.status || receipt.status === config.params.status)).map(userListItem);
    return ok({ items: pageItems(items, config.params), totalCount: items.length });
  }
  if (path === '/admin/receipts' && method === 'GET') {
    let receipts = readReceipts();
    const { status, categoryId, from, to } = config.params || {};
    if (status) receipts = receipts.filter((receipt) => receipt.status === status);
    if (categoryId != null) receipts = receipts.filter((receipt) => receipt.categoryId === Number(categoryId));
    if (from) receipts = receipts.filter((receipt) => (receipt.paidAt || receipt.createdAt.slice(0, 10)) >= from);
    if (to) receipts = receipts.filter((receipt) => (receipt.paidAt || receipt.createdAt.slice(0, 10)) <= to);
    const items = receipts.map(adminListItem);
    return ok({ items: pageItems(items, config.params), totalCount: items.length });
  }
  if (path === '/receipts' && method === 'POST') {
    requireUser(config.headers, 'USER');
    if (!(data instanceof FormData)) fail('multipart/form-data가 필요합니다.', 'INVALID_REQUEST');
    const image = data.get('image'), purpose = String(data.get('purpose') || '').trim(), categoryId = Number(data.get('categoryId')), memo = String(data.get('memo') || '').trim();
    if (!(image instanceof File) || !RECEIPT_IMAGE_TYPES.includes(image.type) || image.size > MAX_RECEIPT_SIZE || !purpose || !CATEGORIES.some((c) => c.id === categoryId)) fail('이미지, 사용 목적, 카테고리를 확인해주세요.', 'VALIDATION_ERROR');
    const receiptId = nextReceiptId++;
    await saveImage(receiptId, image);
    if (getSession()?.user.id !== user.id) fail('로그인 계정이 변경되었습니다.', 'AUTH_REQUIRED');
    const createdAt = new Date().toISOString();
    const receipt = { receiptId, userId: user.id, userName: user.name, purpose, categoryId, memo, merchantName: null, paidAt: null, amount: null, confidence: null, status: 'OCR_PENDING', createdAt, rejectReason: '', settledAt: null, image: { storage: 'indexeddb', key: receiptId }, fileName: image.name, contentType: image.type, fileSize: image.size, history: [] };
    receipt.history.push(historyRecord(receipt, user.id, 'SUBMITTED', null, 'OCR_PENDING'));
    writeReceipts([receipt, ...readReceipts()]);
    return ok({ receiptId, status: 'OCR_PENDING' }, '영수증이 제출되었고 OCR 처리가 요청되었습니다.');
  }
  const historiesMatch = path.match(/^\/receipts\/(\d+)\/histories$/);
  if (historiesMatch && method === 'GET') {
    const receipt = readReceipts().find((item) => item.receiptId === Number(historiesMatch[1]));
    if (!receipt) fail('영수증을 찾을 수 없습니다.', 'RECEIPT_NOT_FOUND');
    if (user.role !== 'ADMIN' && receipt.userId !== user.id) fail('접근 권한이 없습니다.', 'FORBIDDEN_ROLE');
    return ok(receipt.history);
  }
  const duplicatesMatch = path.match(/^\/admin\/receipts\/(\d+)\/duplicates$/);
  if (duplicatesMatch && method === 'GET') {
    const receipt = readReceipts().find((item) => item.receiptId === Number(duplicatesMatch[1]));
    if (!receipt) fail('영수증을 찾을 수 없습니다.', 'RECEIPT_NOT_FOUND');
    const normalizedMerchant = receipt.merchantName?.trim().toLowerCase();
    const items = readReceipts().filter((candidate) => candidate.receiptId !== receipt.receiptId && receipt.amount != null && candidate.amount === receipt.amount && normalizedMerchant && candidate.merchantName?.trim().toLowerCase() === normalizedMerchant)
      .map((candidate) => ({ id: `${receipt.receiptId}-${candidate.receiptId}`, receiptId: receipt.receiptId, candidateReceiptId: candidate.receiptId, matchReason: '동일 사용처와 금액', score: 1 }));
    return ok(items);
  }
  const retryMatch = path.match(/^\/receipts\/(\d+)\/ocr\/retry$/);
  if (retryMatch && method === 'POST') {
    requireUser(config.headers, 'USER');
    const receipt = readReceipts().find((item) => item.receiptId === Number(retryMatch[1]));
    if (!receipt) fail('영수증을 찾을 수 없습니다.', 'RECEIPT_NOT_FOUND');
    if (receipt.userId !== user.id) fail('접근 권한이 없습니다.', 'FORBIDDEN_ROLE');
    if (!['OCR_DONE', 'REVIEWING'].includes(receipt.status)) fail('OCR 재처리할 수 없는 상태입니다.', 'INVALID_STATUS_TRANSITION');
    const next = { ...receipt, merchantName: null, paidAt: null, amount: null, confidence: null, status: 'OCR_PENDING' };
    next.history = [...receipt.history, historyRecord(receipt, user.id, 'OCR_RETRY_REQUESTED', receipt.status, 'OCR_PENDING')];
    writeReceipts(readReceipts().map((item) => item.receiptId === next.receiptId ? next : item));
    return ok({ receiptId: next.receiptId, status: 'OCR_PENDING' });
  }
  if (path === '/admin/dashboard/summary' && method === 'GET') {
    const month = config.params?.month || today().slice(0, 7);
    const items = readReceipts().filter((r) => (r.paidAt || r.createdAt).startsWith(month));
    return ok({ month, totalAmount: items.reduce((sum, r) => sum + (r.amount || 0), 0), approvedAmount: items.filter((r) => ['APPROVED', 'SETTLED'].includes(r.status)).reduce((sum, r) => sum + (r.amount || 0), 0), pendingCount: items.filter((r) => ['SUBMITTED', 'OCR_PENDING', 'OCR_DONE', 'REVIEWING'].includes(r.status)).length, rejectedCount: items.filter((r) => r.status === 'REJECTED').length, settledCount: items.filter((r) => r.status === 'SETTLED').length, categoryStats: CATEGORIES.map((c) => ({ categoryId: c.id, categoryName: c.name, amount: items.filter((r) => r.categoryId === c.id).reduce((sum, r) => sum + (r.amount || 0), 0), count: items.filter((r) => r.categoryId === c.id).length })) });
  }
  const match = path.match(/^\/(?:admin\/)?receipts\/(\d+)(?:\/(ocr|approve|reject|settle))?$/);
  if (!match) fail('지원하지 않는 API입니다.', 'NOT_FOUND');
  const receipt = readReceipts().find((r) => r.receiptId === Number(match[1]));
  if (!receipt) fail('영수증을 찾을 수 없습니다.', 'RECEIPT_NOT_FOUND');
  if (user.role !== 'ADMIN' && receipt.userId !== user.id) fail('접근 권한이 없습니다.', 'FORBIDDEN_ROLE');
  if (!match[2] && method === 'GET') return ok(await detail(receipt));
  requireUser(config.headers, 'ADMIN');
  if (!path.startsWith('/admin/')) fail('지원하지 않는 API입니다.', 'NOT_FOUND');
  const action = match[2];
  if ((action === 'ocr' && method !== 'PATCH') || (action !== 'ocr' && method !== 'POST')) fail('지원하지 않는 메서드입니다.', 'METHOD_NOT_ALLOWED');
  let patch, historyAction, historyReason = '', snapshot = {};
  if (action === 'settle') {
    if (receipt.status !== 'APPROVED') fail('승인된 영수증만 정산 완료할 수 있습니다.', 'INVALID_STATUS_TRANSITION');
    if (!validDate(data.settledAt)) fail('정산일을 확인해주세요.', 'VALIDATION_ERROR');
    patch = { status: 'SETTLED', settledAt: data.settledAt, settledBy: user.id, settlementComment: data.comment || '' };
    historyAction = 'SETTLED'; snapshot = { settledAt: data.settledAt, comment: data.comment || '' };
  } else {
    if (!REVIEWABLE.includes(receipt.status)) fail('OCR 완료 또는 검토 중인 영수증만 처리할 수 있습니다.', 'INVALID_STATUS_TRANSITION');
    if (action === 'ocr') {
      if (!data.merchantName?.trim() || !validDate(data.paidAt) || !Number.isSafeInteger(data.amount) || data.amount <= 0 || !data.reason?.trim()) fail('OCR 정보와 수정 사유를 확인해주세요.', 'VALIDATION_ERROR');
      patch = { merchantName: data.merchantName.trim(), paidAt: data.paidAt, amount: data.amount, status: 'REVIEWING' };
      historyAction = 'OCR_UPDATED'; historyReason = data.reason.trim(); snapshot = { merchantName: patch.merchantName, paidAt: patch.paidAt, amount: patch.amount };
    } else if (action === 'approve') {
      if (!receipt.merchantName || !receipt.paidAt || !(receipt.amount > 0)) fail('OCR 정보를 먼저 확인해주세요.', 'VALIDATION_ERROR');
      patch = { status: 'APPROVED' }; historyAction = 'APPROVED'; snapshot = { comment: data.comment || '' };
    } else if (action === 'reject') {
      if (!data.rejectReason?.trim()) fail('반려 사유를 입력해주세요.', 'VALIDATION_ERROR');
      patch = { status: 'REJECTED', rejectReason: data.rejectReason.trim() };
      historyAction = 'REJECTED'; historyReason = patch.rejectReason;
    } else fail('지원하지 않는 API입니다.', 'NOT_FOUND');
  }
  const next = { ...receipt, ...patch, history: [...receipt.history, historyRecord(receipt, user.id, historyAction, receipt.status, patch.status, historyReason, snapshot)] };
  writeReceipts(readReceipts().map((r) => r.receiptId === next.receiptId ? next : r));
  if (action === 'ocr') return ok({ receiptId: next.receiptId, merchantName: next.merchantName, paidAt: next.paidAt, amount: next.amount, status: next.status });
  if (action === 'approve') return ok({ receiptId: next.receiptId, status: next.status });
  if (action === 'reject') return ok({ receiptId: next.receiptId, status: next.status });
  return ok({ receiptId: next.receiptId, status: next.status, settlement: { id: next.receiptId, settledBy: next.settledBy, settledAt: next.settledAt, comment: next.settlementComment } });
}
