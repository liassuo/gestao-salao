import { test, expect } from '@playwright/test';

test.describe('Client Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cliente/login');
  });

  test('should display client login page correctly', async ({ page }) => {
    await expect(page.locator('text=Portal do Cliente')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.locator('text=ou continue com email')).toBeVisible();
  });

  test('should show error when submitting empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Preencha todos os campos')).toBeVisible();
  });

  test('should show error on wrong credentials', async ({ page }) => {
    await page.fill('#email', 'wrong@test.com');
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Email ou senha incorretos')).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state while submitting', async ({ page }) => {
    await page.fill('#email', 'test@test.com');
    await page.fill('#password', '123456');
    await page.route('**/auth/client/login', async (route) => {
      await new Promise(r => setTimeout(r, 1000));
      await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) });
    });
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Entrando...')).toBeVisible();
  });

  test('should redirect to client home on successful login', async ({ page }) => {
    await page.route('**/auth/client/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'fake-jwt-token',
          user: { id: 'client-1', email: 'client@test.com', name: 'Cliente', role: 'CLIENT' },
        }),
      });
    });
    // Mock client home API calls
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/auth/')) return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.fill('#email', 'client@test.com');
    await page.fill('#password', 'password123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/cliente/, { timeout: 10000 });
  });
});
