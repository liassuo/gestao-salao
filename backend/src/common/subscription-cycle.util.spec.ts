/**
 * Regra do DIA-ÂNCORA (computeRenewalCycle) — pedido do dono em 10/07/2026:
 * "venceu dia 7, pagou dia 10, tem que continuar vencendo dia 7".
 */
import { computeRenewalCycle } from './subscription-cycle.util';

const iso = (s: string) => new Date(s);

describe('computeRenewalCycle — dia-âncora do vencimento', () => {
  it('1ª ativação (isRenewal=false): ciclo começa no pagamento, endDate provisório NÃO é âncora', () => {
    // endDate futuro da criação (o antigo "bug do +2 meses" se fosse âncora)
    const c = computeRenewalCycle({
      prevEndDate: '2026-08-05T12:00:00.000Z',
      refDate: iso('2026-07-10T15:00:00.000Z'),
      isRenewal: false,
    });
    expect(c.anchored).toBe(false);
    expect(c.startDate?.toISOString()).toBe('2026-07-10T15:00:00.000Z');
    expect(c.endDate.toISOString()).toBe('2026-08-10T15:00:00.000Z');
  });

  it('renovação com ATÉ 7 dias de atraso: mantém o dia (caso Kleudson: venceu dia 7, pagou dia 10)', () => {
    const c = computeRenewalCycle({
      prevEndDate: '2026-07-07T12:00:00.000Z',
      refDate: iso('2026-07-10T15:00:00.000Z'),
      isRenewal: true,
    });
    expect(c.anchored).toBe(true);
    // Ciclo novo começa no vencimento antigo → startDate avança p/ dia 7
    expect(c.startDate?.toISOString()).toBe('2026-07-07T12:00:00.000Z');
    // e o próximo vencimento continua no dia 7
    expect(c.endDate.toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });

  it('renovação no limite exato da carência (7 dias): ainda mantém o dia', () => {
    const c = computeRenewalCycle({
      prevEndDate: '2026-07-07T12:00:00.000Z',
      refDate: iso('2026-07-14T12:00:00.000Z'),
      isRenewal: true,
    });
    expect(c.anchored).toBe(true);
    expect(c.endDate.toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });

  it('renovação com atraso MAIOR que a carência: ciclo recomeça no pagamento', () => {
    const c = computeRenewalCycle({
      prevEndDate: '2026-07-07T12:00:00.000Z',
      refDate: iso('2026-07-20T12:00:00.000Z'),
      isRenewal: true,
    });
    expect(c.anchored).toBe(false);
    expect(c.startDate?.toISOString()).toBe('2026-07-20T12:00:00.000Z');
    expect(c.endDate.toISOString()).toBe('2026-08-20T12:00:00.000Z');
  });

  it('renovação ADIANTADA de assinatura ativa (allowFutureAnchor): acumula do vencimento e NÃO mexe no startDate', () => {
    const c = computeRenewalCycle({
      prevEndDate: '2026-07-20T12:00:00.000Z',
      refDate: iso('2026-07-10T12:00:00.000Z'),
      isRenewal: true,
      allowFutureAnchor: true,
    });
    expect(c.anchored).toBe(true);
    expect(c.startDate).toBeNull(); // ciclo corrente segue valendo
    expect(c.endDate.toISOString()).toBe('2026-08-20T12:00:00.000Z');
  });

  it('endDate FUTURO em status não-ativo (sem allowFutureAnchor) é provisório: ciclo começa no pagamento', () => {
    const c = computeRenewalCycle({
      prevEndDate: '2026-07-20T12:00:00.000Z',
      refDate: iso('2026-07-10T12:00:00.000Z'),
      isRenewal: true,
    });
    expect(c.anchored).toBe(false);
    expect(c.endDate.toISOString()).toBe('2026-08-10T12:00:00.000Z');
  });

  it('sem prevEndDate: ciclo começa no pagamento', () => {
    const c = computeRenewalCycle({
      prevEndDate: null,
      refDate: iso('2026-07-10T12:00:00.000Z'),
      isRenewal: true,
    });
    expect(c.anchored).toBe(false);
    expect(c.endDate.toISOString()).toBe('2026-08-10T12:00:00.000Z');
  });

  it('prevEndDate inválido: não quebra, ciclo começa no pagamento', () => {
    const c = computeRenewalCycle({
      prevEndDate: 'data-invalida',
      refDate: iso('2026-07-10T12:00:00.000Z'),
      isRenewal: true,
    });
    expect(c.anchored).toBe(false);
    expect(c.endDate.toISOString()).toBe('2026-08-10T12:00:00.000Z');
  });
});
