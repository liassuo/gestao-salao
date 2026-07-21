import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionalDebtsService } from './professional-debts.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Mock STATEFUL de professional_debts no estilo PostgREST.
 *
 * IMPORTANTE (nota que vale para todos os specs): o mock devolve CÓPIA das
 * linhas — o PostgREST não devolve referência. Sem isso, um UPDATE editaria
 * retroativamente objetos já lidos e mascararia bugs de leitura-após-escrita.
 */
type Row = Record<string, any>;

function makeStatefulDb(initial: Row[]) {
  const tables: Record<string, Row[]> = { professional_debts: initial.map((r) => ({ ...r })) };

  const likeToRegex = (pattern: string) =>
    new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$');

  function builder(table: string) {
    const rows = () => (tables[table] = tables[table] || []);
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select';
    let patch: Row | null = null;
    let inserted: Row | null = null;
    let orderBy: { col: string; asc: boolean } | null = null;

    const matches = (r: Row) => filters.every((f) => f(r));
    const resolve = () => {
      if (op === 'insert') {
        rows().push({ ...inserted });
        return { data: [{ ...inserted }], error: null };
      }
      if (op === 'update') {
        for (const r of rows()) if (matches(r)) Object.assign(r, patch);
        return { data: rows().filter(matches).map((r) => ({ ...r })), error: null };
      }
      if (op === 'delete') {
        tables[table] = rows().filter((r) => !matches(r));
        return { data: null, error: null };
      }
      let out = rows().filter(matches).map((r) => ({ ...r }));
      if (orderBy) {
        const { col, asc } = orderBy;
        out = out.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1));
      }
      return { data: out, error: null };
    };

    const b: any = {
      select: () => b,
      insert: (row: Row) => ((op = 'insert'), (inserted = row), b),
      update: (p: Row) => ((op = 'update'), (patch = p), b),
      delete: () => ((op = 'delete'), b),
      eq: (col: string, val: any) => (filters.push((r) => r[col] === val), b),
      in: (col: string, vals: any[]) => (filters.push((r) => vals.includes(r[col])), b),
      is: (col: string, val: any) => (filters.push((r) => (val === null ? r[col] == null : r[col] === val)), b),
      like: (col: string, pattern: string) => {
        const re = likeToRegex(pattern);
        filters.push((r) => typeof r[col] === 'string' && re.test(r[col]));
        return b;
      },
      order: (col: string, opts?: { ascending?: boolean }) => ((orderBy = { col, asc: opts?.ascending !== false }), b),
      single: async () => {
        const { data } = resolve() as any;
        const first = (data || [])[0] || null;
        return { data: first, error: first ? null : { message: 'not found' } };
      },
      maybeSingle: async () => {
        const { data } = resolve() as any;
        return { data: (data || [])[0] || null, error: null };
      },
      then: (onOk: any, onErr: any) => Promise.resolve(resolve()).then(onOk, onErr),
    };
    return b;
  }

  return {
    from: (table: string) => builder(table),
    rows: (table = 'professional_debts') => tables[table],
    find: (id: string, table = 'professional_debts') => tables[table].find((r) => r.id === id),
  };
}

