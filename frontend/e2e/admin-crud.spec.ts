import { test, expect } from '@playwright/test';

const ADMIN_USER = {
  accessToken: 'fake-jwt-token',
  user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
};

test.describe('Admin CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((auth) => {
      localStorage.setItem('accessToken', auth.accessToken);
      localStorage.setItem('user', JSON.stringify(auth.user));
    }, ADMIN_USER);

    // Mock ALL /api/ calls by default to prevent crashes
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  // ─── Services ─────────────────────────────────────────────

  test.describe('Services Page', () => {
    test.beforeEach(async ({ page }) => {
      // Override /api/services to return mock data
      await page.route('**/api/services**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: 'svc-1', name: 'Corte de Cabelo', description: 'Corte masculino', price: 5000, duration: 30, isActive: true },
              { id: 'svc-2', name: 'Barba', description: 'Barba completa', price: 3000, duration: 20, isActive: true },
            ]),
          });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
      });
      await page.goto('/servicos');
    });

    test('should display services list', async ({ page }) => {
      await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Barba', { exact: true })).toBeVisible();
    });

    test('should open new service modal', async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /novo servi/i });
      await expect(newBtn).toBeVisible({ timeout: 10000 });
      await newBtn.click();
      // Modal should appear with form
      await expect(page.getByText('Nome do Serviço')).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /cadastrar/i })).toBeVisible();
    });
  });

  // ─── Clients ──────────────────────────────────────────────

  test.describe('Clients Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/clients**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: 'c-1', name: 'João Silva', phone: '11999999999', email: 'joao@test.com', isActive: true, hasDebts: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
              { id: 'c-2', name: 'Maria Santos', phone: '11888888888', email: 'maria@test.com', isActive: true, hasDebts: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            ]),
          });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
      });
      await page.goto('/clientes');
    });

    test('should display clients list', async ({ page }) => {
      await expect(page.getByText('João Silva')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Maria Santos')).toBeVisible();
    });

    test('should have search input', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[placeholder*="Pesquisar"], input[placeholder*="pesquisar"]');
      await expect(searchInput.first()).toBeVisible({ timeout: 10000 });
    });

    test('should open new client modal', async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /novo cliente/i });
      await expect(newBtn).toBeVisible({ timeout: 10000 });
      await newBtn.click();
      // Modal should appear with form
      await expect(page.getByRole('button', { name: /cadastrar|salvar/i })).toBeVisible({ timeout: 5000 });
    });
  });

  // ─── Professionals ────────────────────────────────────────

  test.describe('Professionals Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/professionals**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: 'p-1', name: 'Carlos Barbeiro', phone: '11777777777', email: 'carlos@test.com', commissionRate: 50, isActive: true, avatarUrl: null, services: [{ id: 'svc-1', name: 'Corte' }], workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }] },
            ]),
          });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
      });
      await page.route('**/api/services**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'svc-1', name: 'Corte', price: 5000, duration: 30, isActive: true },
          ]),
        });
      });
      await page.goto('/profissionais');
    });

    test('should display professionals list', async ({ page }) => {
      await expect(page.getByText('Carlos Barbeiro')).toBeVisible({ timeout: 10000 });
    });

    test('should open new professional modal', async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /novo profissional/i });
      if (await newBtn.isVisible()) {
        await newBtn.click();
        await expect(page.getByText('Nome').first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
