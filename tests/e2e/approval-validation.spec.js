import { test, expect } from '@playwright/test';
const pageErrors = new WeakMap();
test.beforeEach(({ page }) => { pageErrors.set(page, []); page.on('pageerror', error => pageErrors.get(page).push(error.message)); });
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });
const real = process.env.VITE_API_MODE === 'real';
const complete = { merchantName: '확정 상호', paidAt: '2026-10-11', amount: 5000 };
async function setup(page, final, outcome = 'saved') {
  const state = { approvals: 0, patches: 0, release: null, approvalBodies: [] };
  let receipt = { id: 101, categoryName: '식비', categoryId: 1, submitterName: '사용자', purpose: '승인 검증', status: 'OCR_DONE', ...final, ocrResult: { status: 'OCR_DONE', merchantNameRaw: '원본 상호', paidAtRaw: '2026-10-01', amountRaw: 1000 } };
  if (real) await page.route('http://127.0.0.1:5181/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    let data;
    if (path === '/api/auth/login') data = { accessToken: 'fake-test-token', user: { id: 3, name: '관리자', role: 'ADMIN' } };
    else if (path === '/api/admin/dashboard/summary') data = { totalAmount: 0, pendingCount: 1, rejectedCount: 0, categorySummaries: [] };
    else if (path === '/api/admin/receipts') data = { items: [receipt] };
    else if (path.endsWith('/histories')) data = [];
    else if (path === '/api/receipts/101') {
      if (outcome === 'refresh-failed' && state.patches) return route.fulfill({ status: 500, json: { success: false } });
      data = receipt;
    } else if (path.endsWith('/ocr') && method === 'PATCH') {
      state.patches++;
      await new Promise(resolve => { state.release = resolve; });
      if (outcome === 'failed') return route.fulfill({ status: 500, json: { success: false } });
      if (outcome !== 'null') receipt = { ...receipt, ...route.request().postDataJSON() };
      data = { receiptId: 101 }; // 수정 응답에는 확정값이 없음: 반드시 상세 재조회 필요
    } else if (path.endsWith('/approve') && method === 'POST') {
      state.approvalBodies.push(route.request().postDataJSON());
      state.approvals++; receipt = { ...receipt, status: 'APPROVED' }; data = { receiptId: 101, status: 'APPROVED' };
    } else return route.fulfill({ status: 404, json: { success: false } });
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
  await page.getByLabel('비밀번호', { exact: true }).fill(real ? 'fake-password' : '1234');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  if (!real) await page.evaluate(async final => {
    const store = await import('/src/api/mockStore.js');
    const original = store.readReceipts().find(r => r.receiptId === 101);
    window.__approvalAttempts = 0;
    const { apiClient } = await import('/src/api/client.js');
    apiClient.interceptors.request.use(config => { if (config.url.endsWith('/approve')) window.__approvalAttempts++; return config; });
    store.writeReceipts([{ ...original, ...final, status: 'OCR_DONE', history: [] }]);
  }, final);
  await page.getByRole('link', { name: '승인 관리 →', exact: true }).click();
  const detail = page.locator('.approval-detail');
  await expect(detail).toBeVisible();
  state.count = async () => real ? state.approvals : page.evaluate(() => window.__approvalAttempts);
  return { state, detail };
}
for (const [name, final, labels] of [
  ['상호명', { ...complete, merchantName: null }, ['상호명']],
  ['결제일', { ...complete, paidAt: null }, ['결제일']],
  ['금액', { ...complete, amount: null }, ['금액']],
  ['여러 항목', { merchantName: null, paidAt: null, amount: null }, ['상호명', '결제일', '금액']],
]) test(`${name} 확정값 누락: 취소는 요청 없음, 그래도 승인하기는 한 번 호출`, async ({ page }) => {
  const { state, detail } = await setup(page, final);
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '처리 확인' });
  await expect(dialog.getByRole('heading')).toHaveText('⚠️ 영수증 필수 정보가 누락되었습니다');
  await expect(dialog.locator('li')).toHaveText(labels);
  await expect(dialog.getByRole('button', { name: '승인하기', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '그래도 승인하기' })).toBeVisible();
  if (labels.includes('결제일') || labels.includes('금액')) await expect(dialog).toContainText('Cloud Insight 이상 데이터 탐지 대상');
  else await expect(dialog).not.toContainText('Cloud Insight');
  if (labels.includes('상호명')) await expect(dialog).toContainText('상호명 누락은 데이터 완성도 문제');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(await state.count()).toBe(0);
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  await dialog.getByRole('button', { name: '그래도 승인하기', exact: true }).evaluate(button => { button.click(); button.click(); });
  if (real) await expect(detail.locator('.status-badge')).toHaveText('승인');
  else await expect(detail.getByRole('alert')).toBeVisible(); // 기존 Mock API의 누락값 거부는 유지
  expect(await state.count()).toBe(1);
  if (real) { expect(state.patches).toBe(0); expect(state.approvalBodies).toEqual([{ comment: '' }]); }
});
test('모든 확정값 정상: 취소는 요청 없음, 연속 확인은 승인 한 번', async ({ page }) => {
  const { state, detail } = await setup(page, complete);
  const dialog = page.getByRole('dialog', { name: '처리 확인' });
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  await expect(dialog.getByRole('heading')).toHaveText('이 영수증을 승인하시겠습니까?');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(await state.count()).toBe(0);
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  await dialog.getByRole('button', { name: '승인하기', exact: true }).evaluate(button => { button.click(); button.click(); });
  await expect(detail.locator('.status-badge')).toHaveText('승인');
  expect(await state.count()).toBe(1);
});
for (const outcome of real ? ['saved', 'failed', 'null', 'refresh-failed'] : ['saved']) test(`OCR 수정 후 상세 확정값 재검증: ${outcome}`, async ({ page }) => {
  const { state, detail } = await setup(page, { merchantName: null, paidAt: null, amount: null }, outcome);
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OCR 정보 수정하기' }).click();
  if (real) await expect(detail.getByLabel('사용처', { exact: true })).toHaveValue('원본 상호');
  await detail.getByLabel('사용처', { exact: true }).fill(complete.merchantName);
  await detail.getByLabel('결제일', { exact: true }).fill(complete.paidAt);
  await detail.getByLabel('총 금액 (원)', { exact: true }).fill('5000');
  await detail.getByLabel('수정 사유 (필수)').fill('원본 확인 후 필수값 입력');
  await detail.getByRole('button', { name: 'OCR 수정 저장' }).click();
  if (real) {
    await expect.poll(() => state.patches).toBe(1);
    await expect(detail.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
    await expect(detail.getByRole('button', { name: 'OCR 수정 저장' })).toBeDisabled();
    state.release();
  }
  if (outcome === 'failed') {
    await expect(detail.getByRole('alert')).toBeVisible();
    await expect(detail.getByLabel('사용처', { exact: true })).toHaveValue(complete.merchantName);
    await detail.getByRole('button', { name: '취소', exact: true }).click();
  } else if (outcome === 'refresh-failed') {
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.approval-detail').getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
    expect(await state.count()).toBe(0); return;
  } else await expect(detail.getByText('OCR 결과를 수정했습니다.', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '처리 확인' });
  if (outcome === 'saved') {
    await expect(dialog.getByRole('button', { name: '승인하기', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '승인하기', exact: true }).click();
    await expect(detail.locator('.status-badge')).toHaveText('승인');
    expect(await state.count()).toBe(1);
  } else {
    await expect(dialog.locator('li')).toHaveText(['상호명', '결제일', '금액']);
    expect(await state.count()).toBe(0);
    await dialog.getByRole('button', { name: '그래도 승인하기' }).click();
    await expect(detail.locator('.status-badge')).toHaveText('승인');
    expect(await state.count()).toBe(1);
  }
});
