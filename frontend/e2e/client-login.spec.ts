import { test, expect } from '@playwright/test';

// Helper: fill email and proceed to password step
async function goToPasswordStep(page: any, email: string) {
  await page.route('**/auth/client/check-email', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'login', name: 'Test User' }),
    });
  });

  await page.fill('#email', email);
  await page.locator('#email').press('Enter');
  await expect(page.locator('#password')).toBeVisible({ timeout: 5000 });
}

test.describe('Client Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cliente/login');
  });

  test('should display client login page correctly', async ({ page }) => {
    await expect(page.locator('text=Portal do Cliente')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('should show error when submitting empty fields', async ({ page }) => {
    // Submit empty email via Enter key (button is disabled when empty)
    await page.locator('#email').press('Enter');
    await expect(page.locator('text=Digite seu email')).toBeVisible();
  });

  test('should show error on wrong credentials', async ({ page }) => {
    await goToPasswordStep(page, 'wrong@test.com');

    await page.route('**/auth/client/login', async (route: any) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthorized' }) });
    });

    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Senha incorreta. Tente novamente.')).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state while submitting', async ({ page }) => {
    await goToPasswordStep(page, 'test@test.com');

    await page.route('**/auth/client/login', async (route: any) => {
      await new Promise(r => setTimeout(r, 1000));
      await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) });
    });

    await page.fill('#password', '123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Entrando...')).toBeVisible();
  });

  test('should redirect to client home on successful login', async ({ page }) => {
    await goToPasswordStep(page, 'client@test.com');

    await page.route('**/auth/client/login', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'fake-jwt-token',
          user: { id: 'client-1', email: 'client@test.com', name: 'Cliente', role: 'CLIENT' },
        }),
      });
    });
    await page.route('**/api/**', async (route: any) => {
      if (route.request().url().includes('/auth/')) return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.fill('#password', 'password123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/cliente/, { timeout: 10000 });
  });
});
