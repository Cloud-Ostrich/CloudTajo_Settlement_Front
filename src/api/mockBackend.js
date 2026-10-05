import { MOCK_ACCOUNTS, publicUser } from './mockAccounts.js';
import { CATEGORIES, MAX_RECEIPT_SIZE, RECEIPT_IMAGE_TYPES, REVIEWABLE, today } from './contracts.js';
import { getSession, readReceipts, writeReceipts } from './mockStore.js';
import { saveImage, imageUrl } from './mockImages.js';
let nextReceiptId = Math.max(100, ...readReceipts().map((r) => r.receiptId)) + 1;
const ok = (data, message = '요청이 처리되었습니다.') => ({ success: true, message, data });
function fail(message, errorCode) { throw Object.assign(new Error(message), { errorCode }); }
function requireUser(headers, role) {
  const session = getSession();
  if (!session || headers.get('Authorization') !== `Bearer ${session.accessToken}`) fail('로그인해주세요.', 'UNAUTHORIZED');
  if (role && session.user.role !== role) fail('접근 권한이 없습니다.', 'FORBIDDEN');
  return session.user;
}
function listItem(r) { return { receiptId: r.receiptId, purpose: r.purpose, categoryName: CATEGORIES.find((c) => c.id === r.categoryId)?.name || '기타', amount: r.amount, merchantName: r.merchantName, paidAt: r.paidAt, status: r.status }; }
async function detail(r) {
  const user = publicUser(MOCK_ACCOUNTS.find((u) => u.id === r.userId));
  return { ...listItem(r), user, categoryId: r.categoryId, memo: r.memo, confidence: r.confidence, imageUrl: await imageUrl(r.image, r.fileName), createdAt: r.createdAt, rejectReason: r.rejectReason, history: r.history, settledAt: r.settledAt };
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
  if (path === '/auth/login' && method === 'POST') {
    const account = MOCK_ACCOUNTS.find((u) => u.email === String(data.email).trim().toLowerCase() && u.password === data.password);
    if (!account) fail('이메일 또는 비밀번호를 확인해주세요.', 'INVALID_CREDENTIALS');
    return ok({ accessToken: `mock-token-${account.id}`, user: publicUser(account) }, '로그인되었습니다.');
  }
  const user = requireUser(config.headers, path.startsWith('/admin/') ? 'ADMIN' : null);
  if (path === '/categories' && method === 'GET') return ok(CATEGORIES);
  if (path === '/receipts/my' && method === 'GET') { requireUser(config.headers, 'USER'); return ok(readReceipts().filter((r) => r.userId === user.id).map(listItem)); }
  if (path === '/admin/receipts' && method === 'GET') return ok(readReceipts().map((r) => ({ ...listItem(r), user: publicUser(MOCK_ACCOUNTS.find((u) => u.id === r.userId)) })));
  if (path === '/receipts' && method === 'POST') {
    requireUser(config.headers, 'USER');
    if (!(data instanceof FormData)) fail('multipart/form-data가 필요합니다.', 'INVALID_REQUEST');
    const image = data.get('image'), purpose = String(data.get('purpose') || '').trim(), categoryId = Number(data.get('categoryId')), memo = String(data.get('memo') || '').trim();
    if (!(image instanceof File) || !RECEIPT_IMAGE_TYPES.includes(image.type) || image.size > MAX_RECEIPT_SIZE || !purpose || !CATEGORIES.some((c) => c.id === categoryId)) fail('이미지, 사용 목적, 카테고리를 확인해주세요.', 'VALIDATION_ERROR');
    const receiptId = nextReceiptId++;
    await saveImage(receiptId, image);
    if (getSession()?.user.id !== user.id) fail('로그인 계정이 변경되었습니다.', 'UNAUTHORIZED');
    const createdAt = new Date().toISOString();
    writeReceipts([{ receiptId, userId: user.id, userName: user.name, purpose, categoryId, memo, merchantName: null, paidAt: null, amount: null, confidence: null, status: 'OCR_PENDING', createdAt, rejectReason: '', settledAt: null, image: { storage: 'indexeddb', key: receiptId }, fileName: image.name, history: [{ label: '영수증 제출 · OCR 처리 요청', at: createdAt }] }, ...readReceipts()]);
    return ok({ receiptId, status: 'OCR_PENDING' }, '영수증이 제출되었고 OCR 처리가 요청되었습니다.');
  }
  if (path === '/admin/dashboard/summary' && method === 'GET') {
    const month = config.params?.month || today().slice(0, 7);
    const items = readReceipts().filter((r) => (r.paidAt || r.createdAt).startsWith(month));
    const reviewed = items.filter((r) => ['APPROVED', 'REJECTED', 'SETTLED'].includes(r.status));
    const durations = reviewed.map((r) => { const h = r.history.find((h) => ['승인', '반려'].some((word) => h.label.includes(word))); return h ? Math.max(0, (Date.parse(h.at) - Date.parse(r.createdAt)) / 60000) : null; }).filter((value) => value !== null);
    return ok({ month, totalAmount: items.reduce((sum, r) => sum + (r.amount || 0), 0), approvedAmount: items.filter((r) => ['APPROVED', 'SETTLED'].includes(r.status)).reduce((sum, r) => sum + (r.amount || 0), 0), pendingCount: items.filter((r) => ['SUBMITTED', 'OCR_PENDING', 'OCR_DONE', 'REVIEWING'].includes(r.status)).length, rejectedCount: items.filter((r) => r.status === 'REJECTED').length, settledCount: items.filter((r) => r.status === 'SETTLED').length, categoryStats: CATEGORIES.map((c) => ({ categoryId: c.id, categoryName: c.name, count: items.filter((r) => r.categoryId === c.id).length, totalAmount: items.filter((r) => r.categoryId === c.id).reduce((sum, r) => sum + (r.amount || 0), 0) })), avgReviewMinutes: durations.length ? Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length) : 0 });
  }
  const match = path.match(/^\/(?:admin\/)?receipts\/(\d+)(?:\/(ocr|approve|reject|settle))?$/);
  if (!match) fail('지원하지 않는 API입니다.', 'NOT_FOUND');
  const receipt = readReceipts().find((r) => r.receiptId === Number(match[1]));
  if (!receipt) fail('영수증을 찾을 수 없습니다.', 'NOT_FOUND');
  if (user.role !== 'ADMIN' && receipt.userId !== user.id) fail('접근 권한이 없습니다.', 'FORBIDDEN');
  if (!match[2] && method === 'GET') return ok(await detail(receipt));
  requireUser(config.headers, 'ADMIN');
  if (!path.startsWith('/admin/')) fail('지원하지 않는 API입니다.', 'NOT_FOUND');
  const action = match[2];
  if ((action === 'ocr' && method !== 'PATCH') || (action !== 'ocr' && method !== 'POST')) fail('지원하지 않는 메서드입니다.', 'METHOD_NOT_ALLOWED');
  let patch, label;
  if (action === 'settle') {
    if (receipt.status !== 'APPROVED') fail('승인된 영수증만 정산 완료할 수 있습니다.', 'INVALID_STATUS');
    if (!validDate(data.settledAt)) fail('정산일을 확인해주세요.', 'VALIDATION_ERROR');
    patch = { status: 'SETTLED', settledAt: data.settledAt }; label = '정산 완료';
  } else {
    if (!REVIEWABLE.includes(receipt.status)) fail('OCR 완료 또는 검토 중인 영수증만 처리할 수 있습니다.', 'INVALID_STATUS');
    if (action === 'ocr') {
      if (!data.merchantName?.trim() || !validDate(data.paidAt) || !Number.isSafeInteger(data.amount) || data.amount <= 0 || !data.reason?.trim()) fail('OCR 정보와 수정 사유를 확인해주세요.', 'VALIDATION_ERROR');
      patch = { merchantName: data.merchantName.trim(), paidAt: data.paidAt, amount: data.amount, status: 'REVIEWING' }; label = 'OCR 결과 수정';
    } else if (action === 'approve') {
      if (!receipt.merchantName || !receipt.paidAt || !(receipt.amount > 0)) fail('OCR 정보를 먼저 확인해주세요.', 'VALIDATION_ERROR');
      patch = { status: 'APPROVED' }; label = '관리자 승인';
    } else if (action === 'reject') {
      if (!data.rejectReason?.trim()) fail('반려 사유를 입력해주세요.', 'VALIDATION_ERROR');
      patch = { status: 'REJECTED', rejectReason: data.rejectReason.trim() }; label = '관리자 반려';
    } else fail('지원하지 않는 API입니다.', 'NOT_FOUND');
  }
  const next = { ...receipt, ...patch, history: [...receipt.history, { label, at: new Date().toISOString(), reason: data.reason || data.rejectReason || '', comment: data.comment || '' }] };
  writeReceipts(readReceipts().map((r) => r.receiptId === next.receiptId ? next : r));
  return ok(await detail(next));
}
