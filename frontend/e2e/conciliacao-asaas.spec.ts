import { test, expect } from '@playwright/test';

const ADMIN_USER = {
  accessToken: 'fake-jwt-token',
  user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
};

const RECONCILIATION = {
  configured: true,
  truncated: false,
  period: { startDate: '2026-06-01T00:00:00', endDate: '2026-06-30T23:59:59' },
  items: [
    {
      paymentId: 'p1', asaasPaymentId: 'ch_ok', clientId: 'c1', method: 'PIX', billingType: 'PIX',
      paidAt: '2026-06-06T10:00:00', businessDate: '2026-06-06', localStatus: 'RECEIVED',
      appAmountCentavos: 4000, asaasStatus: 'RECEIVED', asaasValueCentavos: 4000,
      asaasNetCentavos: 3801, feeCentavos: 199, divergent: false, error: false, status: 'OK_COM_TAXA',
    },
    {
      paymentId: 'p2', asaasPaymentId: 'ch_div', clientId: 'c2', method: 'CARD', billingType: 'CREDIT_CARD',
      paidAt: '2026-06-07T10:00:00', businessDate: '2026-06-07', localStatus: 'CONFIRMED',
      appAmountCentavos: 3000, asaasStatus: 'CONFIRMED', asaasValueCentavos: 2500,
      asaasNetCentavos: 2400, feeCentavos: 100, divergent: true, error: false, status: 'VALOR_DIVERGENTE',
    },
  ],
  summary: {
    count: 2, okCount: 1, divergentCount: 1, refundedCount: 0, pendingNetCount: 0, errorCount: 0,
    totalAppAmountCentavos: 7000, totalAsaasValueCentavos: 6500, totalAsaasNetCentavos: 6201, totalFeeCentavos: 299,
  },
};

test.describe('Conciliação Asaas (admin-only)', () => {
  test('admin vê a tela e os dados conciliados ao gerar', async ({ page }) => {
    await page.addInitScript((auth) => {
      localStorage.setItem('accessToken', auth.accessToken);
      localStorage.setItem('user', JSON.stringify(auth.user));
    }, ADMIN_USER);

    // catch-all primeiro; depois a rota específica (Playwright usa a última registrada)
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/reports/asaas-reconciliation**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RECONCILIATION) }));

    await page.goto('/conciliacao-asaas');
    await expect(page).toHaveURL(/\/conciliacao-asaas/);
    await expect(page.getByRole('heading', { name: 'Conciliação Asaas' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Gerar' }).click();

    // tiles + linhas conciliadas (cell scope evita casar com o texto da descrição)
    await expect(page.getByText('Líquido recebido (Asaas)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: 'OK · taxa', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Divergente', exact: true })).toBeVisible();
    // a coluna "Asaas (bruto)" diverge do app na linha marcada
    await expect(page.getByRole('cell', { name: 'R$ 25,00', exact: true })).toBeVisible();
  });

  test('exige PIN (mesma senha das Comissões) e libera ao desbloquear', async ({ page }) => {
    await page.addInitScript((auth) => {
      localStorage.setItem('accessToken', auth.accessToken);
      localStorage.setItem('user', JSON.stringify(auth.user));
    }, ADMIN_USER);

    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    // PIN configurado → o PinGate bloqueia a página
    await page.route('**/api/settings', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasCommissionPin: true }) }));
    await page.route('**/api/settings/verify-commission-pin', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true }) }));
    await page.route('**/api/reports/asaas-reconciliation**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RECONCILIATION) }));

    await page.goto('/conciliacao-asaas');

    // Gate ativo: mostra "Acesso Restrito" e esconde o conteúdo da tela.
    await expect(page.getByText('Acesso Restrito')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Conciliação Asaas' })).toBeHidden();

    // Desbloqueia com o PIN → conteúdo aparece.
    await page.getByPlaceholder('Digite o PIN').fill('1234');
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByRole('heading', { name: 'Conciliação Asaas' })).toBeVisible({ timeout: 10000 });
  });

  test('PROFESSIONAL é redirecionado para /acesso-negado', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'fake-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'prof-1', email: 'prof@test.com', name: 'Professional', role: 'PROFESSIONAL',
      }));
    });
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/conciliacao-asaas');
    await expect(page).toHaveURL(/\/acesso-negado/, { timeout: 10000 });
  });
});
