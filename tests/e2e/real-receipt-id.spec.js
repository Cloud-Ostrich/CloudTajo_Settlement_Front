import { test, expect } from '@playwright/test';

const realModeTest = process.env.VITE_API_MODE === 'real' ? test : test.skip;

realModeTest('Real API id 목록에서 상세와 이력 요청을 올바른 ID로 호출', async ({ page }) => {
  const requestedPaths = [];
  const keyWarnings = [];
  const imageUrl = 'https://kr.object.ncloudstorage.com/test/receipt.png';
  await page.route(imageUrl, (route) => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64'),
  }));
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
      data = { id: 701, submitterId: 1, categoryId: 1, purpose: 'ID 필드 영수증', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null, memo: '', file: { url: imageUrl }, ocrResult: { status: 'OCR_DONE', merchantNameRaw: '보소다테점', paidAtRaw: '2017-07-05', amountRaw: 100000 }, imageUrl: 'https://fallback.invalid/receipt.png' };
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
  await expect(dialog.getByText('OCR 인식 완료', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'OCR 인식 결과(관리자 검토 전)' })).toBeVisible();
  await expect(dialog.getByText('보소다테점', { exact: true })).toBeVisible();
  await expect(dialog.getByText('2017-07-05', { exact: true })).toBeVisible();
  await expect(dialog.getByText('100,000원', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: '최종 확정 정보' })).toHaveCount(0);
  const image = dialog.locator('img.review-preview');
  await expect(image).toHaveAttribute('src', imageUrl);
  await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  await image.evaluate((element) => element.dispatchEvent(new Event('error')));
  await expect(dialog.getByText('원본 이미지를 불러올 수 없습니다.', { exact: true })).toBeVisible();
  await expect.poll(() => requestedPaths).toContain('/api/receipts/701');
  await expect.poll(() => requestedPaths).toContain('/api/receipts/701/histories');
  await expect.poll(() => requestedPaths).toContain('/api/categories');
  expect(keyWarnings).toHaveLength(0);
});

