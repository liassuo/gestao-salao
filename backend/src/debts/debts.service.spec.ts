/**
 * Regressão do espelho local do pagamento de dívida via PIX.
 *
 * Caso Paulo Sergio (16/07/2026): o insert do payment DEBT_PAYMENT ia SEM
 * registeredBy (NOT NULL na tabela) e o erro não era checado — falhava em
 * silêncio desde 03/2026. Sem o espelho, o webhook não achava o pagamento e
 * a dívida ficava aberta com a assinatura suspensa mesmo com o PIX pago.
 *
 * Estes testes garantem que createPixChargeForDebts:
 *  - grava o espelho com registeredBy (registrante-sistema) e notes='DEBT_PAYMENT';
 *  - se o espelho falhar mesmo assim, loga e NÃO aborta (o cliente precisa do
 *    QR Code; o fallback do webhook recria o espelho na confirmação).
 */
import { DebtsService } from './debts.service';

type Row = Record<string, any>;

function makeSupabase(opts: {
  debts: Row[];
  client: Row;
  admin: Row | null;
  paymentInsertError?: { message: string } | null;
}) {
  const inserted: { payments: Row[] } = { payments: [] };
  const from = (table: string) => {
    const chain: any = {
      _filters: [] as any[],
      select: () => chain,
      eq: () => chain,
      limit: () => chain,
      single: async () => {
        if (table === 'clients') return { data: opts.client, error: null };
        return { data: null, error: { message: 'not found' } };
      },
      maybeSingle: async () => {
        if (table === 'users') return { data: opts.admin, error: null };
        return { data: null, error: null };
      },
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
      insert: async (row: Row) => {
        if (table === 'payments') {
          if (opts.paymentInsertError) return { data: null, error: opts.paymentInsertError };
          inserted.payments.push(row);
          return { data: row, error: null };
        }
        return { data: row, error: null };
      },
      then: (resolve: any) => {
        if (table === 'debts') return Promise.resolve({ data: opts.debts, error: null }).then(resolve);
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return chain;
  };
  return { supabase: { from }, inserted };
}

const asaasMock = {
  configured: true,
  createCharge: jest.fn().mockResolvedValue({ id: 'asaas_charge_1', status: 'PENDING' }),
  createCustomer: jest.fn(),
  centavosToReais: (v: number) => v / 100,
  getPixQrCode: jest.fn().mockResolvedValue({
    encodedImage: 'img',
    payload: 'copia-e-cola',
    expirationDate: '2026-07-17',
  }),
};

describe('DebtsService — createPixChargeForDebts (espelho DEBT_PAYMENT)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria o espelho com registeredBy do admin-sistema e notes=DEBT_PAYMENT', async () => {
    const { supabase, inserted } = makeSupabase({
      debts: [{ remainingBalance: 14000 }],
      client: { id: 'client-1', name: 'Paulo', email: null, phone: null, asaasCustomerId: 'cus_1' },
      admin: { id: 'admin-1' },
    });
    const service = new DebtsService(supabase as any, asaasMock as any);

    const result = await service.createPixChargeForDebts('client-1');

    expect(result.totalAmount).toBe(14000);
    expect(result.pixData?.payload).toBe('copia-e-cola');
    expect(inserted.payments).toHaveLength(1);
    expect(inserted.payments[0].registeredBy).toBe('admin-1');
    expect(inserted.payments[0].notes).toBe('DEBT_PAYMENT');
    expect(inserted.payments[0].asaasPaymentId).toBe('asaas_charge_1');
    expect(inserted.payments[0].clientId).toBe('client-1');
    expect(inserted.payments[0].amount).toBe(14000);
  });

  it('se o insert do espelho falhar, loga e ainda devolve o QR Code (webhook fallback cobre)', async () => {
    const { supabase } = makeSupabase({
      debts: [{ remainingBalance: 14000 }],
      client: { id: 'client-1', name: 'Paulo', email: null, phone: null, asaasCustomerId: 'cus_1' },
      admin: { id: 'admin-1' },
      paymentInsertError: { message: 'null value in column registeredBy' },
    });
    const service = new DebtsService(supabase as any, asaasMock as any);
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    const result = await service.createPixChargeForDebts('client-1');

    expect(result.totalAmount).toBe(14000);
    expect(result.pixData?.payload).toBe('copia-e-cola');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('espelho DEBT_PAYMENT'));
  });
});
