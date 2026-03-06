import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page.getByText('Painel Administrativo')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Email é obrigatório')).toBeVisible();
    await expect(page.getByText('Senha é obrigatória')).toBeVisible();
  });

  test('should show error for short password', async ({ page }) => {
    await page.fill('#email', 'test@test.com');
    await page.fill('#password', '123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Senha deve ter no mínimo 6 caracteres')).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.locator('#password ~ button').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('should show error message on wrong credentials', async ({ page }) => {
    await page.fill('#email', 'wrong@test.com');
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciais inválidas')).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state while submitting', async ({ page }) => {
    await page.fill('#email', 'test@test.com');
    await page.fill('#password', '123456');
    await page.route('**/auth/login', async (route) => {
      await new Promise(r => setTimeout(r, 1000));
      await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) });
    });
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Entrando...')).toBeVisible();
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    // Mock the login API
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'fake-jwt-token',
          user: { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
        }),
      });
    });
    // Mock ALL API calls after login to prevent dashboard crashes
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/auth/')) return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.fill('#email', 'admin@test.com');
    await page.fill('#password', 'password123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});
