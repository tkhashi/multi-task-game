import { expect, test } from '@playwright/test';

test('タイトル画面プレースホルダーが表示される', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: '育児マルチタスクゲーム' }),
  ).toBeVisible();
  await expect(page.getByText('タイトル画面プレースホルダー')).toBeVisible();
});
