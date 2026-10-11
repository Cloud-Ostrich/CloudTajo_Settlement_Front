import { test, expect, chromium, webkit } from '@playwright/test';

test.skip(process.env.VITE_API_MODE === 'real', '로컬 Mock 데이터만 사용합니다.');

for (const browserName of ['chromium', 'webkit']) {
  for (const width of [375, 390, 430, 1280]) {
    test.describe(`${browserName} ${width}px 상세 모달`, () => {
      test('본문 높이·하단 스크롤·뷰포트 변경·닫기', async () => {
        const browser = await ({ chromium, webkit })[browserName].launch();
        const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5181', viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700 });
        const page = await context.newPage();
        try {
          await page.goto('/');
          await page.getByLabel('이메일', { exact: true }).fill('user1@test.com');
          await page.getByLabel('비밀번호', { exact: true }).fill('1234');
          await page.getByRole('button', { name: '로그인 →', exact: true }).click();
          await page.locator('.submission-card').filter({ hasText: '그린마트' }).click();
          const dialog = page.getByRole('dialog', { name: '영수증 상세', exact: true });
          const body = dialog.locator('.receipt-detail-dialog-body');
          await expect(body.getByRole('heading', { name: '제출 정보', exact: true })).toBeVisible();
          await expect(body.locator('.receipt-timeline')).toContainText('반려');
          const bounds = await body.boundingBox();
          expect(bounds.height).toBeGreaterThan(200);
          await expect(body.getByRole('region', { name: '영수증 처리 단계' })).toBeInViewport();
          for (const height of [844, 660]) {
            await page.setViewportSize({ width, height });
            const dimensions = await body.evaluate((element) => ({ client: element.clientHeight, scroll: element.scrollHeight, width: element.scrollWidth, clientWidth: element.clientWidth }));
            expect(dimensions.client).toBeGreaterThan(200);
            expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
            expect(dimensions.width).toBeLessThanOrEqual(dimensions.clientWidth);
            await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
            await expect(body.locator('.receipt-timeline li').last()).toBeInViewport();
            await expect(dialog.getByRole('button', { name: '영수증 상세 닫기' })).toBeInViewport();
            const box = await dialog.boundingBox();
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.y + box.height).toBeLessThanOrEqual(height);
          }
          await page.screenshot({ path: `test-results/detail-${browserName}-${width}.png` });
          await dialog.getByRole('button', { name: '영수증 상세 닫기' }).click();
          await expect(dialog).toHaveCount(0);
        } finally { await browser.close(); }
      });
    });
  }
}
