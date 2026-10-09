import { test, expect } from '@playwright/test';

const realModeTest = process.env.VITE_API_MODE === 'real' ? test : test.skip;

realModeTest('Real API id 목록에서 상세와 이력 요청을 올바른 ID로 호출', async ({ page }) => {
  const requestedPaths = [];
  const keyWarnings = [];
  page.on('console', (message) => {
    if (message.text().includes('Each child in a list should have a unique "key" prop')) keyWarnings.push(message.text());
  });
  await page.route(/\/api\/(?:auth\/login|categories|receipts\/)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requestedPaths.push(pathname);
    let data;
    if (pathname === '/api/auth/login') {
      data = { accessToken: 'real-test-token', user: { id: 1, name: '테스트 사용자', email: 'user@test.com', role: 'USER' } };
    } else if (pathname === '/api/categories') {
      data = [{ id: 1, name: '식비', description: '식사 및 음료', active: true }];
    } else if (pathname === '/api/receipts/my') {
      data = { items: [{ id: 701, purpose: 'ID 필드 영수증', categoryId: 1, categoryName: '식비', status: 'OCR_DONE', merchantName: 'Real 응답 가게', paidAt: '2026-10-07', amount: 5000, memo: '' }], totalCount: 1 };
    } else if (pathname === '/api/receipts/701') {
      data = { id: 701, submitterId: 1, categoryId: 1, purpose: 'ID 필드 영수증', status: 'OCR_DONE', merchantName: 'Real 응답 가게', paidAt: '2026-10-07', amount: 5000, memo: '', file: null, ocrResult: null, imageUrl: null };
    } else if (pathname === '/api/receipts/701/histories') {
      data = [];
    } else {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) });
  });

  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('user@test.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('password');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: /ID 필드 영수증/ }).click();
  const dialog = page.getByRole('dialog', { name: '영수증 상세' });
  await expect(dialog).toBeVisible();
  await expect(page.getByText('#701', { exact: true })).toBeVisible();
  await expect(dialog.getByText('제출자', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('.detail-fields').getByText('식비', { exact: true })).toBeVisible();
  await expect.poll(() => requestedPaths).toContain('/api/receipts/701');
  await expect.poll(() => requestedPaths).toContain('/api/receipts/701/histories');
  await expect.poll(() => requestedPaths).toContain('/api/categories');
  expect(keyWarnings).toHaveLength(0);
});

realModeTest('Real 관리자 summary 요청에 YYYY-MM month를 전달', async ({ page }) => {
  let requestedMonth;
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('http://127.0.0.1:5181/api/**', async (route) => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname === '/api/auth/login') {
      data = { accessToken: 'real-admin-token', user: { id: 3, name: '관리자', email: 'admin@test.com', role: 'ADMIN' } };
    } else if (url.pathname === '/api/admin/dashboard/summary') {
      requestedMonth = url.searchParams.get('month');
      data = { month: requestedMonth, totalAmount: 24500, categorySummaries: [], pendingCount: 2, rejectedCount: 1, averageReviewMinutes: 17 };
    } else if (url.pathname === '/api/admin/receipts') {
      data = { items: [], totalCount: 0 };
    } else {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) });
  });

  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('password');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: '카테고리별 제출 현황' })).toBeVisible();
  await expect(page.locator('.summary-card').filter({ hasText: '승인 금액' })).toContainText('집계 정보 없음');
  await expect(page.locator('.summary-card').filter({ hasText: '정산 완료' })).toContainText('집계 정보 없음');
  await expect(page.locator('.summary-card').filter({ hasText: '평균 검토 시간' })).toContainText('17분');
  await expect.poll(() => requestedMonth).toMatch(/^\d{4}-\d{2}$/);
  expect(pageErrors).toEqual([]);
});