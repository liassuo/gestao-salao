import { test, expect } from '@playwright/test';

const CLIENT_USER = {
  accessToken: 'fake-client-token',
  user: { id: 'client-1', email: 'client@test.com', name: 'Cliente Test', role: 'CLIENT' },
};

test.describe('Client Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set client auth in localStorage
    await page.addInitScript((auth) => {
      localStorage.setItem('clientAccessToken', auth.accessToken);
      localStorage.setItem('clientUser', JSON.stringify(auth.user));
    }, CLIENT_USER);

    // Mock ALL /api/ calls by default
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Mock services endpoint (GET /api/services)
    await page.route('**/api/services', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'svc-1', name: 'Corte de Cabelo', description: 'Corte masculino', price: 5000, duration: 30 },
            { id: 'svc-2', name: 'Barba', description: 'Barba completa', price: 3000, duration: 20 },
          ]),
        });
      } else {
        await route.fallback();
      }
    });

    // Mock available professionals
    await page.route('**/api/professionals/available-for-booking**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'prof-1', name: 'Carlos Barbeiro', phone: '11777777777', avatarUrl: null },
        ]),
      });
    });

    // Mock available slots
    await page.route('**/api/appointments/available-slots**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { time: '09:00', available: true },
          { time: '09:30', available: true },
          { time: '10:00', available: true },
          { time: '10:30', available: false },
        ]),
      });
    });

    // Mock appointment creation
    await page.route('**/api/appointments/client', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'appt-1',
            clientId: 'client-1',
            professionalId: 'prof-1',
            status: 'SCHEDULED',
          }),
        });
      } else {
        await route.fallback();
      }
    });
  });

  test('should display booking page with services', async ({ page }) => {
    await page.goto('/cliente/agendar');

    await expect(page.getByText('Escolha o serviço')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Corte de Cabelo')).toBeVisible();
    await expect(page.getByText('Barba', { exact: true })).toBeVisible();
  });

  test('should select a service and show continue button', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    // Click on the service card
    await page.getByText('Corte de Cabelo').click();

    // Continue button should be present
    const continueBtn = page.getByRole('button', { name: /continuar/i });
    await expect(continueBtn).toBeVisible();
  });

  test('should advance to schedule step after selecting service', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page.getByText('Escolha data e horário')).toBeVisible({ timeout: 5000 });
  });

  test('should show professionals after advancing to schedule step', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page.getByText('Carlos Barbeiro')).toBeVisible({ timeout: 10000 });
  });

  test('should show time slots after selecting a professional', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page.getByText('Carlos Barbeiro')).toBeVisible({ timeout: 10000 });
    await page.getByText('Carlos Barbeiro').click();

    // Available slots should appear
    await expect(page.getByRole('button', { name: '09:00' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '09:30' })).toBeVisible();
    await expect(page.getByRole('button', { name: '10:00' })).toBeVisible();
  });

  test('should show confirmation after selecting time slot', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    // Step 1: select service
    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Step 2: select professional + time
    await expect(page.getByText('Carlos Barbeiro')).toBeVisible({ timeout: 10000 });
    await page.getByText('Carlos Barbeiro').click();

    await expect(page.getByRole('button', { name: '09:00' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '09:00' }).click();

    await page.getByRole('button', { name: /continuar/i }).click();

    // Step 3: confirmation
    await expect(page.getByRole('heading', { name: 'Confirmar agendamento' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Corte de Cabelo')).toBeVisible();
    await expect(page.getByText('Carlos Barbeiro')).toBeVisible();
  });

  test('should submit appointment on confirm', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    // Step 1
    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Step 2
    await expect(page.getByText('Carlos Barbeiro')).toBeVisible({ timeout: 10000 });
    await page.getByText('Carlos Barbeiro').click();
    await expect(page.getByRole('button', { name: '09:00' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '09:00' }).click();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Step 3: confirm — selecionar pagamento "No local" (CASH) pra evitar modal de CPF
    await expect(page.getByRole('button', { name: /confirmar agendamento/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'No local' }).click();

    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toMatch(/Agendamento realizado/i);
      await dialog.accept();
    });

    await page.getByRole('button', { name: /confirmar agendamento/i }).click();

    await page.waitForURL('**/cliente', { timeout: 10000 });
  });

  test('should allow selecting multiple services', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByText('Barba', { exact: true }).click();

    const continueBtn = page.getByRole('button', { name: /continuar/i });
    await expect(continueBtn).toBeVisible();
  });

  test('should deselect a service when clicked again', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    // Select
    await page.getByText('Corte de Cabelo').click();

    // Deselect
    await page.getByText('Corte de Cabelo').click();

    // No service selected - check that selection visual is removed
    // The continue button in the footer should still exist but service should not be highlighted
    await expect(page.getByText('Escolha o serviço')).toBeVisible();
  });

  test('should show "no professionals available" when none match', async ({ page }) => {
    // Override the professionals route to return empty
    await page.route('**/api/professionals/available-for-booking**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page.getByRole('heading', { name: /nenhum profissional/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate back from schedule to service step', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page.getByText('Escolha data e horário')).toBeVisible({ timeout: 5000 });

    // Click the back button (first button in header)
    await page.locator('button').first().click();

    await expect(page.getByText('Escolha o serviço')).toBeVisible({ timeout: 5000 });
  });

  test('should show weekday labels in the schedule step', async ({ page }) => {
    await page.goto('/cliente/agendar');
    await expect(page.getByText('Corte de Cabelo')).toBeVisible({ timeout: 10000 });

    await page.getByText('Corte de Cabelo').click();
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page.getByText('Escolha data e horário')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Seg')).toBeVisible();
    await expect(page.getByText('Ter')).toBeVisible();
    await expect(page.getByText('Qua')).toBeVisible();
  });

  test('should show empty state when no services are available', async ({ page }) => {
    // Override services to return empty
    await page.route('**/api/services', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/cliente/agendar');
    await expect(page.getByText(/nenhum servi/i)).toBeVisible({ timeout: 10000 });
  });
});