describe('ProfessionalDebtsService — dedução e estorno idempotentes', () => {
  let service: ProfessionalDebtsService;
  let db: ReturnType<typeof makeStatefulDb>;

  const build = async (rowsInit: Row[]) => {
    db = makeStatefulDb(rowsInit);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalDebtsService,
        { provide: SupabaseService, useValue: db },
      ],
    }).compile();
    service = module.get(ProfessionalDebtsService);
  };

  const debt = (over: Row): Row => ({
    id: 'debt-1',
    professionalId: 'prof-A',
    orderId: null,
    parentDebtId: null,
    amount: 100000,
    amountPaid: 0,
    remainingBalance: 100000,
    description: 'Vale',
    status: 'PENDING',
    deductedFromCommissionId: null,
    settledAt: null,
    createdAt: '2026-07-01T10:00:00',
    updatedAt: '2026-07-01T10:00:00',
    ...over,
  });

  it('quitação TOTAL grava ledger com parentDebtId e o valor exato coberto', async () => {
    await build([debt({})]);

    const deducted = await service.applyDeductionToCommission({
      professionalId: 'prof-A',
      commissionId: 'com-1',
      commissionAmount: 150000,
    });

    expect(deducted).toBe(100000);
    const parent = db.find('debt-1');
    expect(parent).toMatchObject({
      status: 'DEDUCTED',
      amountPaid: 100000,
      remainingBalance: 0,
      deductedFromCommissionId: 'com-1',
    });
    const ledger = db.rows().find((r) => r.parentDebtId === 'debt-1');
    expect(ledger).toBeDefined();
    expect(ledger).toMatchObject({
      amount: 100000,
      status: 'DEDUCTED',
      deductedFromCommissionId: 'com-1',
    });
  });

  it('cobertura PARCIAL mantém o pai PENDING com saldo reduzido e ledger do valor coberto', async () => {
    await build([debt({})]);

    const deducted = await service.applyDeductionToCommission({
      professionalId: 'prof-A',
      commissionId: 'com-1',
      commissionAmount: 40000,
    });

    expect(deducted).toBe(40000);
    expect(db.find('debt-1')).toMatchObject({
      status: 'PENDING',
      amountPaid: 40000,
      remainingBalance: 60000,
    });
    const ledger = db.rows().find((r) => r.parentDebtId === 'debt-1');
    expect(ledger).toMatchObject({ amount: 40000, deductedFromCommissionId: 'com-1' });
  });

  it('estorno devolve exatamente o coberto e apaga o ledger (regerar = idempotente)', async () => {
    await build([debt({})]);
    await service.applyDeductionToCommission({
      professionalId: 'prof-A',
      commissionId: 'com-1',
      commissionAmount: 150000,
    });

    await service.reverseDeductionsForCommissions(['com-1']);

    expect(db.find('debt-1')).toMatchObject({
      status: 'PENDING',
      amountPaid: 0,
      remainingBalance: 100000,
      deductedFromCommissionId: null,
    });
    expect(db.rows().filter((r) => r.parentDebtId === 'debt-1')).toHaveLength(0);
  });

  it('REGRESSÃO bola de neve: estornar a comissão B NÃO ressuscita a parte coberta pela comissão A', async () => {
    // Cenário real (julio cesar, 07/2026): débito de R$550 parcialmente coberto
    // pela comissão de junho (R$364,60); depois a geração de julho cobre o
    // restante (R$185,40). Regerar JULHO deve devolver SÓ R$185,40 — o código
    // antigo restaurava os R$550 inteiros e a nova geração descontava tudo de
    // novo (dupla dedução de R$364,60, crescendo a cada clique).
    await build([
      debt({ id: 'debt-550', amount: 55000, amountPaid: 36460, remainingBalance: 18540 }),
      debt({
        id: 'ledger-junho',
        parentDebtId: 'debt-550',
        amount: 36460,
        amountPaid: 36460,
        remainingBalance: 0,
        status: 'DEDUCTED',
        deductedFromCommissionId: 'com-junho',
        description: 'Dedução parcial do débito debt-550 — Vale',
      }),
    ]);

    // Julho cobre o restante (budget sobra)
    const deductedJul = await service.applyDeductionToCommission({
      professionalId: 'prof-A',
      commissionId: 'com-julho',
      commissionAmount: 999999,
    });
    expect(deductedJul).toBe(18540);
    expect(db.find('debt-550')).toMatchObject({ status: 'DEDUCTED', remainingBalance: 0 });

    // Regera julho → estorno
    await service.reverseDeductionsForCommissions(['com-julho']);

    const parent = db.find('debt-550');
    expect(parent).toMatchObject({
      status: 'PENDING',
      amountPaid: 36460, // parte de junho PRESERVADA
      remainingBalance: 18540, // só o que julho cobriu voltou — NÃO 55000
    });
    // ledger de junho intacto; ledger de julho apagado
    expect(db.find('ledger-junho')).toBeDefined();
    expect(
      db.rows().filter((r) => r.deductedFromCommissionId === 'com-julho'),
    ).toHaveLength(0);
  });

  it('LEGADO (pré-migração, quitação total sem ledger): estorno desconta o que outras comissões já cobriram', async () => {
    // Débito quitado integralmente no formato antigo (sem ledger da quitação),
    // mas com um ledger de OUTRA comissão registrando cobertura anterior.
    await build([
      debt({
        id: 'debt-legacy',
        amount: 55000,
        amountPaid: 55000,
        remainingBalance: 0,
        status: 'DEDUCTED',
        deductedFromCommissionId: 'com-x',
      }),
      debt({
        id: 'ledger-old',
        parentDebtId: 'debt-legacy',
        amount: 36460,
        amountPaid: 36460,
        remainingBalance: 0,
        status: 'DEDUCTED',
        deductedFromCommissionId: 'com-anterior',
        description: 'Dedução parcial do débito debt-leg — Vale',
      }),
    ]);

    await service.reverseDeductionsForCommissions(['com-x']);

    expect(db.find('debt-legacy')).toMatchObject({
      status: 'PENDING',
      remainingBalance: 18540, // 55000 − 36460 já cobertos pela com-anterior
      amountPaid: 36460,
    });
    expect(db.find('ledger-old')).toBeDefined(); // não é da com-x — intacto
  });

  it('findAll não lista registros-ledger (novo formato e legado por descrição)', async () => {
    await build([
      debt({ id: 'real-1' }),
      debt({
        id: 'ledger-novo',
        parentDebtId: 'real-1',
        amount: 10000,
        status: 'DEDUCTED',
        description: 'Dedução parcial do débito real-1',
      }),
      debt({
        id: 'ledger-legado',
        parentDebtId: null,
        amount: 5000,
        status: 'DEDUCTED',
        description: 'Dedução parcial do débito 12345678 — Vale',
      }),
    ]);

    const list = await service.findAll({} as any);
    expect(list.map((d: any) => d.id)).toEqual(['real-1']);
  });

  it('getProfessionalSummary ignora ledgers nas somas (não dobra o descontado)', async () => {
    await build([
      debt({ id: 'real-1', amount: 100000, amountPaid: 40000, remainingBalance: 60000 }),
      debt({
        id: 'ledger-1',
        parentDebtId: 'real-1',
        amount: 40000,
        amountPaid: 40000,
        remainingBalance: 0,
        status: 'DEDUCTED',
        description: 'Dedução parcial do débito real-1',
      }),
    ]);

    const summary = await service.getProfessionalSummary('prof-A');
    expect(summary.totalAll).toBe(100000); // sem o ledger (senão 140000)
    expect(summary.totalPaid).toBe(40000); // sem dobrar (senão 80000)
    expect(summary.totalPending).toBe(60000);
  });
});
