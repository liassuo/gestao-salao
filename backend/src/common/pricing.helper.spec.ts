import {
  applyDiscount,
  effectiveDiscountPercent,
  getClientPlanDiscount,
  getPromoDiscountForProduct,
  getPromoDiscountForService,
  PromotionMatch,
} from './pricing.helper';
import { SupabaseService } from '../supabase/supabase.service';

describe('pricing.helper', () => {
  // ─── effectiveDiscountPercent ─────────────────────────────────────────────
  describe('effectiveDiscountPercent (maior prevalece)', () => {
    it('retorna o desconto do plano quando é maior que o da promoção', () => {
      expect(effectiveDiscountPercent(10, 20)).toBe(20);
    });

    it('retorna o desconto da promoção quando é maior que o do plano', () => {
      expect(effectiveDiscountPercent(30, 15)).toBe(30);
    });

    it('retorna qualquer um quando são iguais', () => {
      expect(effectiveDiscountPercent(25, 25)).toBe(25);
    });

    it('retorna 0 quando ambos são 0', () => {
      expect(effectiveDiscountPercent(0, 0)).toBe(0);
    });

    it('retorna o valor não-zero quando o outro é 0', () => {
      expect(effectiveDiscountPercent(0, 15)).toBe(15);
      expect(effectiveDiscountPercent(15, 0)).toBe(15);
    });

    it('trata valores falsy como 0', () => {
      expect(effectiveDiscountPercent(undefined as any, 20)).toBe(20);
      expect(effectiveDiscountPercent(null as any, 20)).toBe(20);
      expect(effectiveDiscountPercent(NaN, 20)).toBe(20);
    });
  });

  // ─── applyDiscount ────────────────────────────────────────────────────────
  describe('applyDiscount', () => {
    it('aplica 20% de desconto em R$ 100,00 (10000 centavos)', () => {
      expect(applyDiscount(10000, 20)).toBe(8000);
    });

    it('aplica 50% de desconto', () => {
      expect(applyDiscount(5000, 50)).toBe(2500);
    });

    it('aplica 100% de desconto resulta em 0', () => {
      expect(applyDiscount(5000, 100)).toBe(0);
    });

    it('arredonda o resultado (centavos inteiros)', () => {
      // R$ 33,33 com 15% de desconto = R$ 28,3305 → arredonda para 2833
      expect(applyDiscount(3333, 15)).toBe(2833);
    });

    it('retorna o preço original quando desconto é 0', () => {
      expect(applyDiscount(5000, 0)).toBe(5000);
    });

    it('retorna o preço original quando desconto é negativo ou undefined', () => {
      expect(applyDiscount(5000, -10)).toBe(5000);
      expect(applyDiscount(5000, undefined as any)).toBe(5000);
    });
  });

  // ─── integração effectiveDiscountPercent + applyDiscount ──────────────────
  describe('integração: promoção vs plano aplicado ao preço', () => {
    it('corte de R$ 50 com promoção 10% e plano 30% → plano prevalece → R$ 35', () => {
      const price = 5000;
      const effective = effectiveDiscountPercent(10, 30);
      expect(applyDiscount(price, effective)).toBe(3500);
    });

    it('produto de R$ 80 com promoção 40% e plano 20% → promoção prevalece → R$ 48', () => {
      const price = 8000;
      const effective = effectiveDiscountPercent(40, 20);
      expect(applyDiscount(price, effective)).toBe(4800);
    });

    it('serviço sem promoção e sem plano → preço cheio', () => {
      const price = 4000;
      expect(applyDiscount(price, effectiveDiscountPercent(0, 0))).toBe(4000);
    });
  });

  // ─── getPromoDiscountForService ───────────────────────────────────────────
  describe('getPromoDiscountForService', () => {
    const promos: PromotionMatch[] = [
      {
        discountPercent: 25,
        promotion_services: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }],
        promotion_products: null,
      },
      {
        discountPercent: 10,
        promotion_services: [{ serviceId: 'svc-3' }],
        promotion_products: null,
      },
    ];

    it('retorna o desconto da promoção que contém o serviço', () => {
      expect(getPromoDiscountForService(promos, 'svc-1')).toBe(25);
      expect(getPromoDiscountForService(promos, 'svc-2')).toBe(25);
      expect(getPromoDiscountForService(promos, 'svc-3')).toBe(10);
    });

    it('retorna 0 quando o serviço não está em nenhuma promoção', () => {
      expect(getPromoDiscountForService(promos, 'svc-nao-existe')).toBe(0);
    });

    it('retorna 0 quando não há promoções', () => {
      expect(getPromoDiscountForService([], 'svc-1')).toBe(0);
    });

    it('retorna a primeira promoção que casar (ordem da lista)', () => {
      const overlap: PromotionMatch[] = [
        { discountPercent: 50, promotion_services: [{ serviceId: 'svc-1' }] },
        { discountPercent: 10, promotion_services: [{ serviceId: 'svc-1' }] },
      ];
      expect(getPromoDiscountForService(overlap, 'svc-1')).toBe(50);
    });
  });

  // ─── getPromoDiscountForProduct ───────────────────────────────────────────
  describe('getPromoDiscountForProduct', () => {
    const promos: PromotionMatch[] = [
      {
        discountPercent: 15,
        promotion_services: null,
        promotion_products: [{ productId: 'prod-1' }],
      },
    ];

    it('retorna o desconto da promoção que contém o produto', () => {
      expect(getPromoDiscountForProduct(promos, 'prod-1')).toBe(15);
    });

    it('retorna 0 quando o produto não está em nenhuma promoção', () => {
      expect(getPromoDiscountForProduct(promos, 'prod-outro')).toBe(0);
    });
  });

  // ─── getClientPlanDiscount (async, com Supabase mock) ─────────────────────
  describe('getClientPlanDiscount', () => {
    const makeSupabase = (returnData: any) => {
      const chain: any = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.maybeSingle = jest.fn().mockResolvedValue({ data: returnData });
      return {
        from: jest.fn().mockReturnValue(chain),
        _chain: chain,
      } as unknown as SupabaseService & { _chain: any };
    };

    it('retorna 0 quando clientId é null', async () => {
      const supabase = makeSupabase(null);
      expect(await getClientPlanDiscount(supabase, null)).toBe(0);
    });

    it('retorna 0 quando clientId é undefined', async () => {
      const supabase = makeSupabase(null);
      expect(await getClientPlanDiscount(supabase, undefined)).toBe(0);
    });

    it('retorna 0 quando cliente não tem assinatura ativa', async () => {
      const supabase = makeSupabase(null);
      expect(await getClientPlanDiscount(supabase, 'client-1')).toBe(0);
    });

    it('retorna discountPercent do plano quando a assinatura está ativa', async () => {
      const supabase = makeSupabase({ plan: { discountPercent: 25 } });
      expect(await getClientPlanDiscount(supabase, 'client-1')).toBe(25);
    });

    it('filtra por status ACTIVE', async () => {
      const supabase = makeSupabase({ plan: { discountPercent: 25 } });
      await getClientPlanDiscount(supabase, 'client-1');
      expect(supabase._chain.eq).toHaveBeenCalledWith('status', 'ACTIVE');
      expect(supabase._chain.eq).toHaveBeenCalledWith('clientId', 'client-1');
    });

    it('retorna 0 quando discountPercent do plano é 0', async () => {
      const supabase = makeSupabase({ plan: { discountPercent: 0 } });
      expect(await getClientPlanDiscount(supabase, 'client-1')).toBe(0);
    });

    it('retorna 0 quando discountPercent não é número', async () => {
      const supabase = makeSupabase({ plan: { discountPercent: null } });
      expect(await getClientPlanDiscount(supabase, 'client-1')).toBe(0);
    });
  });
});
