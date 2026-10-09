import { test, expect } from '@playwright/test';

const realModeTest = process.env.VITE_API_MODE === 'real' ? test : test.skip;

for (const kind of ['zero', 'null', 'missing']) {
  realModeTest(`운영 집계의 0/null/누락 표시: ${kind}`, async ({ page }) => {
    const requestedPaths = [];
    await page.route('http://127.0.0.1:5181/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      requestedPaths.push(path);
      let data;
      if (path === '/api/auth/login') data = { accessToken: 'test-token', user: { id: 3, role: 'ADMIN', name: '관리자' } };
      else if (path === '/api/admin/dashboard/summary') {
        data = kind === 'missing' ? {} : Object.fromEntries(['totalAmount', 'approvedAmount', 'pendingCount', 'rejectedCount', 'settledCount', 'averageReviewMinutes'].map((field) => [field, kind === 'zero' ? 0 : null]));
        if (kind !== 'missing') data.categorySummaries = kind === 'zero' ? [] : null;
        // OCR payload must never be used to invent summary totals.
        data.ocrResult = { amountRaw: 100000 };
      } else return route.fulfill({ status: 404, json: { success: false } });
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/');
    await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('password');
    await page.getByRole('button', { name: '로그인 →', exact: true }).click();
    const labels = ['총 제출 금액', '승인 금액', '처리 대기', '반려', '정산 완료', '평균 검토 시간'];
    for (const [index, label] of labels.entries()) {
      const expected = kind === 'zero' ? index < 2 ? '0원' : index === 5 ? '0분' : '0건' : kind === 'null' ? '집계값 없음' : '집계 정보 없음';
      await expect(page.locator('.summary-card').filter({ hasText: label }).locator('strong')).toHaveText(expected);
    }
    await expect(page.getByText(kind === 'zero' ? '해당 월의 카테고리 집계가 없습니다.' : '카테고리 집계 정보가 제공되지 않았습니다.', { exact: true })).toBeVisible();
    expect(requestedPaths.every((path) => ['/api/auth/login', '/api/admin/dashboard/summary'].includes(path))).toBe(true);
  });
}

realModeTest('관리자 목록: 필요한 상세만 조회하고 최종값/OCR/실패/필터 캐시 처리', async ({ page }) => {
  const reads = [];
  const mutations = [];
  const base = { categoryId: 1, categoryName: '식비', submitterName: '사용자', merchantName: null, paidAt: null, amount: null };
  const items = [
    { ...base, id: 901, purpose: '완전한 최종값', status: 'APPROVED', merchantName: '최종 가게', paidAt: '2026-10-01', amount: 1000 },
    { ...base, id: 902, purpose: 'OCR 목록', status: 'OCR_DONE', ocrResult: { merchantNameRaw: '목록 OCR', paidAtRaw: '2026-10-02', amountRaw: 2000 } },
    { ...base, id: 903, purpose: '상세 보완', status: 'REVIEWING', merchantName: '목록 확정 상호' },
    { ...base, id: 904, purpose: '정산 보완', status: 'SETTLED' },
    { ...base, id: 905, purpose: '조회 실패', status: 'APPROVED', amount: 5000 },
    { ...base, id: 906, purpose: '처리 대기', status: 'OCR_PENDING' },
    { ...base, id: 907, purpose: '승인 보완', status: 'APPROVED' },
    { ...base, id: 908, purpose: '다른 최종값', status: 'SETTLED', merchantName: '확정 정산 가게', paidAt: '2026-10-08', amount: 8000 },
  ];
  await page.route('http://127.0.0.1:5181/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') mutations.push(path);
    let data;
    if (path === '/api/auth/login') data = { accessToken: 'test-token', user: { id: 3, role: 'ADMIN', name: '관리자' } };
    else if (path === '/api/admin/dashboard/summary') data = { totalAmount: 0, pendingCount: 0, rejectedCount: 0, categorySummaries: [] };
    else if (path === '/api/admin/receipts') data = { items, totalCount: items.length };
    else if (path.endsWith('/histories')) data = [];
    else if (/\/api\/receipts\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      reads.push(id);
      if (id === 905) return route.fulfill({ status: 500, json: { success: false } });
      data = { ...items.find((item) => item.id === id), ocrResult: { merchantNameRaw: `상세 OCR ${id}`, paidAtRaw: '2026-10-03', amountRaw: 3000 } };
      if (id === 903) data.paidAt = '2026-10-04';
    } else return route.fulfill({ status: 404, json: { success: false } });
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('password');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  await page.getByRole('link', { name: '승인 관리 →', exact: true }).click();
  const row = (purpose) => page.locator('.request-table tbody tr').filter({ hasText: purpose });
  await expect(row('OCR 목록')).toContainText('목록 OCR');
  await expect(row('상세 보완')).toContainText('목록 확정 상호');
  await expect(row('상세 보완')).toContainText('2026.10.04');
  await expect(row('상세 보완')).toContainText('3,000원');
  await expect(row('정산 보완')).toContainText('상세 OCR 904');
  await expect(row('승인 보완')).toContainText('상세 OCR 907');
  await expect.poll(() => reads.includes(905)).toBe(true);
  await expect(row('조회 실패')).toContainText('5,000원');
  await expect(row('조회 실패')).toContainText('OCR 인식 대기');
  await expect(row('처리 대기')).toContainText('OCR 인식 대기');
  expect(reads).not.toContain(902);
  expect(reads).not.toContain(906);
  expect(reads).not.toContain(908);
  const previewReads = () => reads.filter((id) => [903, 904, 905, 907].includes(id));
  expect(previewReads().sort()).toEqual([903, 904, 905, 907]);
  await page.locator('.filter-tabs').getByRole('button', { name: '반려', exact: true }).click();
  await expect(page.locator('.request-table tbody tr')).toHaveCount(0);
  await page.locator('.filter-tabs').getByRole('button', { name: '전체', exact: true }).click();
  await expect(row('승인 보완')).toContainText('상세 OCR 907');
  expect(previewReads().sort()).toEqual([903, 904, 905, 907]);
  expect(mutations).toEqual(['/api/auth/login']);
});

for (const outcome of ['saved', 'null', 'partial', 'failed']) {
  realModeTest(`Real OCR 직접 승인: ${outcome}`, async ({ page }) => {
    let approved = false;
    const mutations = [];
    const readsAfterApproval = [];
    const raw = { merchantNameRaw: 'OCR 가게', paidAtRaw: '2026-10-07', amountRaw: 5000, status: 'OCR_DONE' };
    await page.route('http://127.0.0.1:5181/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      if (method !== 'GET') mutations.push({ path, method, body: route.request().postDataJSON() });
      else if (approved) readsAfterApproval.push(path);
      const final = approved && outcome === 'saved'
        ? { merchantName: raw.merchantNameRaw, paidAt: raw.paidAtRaw, amount: raw.amountRaw }
        : { merchantName: approved && outcome === 'partial' ? raw.merchantNameRaw : null, paidAt: null, amount: null };
      const receipt = { id: 801, categoryId: 1, categoryName: '식비', purpose: '직접 승인 확인', submitterName: '사용자', submitter: { name: '사용자' }, status: approved ? 'APPROVED' : 'OCR_DONE', ...final, ocrResult: raw };
      let data;
      if (path === '/api/auth/login' || path === '/api/users/me') {
        const user = { id: 3, name: '관리자', role: 'ADMIN', email: 'admin@test.com' };
        data = path.endsWith('/login') ? { accessToken: 'test-token', user } : user;
      } else if (path === '/api/admin/dashboard/summary') {
        data = { month: '2026-10', totalAmount: 5000, pendingCount: 1, rejectedCount: 0, averageReviewMinutes: 0, categorySummaries: [] };
      } else if (path === '/api/admin/receipts') {
        data = { items: [receipt], totalCount: 1 };
      } else if (path === '/api/receipts/801') {
        data = receipt;
      } else if (path === '/api/receipts/801/histories') {
        data = approved ? [{ id: 1, action: 'APPROVED', createdAt: '2026-10-07T01:00:00Z' }] : [];
      } else if (path === '/api/admin/receipts/801/approve' && method === 'POST') {
        if (outcome === 'failed') return route.fulfill({ status: 400, json: { success: false, errorCode: 'VALIDATION_ERROR', message: 'Approval failed' } });
        approved = true;
        data = { receiptId: 801, status: 'APPROVED' };
      } else {
        return route.fulfill({ status: 404, json: { success: false } });
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/');
    await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('password');
    await page.getByRole('button', { name: '로그인 →', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.getByRole('link', { name: '승인 관리 →', exact: true }).click();
    await page.locator('.filter-tabs').getByRole('button', { name: '검토 필요', exact: true }).click();
    const detail = page.locator('.approval-detail');
    await expect(detail.getByText('OCR 가게', { exact: true })).toBeVisible();
    await detail.getByLabel('검토 의견 (선택)').fill('원본 확인 완료');
    await detail.getByRole('button', { name: '승인', exact: true }).click();
    if (outcome === 'failed') {
      await expect(detail.getByRole('alert')).toBeVisible();
      await expect(detail.locator('.status-badge')).toHaveText('OCR 완료');
    } else {
      await expect(detail.locator('.status-badge')).toHaveText('승인');
      await expect(detail.getByText('요청을 승인했습니다.', { exact: true })).toBeVisible();
      await expect.poll(() => readsAfterApproval).toContain('/api/receipts/801');
      await expect.poll(() => readsAfterApproval).toContain('/api/admin/receipts');
      await expect.poll(() => readsAfterApproval).toContain('/api/receipts/801/histories');
      await expect(page.locator('.request-table tbody tr')).toHaveCount(0);
      const missingNotice = detail.getByText(/승인된 영수증의 최종 정보 일부가 비어 있습니다/);
      if (outcome === 'saved') await expect(missingNotice).toHaveCount(0);
      else await expect(missingNotice).toBeVisible();
      await page.locator('.filter-tabs').getByRole('button', { name: '승인', exact: true }).click();
      await expect(page.locator('.request-table tbody .status-badge')).toHaveText('승인');
    }
    expect(mutations.filter((request) => request.path !== '/api/auth/login')).toEqual([
      { path: '/api/admin/receipts/801/approve', method: 'POST', body: { comment: '원본 확인 완료' } },
    ]);
  });
}

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
  const ocrUpdateRequests = [];
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
      data = { month: requestedMonth, totalAmount, categorySummaries: [{ categoryId: 1, categoryName: `${requestedMonth} 식비`, amount: totalAmount, count: 1 }], pendingCount: 2, rejectedCount: 1, averageReviewMinutes: -500.3333333333333 };
    } else if (url.pathname === '/api/admin/receipts') {
      data = { items: [
        { id: 702, submitterId: 1, submitterName: '테스트 사용자', categoryId: 1, categoryName: '식비', purpose: '관리자 확인용', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null },
        { id: 703, submitterId: 1, submitterName: '테스트 사용자', categoryId: 1, categoryName: '식비', purpose: '인식 정보 없는 영수증', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null },
        { id: 704, submitterId: 1, submitterName: '테스트 사용자', categoryId: 1, categoryName: '식비', purpose: '최종값 우선 확인', status: 'REVIEWING', merchantName: '확정 상호', paidAt: '2026-01-02', amount: 5000 },
      ], totalCount: 3 };
    } else if (url.pathname === '/api/receipts/702') {
      data = { id: 702, submitterId: 1, submitter: { id: 1, name: '테스트 사용자' }, categoryId: 1, categoryName: '식비', purpose: '관리자 확인용', status: 'REVIEWING', merchantName: null, paidAt: null, amount: null, memo: '', file: null, ocrResult: { status: 'OCR_DONE', merchantNameRaw: '원본 상호', paidAtRaw: '2017-07-05', amountRaw: 100000, confidence: null } };
    } else if (url.pathname === '/api/receipts/703') {
      data = { id: 703, submitterId: 1, submitter: { id: 1, name: '테스트 사용자' }, categoryId: 1, categoryName: '식비', purpose: '인식 정보 없는 영수증', status: 'OCR_DONE', merchantName: null, paidAt: null, amount: null, memo: '', file: null, ocrResult: { status: 'OCR_DONE', merchantNameRaw: null, paidAtRaw: null, amountRaw: null } };
    } else if (url.pathname === '/api/receipts/702/histories') {
      data = [];
    } else if (url.pathname === '/api/receipts/703/histories') {
      data = [];
    } else if (url.pathname === '/api/receipts/704') {
      data = { id: 704, submitterId: 1, submitter: { id: 1, name: '테스트 사용자' }, categoryId: 1, categoryName: '식비', purpose: '최종값 우선 확인', status: 'REVIEWING', merchantName: '확정 상호', paidAt: '2026-01-02', amount: 5000, memo: '', file: null, ocrResult: { status: 'OCR_DONE', merchantNameRaw: '다른 원본 상호', paidAtRaw: '2017-07-05', amountRaw: 100000, confidence: 0.9 } };
    } else if (url.pathname === '/api/receipts/704/histories') {
      data = [];
    } else if (url.pathname === '/api/admin/receipts/704/ocr' && route.request().method() === 'PATCH') {
      ocrUpdateRequests.push(url.pathname);
      data = { receiptId: 704, status: 'REVIEWING' };
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
  await expect(page.locator('.summary-card').filter({ hasText: '평균 검토 시간' })).toContainText('집계 정보 없음');
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
  await expect(approvalDetail.getByRole('heading', { name: 'OCR 결과' })).toBeVisible();
  await expect(approvalDetail.getByRole('heading', { name: 'OCR 인식 결과(관리자 검토 전)' })).toHaveCount(0);
  await expect(approvalDetail.getByText('원본 상호', { exact: true })).toBeVisible();
  await expect(approvalDetail.getByText('신뢰도 정보 없음', { exact: true })).toBeVisible();
  await approvalDetail.getByRole('button', { name: 'OCR 수정', exact: true }).click();
  await expect(approvalDetail.getByLabel('사용처', { exact: true })).toHaveValue('원본 상호');
  await expect(approvalDetail.getByLabel('결제일', { exact: true })).toHaveValue('2017-07-05');
  await expect(approvalDetail.getByLabel('총 금액 (원)', { exact: true })).toHaveValue('100000');
  await approvalDetail.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: /인식 정보 없는 영수증/ }).click();
  await expect(approvalDetail.getByText('OCR 인식 완료', { exact: true })).toBeVisible();
  await expect(approvalDetail.getByText('인식 정보 없음', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /최종값 우선 확인/ }).click();
  await expect(approvalDetail.getByRole('region', { name: '최종 확정 정보' }).getByText('확정 상호', { exact: true })).toBeVisible();
  await expect(approvalDetail.getByRole('region', { name: '최종 확정 정보' }).getByText('다른 원본 상호', { exact: true })).toHaveCount(0);
  await approvalDetail.getByRole('button', { name: 'OCR 수정', exact: true }).click();
  await expect(approvalDetail.getByLabel('사용처', { exact: true })).toHaveValue('확정 상호');
  await expect(approvalDetail.getByLabel('결제일', { exact: true })).toHaveValue('2026-01-02');
  await expect(approvalDetail.getByLabel('총 금액 (원)', { exact: true })).toHaveValue('5000');
  expect(ocrUpdateRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