realModeTest('Real 관리자 summary 요청에 YYYY-MM month를 전달', async ({ page }) => {
  const requestedMonths = [];
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('http://127.0.0.1:5181/api/**', async (route) => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname === '/api/auth/login') {
      data = { accessToken: 'real-admin-token', user: { id: 3, name: '관리자', email: 'admin@test.com', role: 'ADMIN' } };
    } else if (url.pathname === '/api/users/me') {
      data = { id: 3, name: '관리자', email: 'admin@test.com', role: 'ADMIN' };
    } else if (url.pathname === '/api/admin/dashboard/summary') {
      const requestedMonth = url.searchParams.get('month');
      requestedMonths.push(requestedMonth);
      const totalAmount = requestedMonth === '2025-12' ? 12500 : requestedMonth === '2026-02' ? 26000 : 18000;
      data = { month: requestedMonth, totalAmount, categorySummaries: [{ categoryId: 1, categoryName: `${requestedMonth} 식비`, amount: totalAmount, count: 1 }], pendingCount: 2, rejectedCount: 1, averageReviewMinutes: 17 };
    } else if (url.pathname === '/api/admin/receipts') {
      data = { items: [
        { id: 702, submitterId: 1, submitterName: '테스트 사용자', categoryId: 1, categoryName: '식비', purpose: '관리자 확인용', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null },
        { id: 703, submitterId: 1, submitterName: '테스트 사용자', categoryId: 1, categoryName: '식비', purpose: '인식 정보 없는 영수증', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null },
      ], totalCount: 2 };
    } else if (url.pathname === '/api/receipts/702') {
      data = { id: 702, submitterId: 1, submitter: { id: 1, name: '테스트 사용자' }, categoryId: 1, categoryName: '식비', purpose: '관리자 확인용', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null, memo: '', file: null, ocrResult: { status: 'OCR_DONE', merchantNameRaw: '원본 상호', paidAtRaw: '2017-07-05', amountRaw: 100000 } };
    } else if (url.pathname === '/api/receipts/703') {
      data = { id: 703, submitterId: 1, submitter: { id: 1, name: '테스트 사용자' }, categoryId: 1, categoryName: '식비', purpose: '인식 정보 없는 영수증', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null, memo: '', file: null, ocrResult: { status: 'OCR_DONE', merchantNameRaw: null, paidAtRaw: null, amountRaw: null } };
    } else if (url.pathname === '/api/receipts/702/histories') {
      data = [];
    } else if (url.pathname === '/api/receipts/703/histories') {
      data = [];
    } else {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) });
  });

  await page.clock.install({ time: new Date('2026-01-15T03:00:00.000Z') });
  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('password');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: '카테고리별 제출 현황' })).toBeVisible();
  await expect(page.locator('.summary-card').filter({ hasText: '승인 금액' })).toContainText('집계 정보 없음');
  await expect(page.locator('.summary-card').filter({ hasText: '정산 완료' })).toContainText('집계 정보 없음');
  await expect(page.locator('.summary-card').filter({ hasText: '평균 검토 시간' })).toContainText('17분');
  const yearSelect = page.getByLabel('조회 연도');
  const monthSelect = page.getByLabel('조회 월');
  const totalAmountCard = page.locator('.summary-card').filter({ hasText: '총 제출 금액' });
  await expect(yearSelect).toHaveValue('2026');
  await expect(monthSelect).toHaveValue('01');
  await expect(yearSelect.locator('option')).toHaveCount(7);
  await expect(yearSelect.locator('option').first()).toHaveAttribute('value', '2021');
  await expect(yearSelect.locator('option').last()).toHaveAttribute('value', '2027');
  await expect.poll(() => requestedMonths.at(-1)).toBe('2026-01');
  await expect(page.getByText('2026년 1월 정산 현황')).toBeVisible();
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);

  await page.getByRole('button', { name: '이전 달' }).click();
  await expect(yearSelect).toHaveValue('2025');
  await expect(monthSelect).toHaveValue('12');
  await expect.poll(() => requestedMonths.at(-1)).toBe('2025-12');
  await expect(totalAmountCard).toContainText('12,500원');
  await expect(page.getByText('2025-12 식비', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(yearSelect).toHaveValue('2026');
  await expect(monthSelect).toHaveValue('01');
  await expect.poll(() => requestedMonths.at(-1)).toBe('2026-01');
  await expect(totalAmountCard).toContainText('18,000원');

  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(yearSelect).toHaveValue('2026');
  await expect(monthSelect).toHaveValue('02');
  await expect.poll(() => requestedMonths.at(-1)).toBe('2026-02');
  await expect(totalAmountCard).toContainText('26,000원');

  await yearSelect.selectOption('2025');
  await monthSelect.selectOption('11');
  await expect.poll(() => requestedMonths.at(-1)).toBe('2025-11');
  await page.getByRole('button', { name: '이번 달' }).click();
  await expect(yearSelect).toHaveValue('2026');
  await expect(monthSelect).toHaveValue('01');
  await expect.poll(() => requestedMonths.at(-1)).toBe('2026-01');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);

  await page.goto('/admin/approvals');
  const approvalDetail = page.locator('.approval-detail');
  await expect(approvalDetail.getByText('OCR 인식 완료', { exact: true })).toBeVisible();
  await expect(approvalDetail.getByRole('heading', { name: 'OCR 인식 결과(관리자 검토 전)' })).toBeVisible();
  await expect(approvalDetail.getByText('원본 상호', { exact: true })).toBeVisible();
  await approvalDetail.getByRole('button', { name: 'OCR 수정', exact: true }).click();
  await expect(approvalDetail.getByLabel('사용처', { exact: true })).toHaveValue('');
  await expect(approvalDetail.getByLabel('결제일', { exact: true })).toHaveValue('');
  await expect(approvalDetail.getByLabel('총 금액 (원)', { exact: true })).toHaveValue('');
  await approvalDetail.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: /인식 정보 없는 영수증/ }).click();
  await expect(approvalDetail.getByText('OCR 인식 완료', { exact: true })).toBeVisible();
  await expect(approvalDetail.getByText('인식된 정보 없음', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});