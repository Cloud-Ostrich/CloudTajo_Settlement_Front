import { test, expect } from '@playwright/test';
const real = process.env.VITE_API_MODE === 'real';
for (const reducedMotion of ['reduce', 'no-preference']) test(`관리자 상세: 렌더링 후 이동 및 재선택 (${reducedMotion})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion });
  const receipts = Array.from({ length: 12 }, (_, i) => ({ id: 101 + i, receiptId: 101 + i, status: 'OCR_DONE', merchantName: `상호 ${i}`, paidAt: '2026-10-11', amount: 5000, purpose: '스크롤 검증', categoryName: '식비', submittedAt: '2026-10-11' }));
  let release;
  if (real) await page.route('http://127.0.0.1:5181/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path.endsWith('/auth/login')) data = { accessToken: 'fake-test-token', user: { id: 3, role: 'ADMIN', name: '관리자' } };
    else if (path.endsWith('/dashboard/summary')) data = { categorySummaries: [] };
    else if (path === '/api/admin/receipts') data = { items: receipts };
    else if (path.endsWith('/histories')) data = [];
    else if (/\/receipts\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop());
      if (id === 102) await new Promise(resolve => { release = resolve; });
      data = receipts.find(r => r.id === id);
    } else return route.fulfill({ status: 404, json: { success: false } });
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/');
  await page.getByLabel('이메일', { exact: true }).fill('admin@test.com');
  await page.getByLabel('비밀번호', { exact: true }).fill(real ? 'fake-password' : '1234');
  await page.getByRole('button', { name: '로그인 →', exact: true }).click();
  if (!real) await page.evaluate(async receipts => {
    const store = await import('/src/api/mockStore.js');
    const original = store.readReceipts().find(r => r.receiptId === 101);
    store.writeReceipts(receipts.map(r => ({ ...original, ...r, history: [] })));
  }, receipts);
  await page.getByRole('link', { name: '승인 관리 →', exact: true }).click();
  await expect(page.getByRole('heading', { name: '제출 상세 #101', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.__scrolls = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) { window.__scrolls.push(options); original.call(this, options); };
  });
  await page.locator('.request-select').nth(1).click();
  if (real) {
    await expect(page.getByText('상세 정보를 불러오는 중…')).toBeVisible();
    expect(await page.evaluate(() => window.__scrolls.length)).toBe(0);
    await expect.poll(() => Boolean(release)).toBe(true);
    release();
  }
  await expect(page.getByRole('heading', { name: '제출 상세 #102', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__scrolls.length)).toBe(1);
  expect(await page.evaluate(() => window.__scrolls[0].behavior)).toBe(reducedMotion === 'reduce' ? 'instant' : 'smooth');
  await expect.poll(() => page.locator('.admin-detail-target').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(24);
  // A selected, loaded receipt should still navigate after returning to the list.
  await page.locator('.request-select').nth(1).click();
  await expect.poll(() => page.evaluate(() => window.__scrolls.length)).toBe(2);
  await expect.poll(() => page.locator('.admin-detail-target').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(24);
  // Clicking while the heading is already visible should not move the viewport.
  await page.locator('.request-select').nth(1).evaluate(el => el.click());
  expect(await page.evaluate(() => window.__scrolls.length)).toBe(2);
});
