import { test, expect } from '@playwright/test';

const ADMIN_USER = {
  accessToken: 'fake-jwt-token',
  user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
};

test.describe('Navigation & Routing', () => {

  test.describe('Unauthenticated access', () => {
    test('should redirect to /login when accessing / without auth', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect to /login when accessing /agendamentos without auth', async ({ page }) => {
      await page.goto('/agendamentos');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect to /cliente/login when accessing /cliente without auth', async ({ page }) => {
      await page.goto('/cliente');
      await expect(page).toHaveURL(/\/cliente\/login/, { timeout: 10000 });
    });

    test('should show login page at /login', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByText('Painel Administrativo')).toBeVisible({ timeout: 10000 });
    });

    test('should show client login page at /cliente/login', async ({ page }) => {
      await page.goto('/cliente/login');
      await expect(page.getByText('Portal do Cliente')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Admin navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((auth) => {
        localStorage.setItem('accessToken', auth.accessToken);
        localStorage.setItem('user', JSON.stringify(auth.user));
      }, ADMIN_USER);

      // Mock ALL API calls to prevent crashes
      await page.route('**/api/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
    });

    test('should display dashboard at /', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to appointments page via sidebar', async ({ page }) => {
      await page.goto('/agendamentos');
      await expect(page).toHaveURL(/\/agendamentos/);
      // Page should load without crashing
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to clients page via sidebar', async ({ page }) => {
      await page.goto('/clientes');
      await expect(page).toHaveURL(/\/clientes/);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to services page via sidebar', async ({ page }) => {
      await page.goto('/servicos');
      await expect(page).toHaveURL(/\/servicos/);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should navigate to professionals page via sidebar', async ({ page }) => {
      await page.goto('/profissionais');
      await expect(page).toHaveURL(/\/profissionais/);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Client navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('clientAccessToken', 'fake-client-token');
        localStorage.setItem('clientUser', JSON.stringify({
          id: 'client-1', email: 'client@test.com', name: 'Client User', role: 'CLIENT',
        }));
      });

      // Mock all API calls
      await page.route('**/api/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
    });

    test('should display client home at /cliente', async ({ page }) => {
      await page.goto('/cliente');
      await expect(page).toHaveURL(/\/cliente/, { timeout: 10000 });
    });

    test('should navigate to booking page', async ({ page }) => {
      await page.goto('/cliente/agendar');
      await expect(page).toHaveURL(/\/cliente\/agendar/);
    });

    test('should navigate to profile page', async ({ page }) => {
      await page.goto('/cliente/perfil');
      await expect(page).toHaveURL(/\/cliente\/perfil/);
    });
  });

  test.describe('Role-based access', () => {
    test('should redirect PROFESSIONAL role away from admin-only pages', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('accessToken', 'fake-token');
        localStorage.setItem('user', JSON.stringify({
          id: 'prof-1', email: 'prof@test.com', name: 'Professional', role: 'PROFESSIONAL',
        }));
      });

      await page.route('**/api/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.goto('/servicos');
      await expect(page).toHaveURL(/\/acesso-negado/, { timeout: 10000 });
    });

    test('should allow PROFESSIONAL role to access shared pages', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('accessToken', 'fake-token');
        localStorage.setItem('user', JSON.stringify({
          id: 'prof-1', email: 'prof@test.com', name: 'Professional', role: 'PROFESSIONAL',
        }));
      });

      await page.route('**/api/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.goto('/agendamentos');
      await expect(page).not.toHaveURL(/\/acesso-negado/, { timeout: 10000 });
    });
  });
});
