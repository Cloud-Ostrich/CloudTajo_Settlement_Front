import { test, expect } from '@playwright/test';
// 각 test는 Playwright의 독립 BrowserContext를 사용합니다.
// 실제 앱의 Mock API와 localStorage/IndexedDB를 쓰며 서버 응답을 intercept하지 않습니다.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');
const purpose = 'E2E 김민서 신규 영수증';
async function login(page, email) {
  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill('1234');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  await expect(page).toHaveURL(email === 'admin@test.com' ? /\/admin\/dashboard$/ : /\/dashboard$/);
}
async function logout(page) {
  await page.getByRole('link', { name: '로그아웃', exact: true }).click();
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible();
}
async function submit(page, memo = '') {
  await page.getByRole('link', { name: '+ 영수증 등록', exact: true }).click();
  await page.locator('#receipt-file').setInputFiles({ name: 'test-receipt.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('선택한 영수증 미리보기')).toBeVisible();
  await page.getByLabel('사용 목적 (필수)').fill(purpose);
  await page.getByLabel('카테고리 (필수)').selectOption('1');
  if (memo) await page.getByLabel('메모 (선택)').fill(memo);
  await page.getByRole('button', { name: '영수증 제출', exact: true }).click();
  await expect(page.getByRole('heading', { name: '영수증이 제출되었어요' })).toBeVisible();
  await expect(page.getByText(/제출 번호 #.*OCR 처리 중/)).toBeVisible();
  await page.getByRole('link', { name: '내 제출 현황 확인' }).click();
  return page.locator('.submission-card').filter({ hasText: purpose });
}
async function selectAdmin(page, merchant) {
  await page.getByRole('link', { name: '승인 관리', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: merchant });
  await row.getByRole('button').click();
  await expect(page.locator('.approval-detail')).toBeVisible();
  return row;
}

test('신규 제출/미리보기/상세/OCR_PENDING 유지, 두 USER 분리 및 관리자 전체 조회', async ({ page }) => {
  await login(page, 'user1@test.com');
  const row = await submit(page, '원본 확인용 메모');
  await expect(row.getByText('OCR 처리 중', { exact: true })).toBeVisible();
  await row.click();
  const dialog = page.getByRole('dialog', { name: '영수증 상세' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('OCR 처리 중입니다.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('김민서', { exact: true })).toBeVisible();
  await expect(dialog.getByText('원본 확인용 메모', { exact: true })).toBeVisible();
  await expect(dialog.locator('img')).toBeVisible();
  await expect(dialog.locator('.receipt-timeline time').first()).toHaveAttribute('datetime', /T/);
  await expect(dialog.locator('.receipt-timeline')).not.toContainText('Invalid Date');
  await expect(dialog.getByRole('heading', { name: 'OCR 결과' })).toHaveCount(0);
  await expect(dialog.locator('input,textarea')).toHaveCount(0);
  await dialog.getByRole('button', { name: '영수증 상세 닫기' }).click();
  await page.reload();
  await expect(page.locator('.submission-card').filter({ hasText: purpose }).getByText('OCR 처리 중', { exact: true })).toBeVisible();
  await logout(page);
  await login(page, 'user2@test.com');
  await expect(page.getByRole('heading', { name: '내 제출 현황' })).toBeVisible();
  await expect(page.locator('.submission-card').filter({ hasText: '문구센터' })).toBeVisible();
  await expect(page.locator('.submission-card').filter({ hasText: purpose })).toHaveCount(0);
  await page.goto('/admin/approvals');
  await expect(page).toHaveURL(/\/dashboard$/);
  await logout(page);
  await login(page, 'admin@test.com');
  await page.getByRole('link', { name: '승인 관리', exact: true }).click();
  const adminRow = page.getByRole('row').filter({ hasText: purpose });
  await adminRow.getByRole('button').click();
  const detail = page.locator('.approval-detail');
  await expect(detail.getByText('김민서', { exact: true })).toBeVisible();
  await expect(detail.getByText('OCR 처리 중', { exact: true })).toBeVisible();
  await expect(detail.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: '이준호' })).toBeVisible();
});

test('OCR_DONE 샘플 관리자 보정 → 승인 → 정산 완료 → 해당 USER 결과 조회', async ({ page }) => {
  await login(page, 'admin@test.com');
  const row = await selectAdmin(page, '카페 그린브릿지');
  const detail = page.locator('.approval-detail');
  await expect(detail.locator('img')).toBeVisible();
  await expect(detail.locator('.receipt-timeline time').first()).toHaveAttribute('datetime', /T/);
  await expect(detail.locator('.receipt-timeline')).not.toContainText('Invalid Date');
  await detail.getByRole('button', { name: 'OCR 수정', exact: true }).click();
  await detail.getByLabel('사용처', { exact: true }).fill('E2E 보정 카페');
  await detail.getByLabel('총 금액 (원)', { exact: true }).fill('18900');
  await detail.getByLabel('수정 사유 (필수)').fill('원본 금액 확인');
  await detail.getByRole('button', { name: 'OCR 수정 저장' }).click();
  await expect(detail.getByText('E2E 보정 카페', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: '승인', exact: true }).click();
  await expect(detail.locator('.status-badge')).toHaveText('승인');
  await detail.getByLabel('정산일', { exact: true }).fill('2026-10-05');
  await detail.getByRole('button', { name: '정산 완료 처리', exact: true }).click();
  await expect(detail.locator('.status-badge')).toHaveText('정산 완료');
  await expect(row).toHaveCount(0); // 사용처가 보정되어 이전 행 텍스트는 사라집니다.
  await logout(page);
  await login(page, 'user1@test.com');
  const userRow = page.locator('.submission-card').filter({ hasText: 'E2E 보정 카페' });
  await expect(userRow.getByText('정산 완료', { exact: true })).toBeVisible();
  await userRow.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('18,900원', { exact: true })).toBeVisible();
  await expect(dialog.getByText('97%', { exact: true })).toBeVisible();
  await expect(dialog.locator('input,textarea')).toHaveCount(0);
});

test('별도 요청 반려 사유 필수 → 반려 저장 → 해당 USER 상세 조회', async ({ page }) => {
  await login(page, 'admin@test.com');
  await selectAdmin(page, '문구센터');
  const detail = page.locator('.approval-detail');
  await detail.getByRole('button', { name: '반려', exact: true }).click();
  await expect(detail.getByRole('button', { name: '반려 처리' })).toBeDisabled();
  await detail.getByLabel('반려 사유 (필수)').fill('E2E 참석자 명단을 첨부해주세요.');
  await detail.getByRole('button', { name: '반려 처리' }).click();
  await expect(detail.locator('.status-badge')).toHaveText('반려');
  await logout(page);
  await login(page, 'user2@test.com');
  const row = page.locator('.submission-card').filter({ hasText: '문구센터' });
  await expect(row.getByText('반려', { exact: true })).toBeVisible();
  await row.click();
  await expect(page.getByRole('dialog').locator('.rejection-note').getByText('E2E 참석자 명단을 첨부해주세요.', { exact: true })).toBeVisible();
});

test('USER 대시보드 4개 요약/5개 필터, 카드 상세 및 모바일 가로 넘침 없음', async ({ page }) => {
  await login(page, 'user1@test.com');
  await expect(page.locator('.dashboard-summary')).toHaveCount(4);
  await expect(page.locator('.filter-tabs button')).toHaveCount(5);
  await expect(page.getByText('영수증 제출부터 정산까지 한눈에 확인하세요.')).toBeVisible();
  await expect(page.getByText('Mock API', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '정산 진행 흐름' })).toHaveCount(0);
  await page.locator('.filter-tabs').getByRole('button', { name: '처리 중', exact: true }).click();
  await expect(page.locator('.submission-card')).toHaveCount(1);
  await expect(page.locator('.submission-card .status-badge')).toHaveText('OCR 완료');
  await page.locator('.filter-tabs').getByRole('button', { name: '전체', exact: true }).click();
  await expect(page.locator('.submission-card')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await expect(page.locator('.submission-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.locator('.submission-card').first().click();
  await expect(page.getByRole('dialog', { name: '영수증 상세' })).toBeVisible();
});

test('모바일 영수증 등록: 필수 입력, 미리보기/삭제/재선택, 취소', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, 'user1@test.com');
  await page.getByRole('link', { name: '+ 영수증 등록' }).click();
  const submitButton = page.getByRole('button', { name: '영수증 제출', exact: true });
  await expect(submitButton).toBeDisabled();
  await expect(page.getByText('Mock 체험', { exact: true })).toHaveCount(0);
  await expect(page.getByText('영수증 사진을 올려주세요', { exact: true })).toBeVisible();
  await expect(page.locator('.receipt-steps [aria-current=step]')).toHaveText('1 이미지 등록');
  await page.locator('#receipt-file').setInputFiles({ name: 'mobile.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('선택한 영수증 미리보기')).toBeVisible();
  await expect(page.getByText('mobile.png', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '이미지 변경', exact: true })).toBeVisible();
  await expect(page.locator('.receipt-steps [aria-current=step]')).toHaveText('2 제출 정보 입력');
  await expect(submitButton).toBeDisabled();
  await page.getByLabel('사용 목적 (필수)').fill('모바일 등록 테스트');
  await expect(submitButton).toBeDisabled();
  await page.getByLabel('카테고리 (필수)').selectOption('1');
  await expect(submitButton).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/upload-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByAltText('선택한 영수증 미리보기')).toHaveCount(0);
  await expect(submitButton).toBeDisabled();
  await page.locator('#receipt-file').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
  await expect(submitButton).toBeEnabled();
  await page.getByRole('link', { name: '취소', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.submission-card').filter({ hasText: '모바일 등록 테스트' })).toHaveCount(0);
});

test('USER 상세 Modal: 표시 전용 영수증, 실제 타임라인, 반려 영역과 닫기', async ({ page }) => {
  await login(page, 'user1@test.com');
  await page.locator('.submission-card').filter({ hasText: '카페 그린브릿지' }).click();
  const dialog = page.getByRole('dialog', { name: '영수증 상세' });
  await expect(dialog.getByRole('heading', { name: '제출 정보' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'OCR 결과' })).toBeVisible();
  await expect(dialog.locator('.rejection-note')).toHaveCount(0);
  await expect(dialog.locator('.receipt-timeline li')).toHaveCount(1);
  const source = await dialog.locator('img').getAttribute('src');
  expect(decodeURIComponent(source)).not.toMatch(/SAMPLE RECEIPT|Mock|실제 원본이 아닙니다/);
  await expect(dialog.locator('input,textarea')).toHaveCount(0);
  const detailHeader = dialog.locator('.receipt-detail-dialog-header');
  const detailBody = dialog.locator('.receipt-detail-dialog-body');
  await expect.poll(() => detailHeader.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
  await expect.poll(() => detailBody.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  await detailHeader.locator('h2').click();
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'test-results/detail-desktop.png', fullPage: true });
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await page.locator('.submission-card').filter({ hasText: '카페 그린브릿지' }).click();
  await expect(page.getByRole('dialog', { name: '영수증 상세' })).toBeVisible();
  await page.getByRole('button', { name: '영수증 상세 닫기' }).click();
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('.submission-card').filter({ hasText: '그린마트' }).click();
  await expect(dialog.locator('.rejection-note')).toBeVisible();
  await expect(dialog.locator('.rejection-note')).toContainText('참석자 명단을 보완해주세요.');
  await page.screenshot({ path: 'test-results/detail-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('전체 서비스 모바일 반응형과 관리자 필터/상세 표시', async ({ page }) => {
  async function noOverflow() {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');
  await expect(page.getByText(/MOCK DEMO|Mock 계정|체험 계정/)).toHaveCount(0);
  await noOverflow();
  await login(page, 'user1@test.com');
  await noOverflow();
  await page.locator('.submission-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate((el) => el.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '영수증 상세 닫기' }).click();
  await page.getByRole('link', { name: '+ 영수증 등록' }).click();
  await noOverflow();
  await logout(page);
  await login(page, 'admin@test.com');
  await expect(page.locator('.summary-card')).toHaveCount(6);
  await noOverflow();
  await page.getByRole('link', { name: '승인 관리 →', exact: true }).click();
  await expect(page.locator('.filter-tabs button')).toHaveCount(5);
  await page.locator('.filter-tabs').getByRole('button', { name: '검토 필요', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '카페 그린브릿지' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '모임공간' })).toHaveCount(0);
  await expect(page.locator('.approval-detail').getByRole('heading', { name: '제출 정보' })).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/admin-mobile-final.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await noOverflow();
  await page.screenshot({ path: 'test-results/admin-desktop-final.png', fullPage: true });
  await page.locator('.filter-tabs').getByRole('button', { name: '정산 완료', exact: true }).click();
  await expect(page.locator('.approval-detail .status-badge')).toHaveText('정산 완료');
  await expect(page.locator('.approval-detail').getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
  await expect(page.locator('.approval-detail').getByRole('button', { name: '반려', exact: true })).toHaveCount(0);
  await expect(page.locator('.approval-detail').getByRole('button', { name: '정산 완료 처리', exact: true })).toHaveCount(0);
});
